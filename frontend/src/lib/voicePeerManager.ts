import SimplePeer from 'simple-peer';
import { getSocket } from '../hooks/useSocket';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Open Relay TURN servers (static auth)
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  // Static auth TURN server
  { urls: 'turn:staticauth.openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:staticauth.openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

interface VoicePeerManagerCallbacks {
  onSpeakingChange: (speaking: boolean) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onScreenStream: (userId: string, stream: MediaStream) => void;
  onPeerDisconnect: (userId: string) => void;
}

export class VoicePeerManager {
  private peers: Map<string, SimplePeer.Instance> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private isSpeaking = false;
  private isMuted = false;
  private isDeafened = false;
  private localUserId: string | null = null;
  private stopped = false;

  // Queue for signals that arrive before peer is created
  private pendingSignals: Map<string, any[]> = new Map();
  // Track retry counts to avoid infinite reconnects
  private retryCount: Map<string, number> = new Map();

  private onSpeakingChange: (speaking: boolean) => void;
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onScreenStream: (userId: string, stream: MediaStream) => void;
  private onPeerDisconnect: (userId: string) => void;

  // Bound socket listener references for cleanup
  private boundHandleOffer: (data: { fromUserId: string; offer: any }) => void;
  private boundHandleAnswer: (data: { fromUserId: string; answer: any }) => void;
  private boundHandleIceCandidate: (data: { fromUserId: string; candidate: any }) => void;

  constructor(callbacks: VoicePeerManagerCallbacks) {
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onScreenStream = callbacks.onScreenStream;
    this.onPeerDisconnect = callbacks.onPeerDisconnect;

    this.boundHandleOffer = this.handleOffer.bind(this);
    this.boundHandleAnswer = this.handleAnswer.bind(this);
    this.boundHandleIceCandidate = this.handleIceCandidate.bind(this);
  }

  /**
   * Set the local user ID for deterministic initiator selection.
   */
  setLocalUserId(userId: string): void {
    this.localUserId = userId;
  }

  /**
   * Start the voice session: acquire microphone, set up VAD, attach socket listeners.
   */
  async start(): Promise<void> {
    this.stopped = false;
    // Acquire local microphone stream with preferred device
    const savedDeviceId = localStorage.getItem('rally-audio-input-device');
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (savedDeviceId) {
      audioConstraints.deviceId = { preferred: savedDeviceId } as any;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });

    console.log('[VoicePeerManager] Local stream acquired, tracks:', this.localStream.getAudioTracks().length);

    // Set up Voice Activity Detection
    this.setupVAD();

    // Attach socket listeners for WebRTC signaling
    this.attachSocketListeners();
  }

  /**
   * Set up Voice Activity Detection using Web Audio API.
   */
  private setupVAD(): void {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    // Chromium may start AudioContext in suspended state — resume it
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    this.vadInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(frequencyData);

      let sum = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i];
      }
      const average = sum / frequencyData.length;

      const speaking = average > 15 && !this.isMuted;

      if (speaking !== this.isSpeaking) {
        this.isSpeaking = speaking;
        this.onSpeakingChange(speaking);
      }
    }, 100);
  }

  /**
   * Attach socket listeners for incoming WebRTC signaling events.
   */
  private attachSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.on('webrtc:offer', this.boundHandleOffer);
    socket.on('webrtc:answer', this.boundHandleAnswer);
    socket.on('webrtc:ice_candidate', this.boundHandleIceCandidate);
  }

  /**
   * Remove socket listeners for WebRTC signaling events.
   */
  private detachSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.off('webrtc:offer', this.boundHandleOffer);
    socket.off('webrtc:answer', this.boundHandleAnswer);
    socket.off('webrtc:ice_candidate', this.boundHandleIceCandidate);
  }

  /**
   * Handle an incoming WebRTC offer from a remote peer.
   */
  private handleOffer(data: { fromUserId: string; offer: any }): void {
    const { fromUserId, offer } = data;
    console.log(`[VoicePeerManager] Received offer from ${fromUserId}`);

    if (this.peers.has(fromUserId)) {
      // Glare: both sides tried to initiate. Lower userId wins initiator role.
      if (this.localUserId && this.localUserId < fromUserId) {
        // We are the rightful initiator — ignore their offer
        console.log(`[VoicePeerManager] Ignoring offer from ${fromUserId} (we are initiator)`);
        return;
      }
      // They are the rightful initiator — destroy our attempt, accept theirs
      console.log(`[VoicePeerManager] Accepting offer from ${fromUserId} (they are initiator)`);
      this.removePeer(fromUserId);
    }

    const peer = this.createPeer(fromUserId, false);
    peer.signal(offer);
  }

  /**
   * Handle an incoming WebRTC answer from a remote peer.
   */
  private handleAnswer(data: { fromUserId: string; answer: any }): void {
    const { fromUserId, answer } = data;
    console.log(`[VoicePeerManager] Received answer from ${fromUserId}`);
    const peer = this.peers.get(fromUserId);
    if (peer) {
      peer.signal(answer);
    } else {
      console.warn(`[VoicePeerManager] No peer found for answer from ${fromUserId}, queueing`);
      this.queueSignal(fromUserId, answer);
    }
  }

  /**
   * Handle an incoming ICE candidate from a remote peer.
   */
  private handleIceCandidate(data: { fromUserId: string; candidate: any }): void {
    const { fromUserId, candidate } = data;
    const peer = this.peers.get(fromUserId);
    if (peer) {
      peer.signal(candidate);
    } else {
      // Queue ICE candidates that arrive before peer creation
      this.queueSignal(fromUserId, candidate);
    }
  }

  /**
   * Queue a signal for a peer that doesn't exist yet.
   */
  private queueSignal(userId: string, signal: any): void {
    if (!this.pendingSignals.has(userId)) {
      this.pendingSignals.set(userId, []);
    }
    this.pendingSignals.get(userId)!.push(signal);
  }

  /**
   * Flush any queued signals to a peer.
   */
  private flushPendingSignals(userId: string, peer: SimplePeer.Instance): void {
    const queued = this.pendingSignals.get(userId);
    if (queued && queued.length > 0) {
      console.log(`[VoicePeerManager] Flushing ${queued.length} queued signals for ${userId}`);
      for (const signal of queued) {
        try {
          peer.signal(signal);
        } catch (e) {
          console.error(`[VoicePeerManager] Error flushing signal for ${userId}:`, e);
        }
      }
      this.pendingSignals.delete(userId);
    }
  }

  /**
   * Connect to a single peer, determining initiator based on userId comparison.
   */
  connectToPeer(userId: string): void {
    if (this.peers.has(userId)) return;

    // Deterministic initiator: lower userId is always the initiator
    const shouldInitiate = this.localUserId ? this.localUserId < userId : true;
    console.log(`[VoicePeerManager] Connecting to ${userId}, initiator: ${shouldInitiate}`);
    this.createPeer(userId, shouldInitiate);
  }

  /**
   * Connect to a list of existing participants.
   * Called when joining a voice channel that already has users.
   */
  connectToParticipants(userIds: string[]): void {
    for (const userId of userIds) {
      this.connectToPeer(userId);
    }
  }

  /**
   * Create a SimplePeer instance for a specific target user.
   */
  private createPeer(targetUserId: string, initiator: boolean): SimplePeer.Instance {
    console.log(`[VoicePeerManager] Creating peer for ${targetUserId}, initiator: ${initiator}, hasStream: ${!!this.localStream}`);

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: {
        iceServers: ICE_SERVERS,
        bundlePolicy: 'max-bundle' as RTCBundlePolicy,
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
      },
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      },
      answerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      },
      // Optimize SDP for voice: Opus mono, 64kbps, forward error correction
      sdpTransform: (sdp: string) => {
        return sdp.replace('useinbandfec=1', 'useinbandfec=1;stereo=0;maxaveragebitrate=64000');
      },
    } as any);

    this.peers.set(targetUserId, peer);

    const socket = getSocket();

    peer.on('signal', (signalData: SimplePeer.SignalData) => {
      if (!socket) return;

      if (signalData.type === 'offer') {
        console.log(`[VoicePeerManager] Sending offer to ${targetUserId}`);
        socket.emit('webrtc:offer', {
          targetUserId,
          offer: signalData,
        });
      } else if (signalData.type === 'answer') {
        console.log(`[VoicePeerManager] Sending answer to ${targetUserId}`);
        socket.emit('webrtc:answer', {
          targetUserId,
          answer: signalData,
        });
      } else if ('candidate' in signalData) {
        socket.emit('webrtc:ice_candidate', {
          targetUserId,
          candidate: signalData,
        });
      }
    });

    peer.on('connect', () => {
      console.log(`[VoicePeerManager] Peer CONNECTED to ${targetUserId}`);
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      console.log(`[VoicePeerManager] Received stream from ${targetUserId}, video: ${remoteStream.getVideoTracks().length}, audio: ${remoteStream.getAudioTracks().length}`);
      if (remoteStream.getVideoTracks().length > 0) {
        this.onScreenStream(targetUserId, remoteStream);
      } else {
        this.onRemoteStream(targetUserId, remoteStream);
      }
    });

    peer.on('close', () => {
      console.log(`[VoicePeerManager] Peer CLOSED for ${targetUserId}`);
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
      // Auto-retry if not intentionally stopped
      this.maybeRetry(targetUserId);
    });

    peer.on('error', (err: Error) => {
      console.error(`[VoicePeerManager] Peer ERROR with ${targetUserId}:`, err.message);
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
      // Auto-retry on connection errors
      this.maybeRetry(targetUserId);
    });

    // Flush any signals that arrived before this peer was created
    this.flushPendingSignals(targetUserId, peer);

    return peer;
  }

  /**
   * Auto-retry a failed peer connection (up to 3 times).
   */
  private maybeRetry(userId: string): void {
    if (this.stopped) return;
    const count = (this.retryCount.get(userId) ?? 0) + 1;
    if (count > 3) {
      console.warn(`[VoicePeerManager] Max retries reached for ${userId}`);
      this.retryCount.delete(userId);
      return;
    }
    this.retryCount.set(userId, count);
    console.log(`[VoicePeerManager] Retry #${count} for ${userId} in ${count * 2}s`);
    setTimeout(() => {
      if (this.stopped || this.peers.has(userId)) return;
      this.connectToPeer(userId);
    }, count * 2000);
  }

  /**
   * Remove and destroy a specific peer connection.
   */
  removePeer(userId: string): void {
    const peer = this.peers.get(userId);
    if (peer) {
      try {
        peer.destroy();
      } catch {
        // Peer may already be destroyed
      }
      this.peers.delete(userId);
    }
  }

  /**
   * Mute or unmute the local microphone.
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }
  }

  /**
   * Set deafened state.
   */
  setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
  }

  /**
   * Get the local microphone stream.
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get the number of active peer connections.
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Check if a peer connection exists for a given user.
   */
  hasPeer(userId: string): boolean {
    return this.peers.has(userId);
  }

  /**
   * Start sharing a screen/window.
   */
  async startScreenShare(sourceId: string, withAudio: boolean): Promise<MediaStream> {
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    if (isElectron && sourceId !== 'browser') {
      this.screenStream = await navigator.mediaDevices.getUserMedia({
        audio: withAudio ? {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        } as any : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        } as any,
      });
    } else {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: withAudio,
      });
    }

    for (const [, peer] of this.peers) {
      try {
        (peer as any).addStream(this.screenStream);
      } catch (e) {
        console.error('[VoicePeerManager] Failed to add screen stream:', e);
      }
    }

    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
    }

    return this.screenStream;
  }

  /**
   * Stop the current screen share.
   */
  stopScreenShare(): void {
    if (!this.screenStream) return;

    for (const [, peer] of this.peers) {
      try {
        (peer as any).removeStream(this.screenStream);
      } catch (e) {
        // Peer may not have the stream
      }
    }

    for (const track of this.screenStream.getTracks()) {
      track.stop();
    }
    this.screenStream = null;
  }

  /**
   * Returns whether screen sharing is currently active.
   */
  getScreenSharing(): boolean {
    return this.screenStream !== null;
  }

  /**
   * Stop the entire voice session.
   */
  stop(): void {
    this.stopped = true;
    for (const [, peer] of this.peers.entries()) {
      try {
        peer.destroy();
      } catch {
        // Peer may already be destroyed
      }
    }
    this.peers.clear();
    this.pendingSignals.clear();
    this.retryCount.clear();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.isSpeaking = false;

    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        track.stop();
      }
      this.screenStream = null;
    }

    this.detachSocketListeners();
  }
}
