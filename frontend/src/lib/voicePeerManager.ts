import SimplePeer from 'simple-peer';
import { getSocket } from '../hooks/useSocket';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
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
   * Start the voice session: acquire microphone, set up VAD, attach socket listeners.
   */
  async start(): Promise<void> {
    // Acquire local microphone stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    // Set up Voice Activity Detection
    this.setupVAD();

    // Attach socket listeners for WebRTC signaling
    this.attachSocketListeners();
  }

  /**
   * Set up Voice Activity Detection using Web Audio API.
   * Polls frequency data every 100ms and fires onSpeakingChange when state changes.
   */
  private setupVAD(): void {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    this.vadInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(frequencyData);

      // Calculate average frequency magnitude
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
   * Creates a non-initiator peer and signals the offer to it.
   */
  private handleOffer(data: { fromUserId: string; offer: any }): void {
    const { fromUserId, offer } = data;

    // If we already have a peer for this user, destroy it first
    if (this.peers.has(fromUserId)) {
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
    const peer = this.peers.get(fromUserId);
    if (peer) {
      peer.signal(answer);
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
    }
  }

  /**
   * Connect to a list of existing participants by creating initiator peers.
   * Called when joining a voice channel that already has users.
   */
  connectToParticipants(userIds: string[]): void {
    for (const userId of userIds) {
      if (!this.peers.has(userId)) {
        this.createPeer(userId, true);
      }
    }
  }

  /**
   * Create a SimplePeer instance for a specific target user.
   * Returns the peer instance (also stored internally).
   */
  private createPeer(targetUserId: string, initiator: boolean): SimplePeer.Instance {
    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    this.peers.set(targetUserId, peer);

    const socket = getSocket();

    peer.on('signal', (signalData: SimplePeer.SignalData) => {
      if (!socket) return;

      if (signalData.type === 'offer') {
        socket.emit('webrtc:offer', {
          targetUserId,
          offer: signalData,
        });
      } else if (signalData.type === 'answer') {
        socket.emit('webrtc:answer', {
          targetUserId,
          answer: signalData,
        });
      } else if ('candidate' in signalData) {
        // ICE candidate (signalData has { candidate, sdpMid, sdpMLineIndex })
        socket.emit('webrtc:ice_candidate', {
          targetUserId,
          candidate: signalData,
        });
      }
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      if (remoteStream.getVideoTracks().length > 0) {
        this.onScreenStream(targetUserId, remoteStream);
      } else {
        this.onRemoteStream(targetUserId, remoteStream);
      }
    });

    peer.on('close', () => {
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
    });

    peer.on('error', (err: Error) => {
      console.error(`[VoicePeerManager] Peer error with ${targetUserId}:`, err.message);
      this.peers.delete(targetUserId);
      this.onPeerDisconnect(targetUserId);
    });

    return peer;
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
   * Disables/enables all audio tracks on the local stream.
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
    // If muted, immediately report not speaking
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }
  }

  /**
   * Set deafened state. The actual muting of remote audio is handled by the UI layer
   * (e.g., setting volume to 0 on <audio> elements), but we track the state here
   * so the VAD and other internals can reference it.
   */
  setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
  }

  /**
   * Get the local microphone stream (for UI level meters, etc.).
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
   * Start sharing a screen/window. Acquires the desktop capture stream via
   * Electron's chromeMediaSource and adds the video track to all existing peers.
   */
  async startScreenShare(sourceId: string, withAudio: boolean): Promise<MediaStream> {
    // Get screen capture stream using Electron's chromeMediaSource
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

    // Add video track to all existing peers
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      for (const [, peer] of this.peers) {
        try {
          peer.addTrack(videoTrack, this.screenStream);
        } catch (e) {
          console.error('[VoicePeerManager] Failed to add screen track:', e);
        }
      }

      // Listen for track ending (user stops from OS)
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
    }

    return this.screenStream;
  }

  /**
   * Stop the current screen share. Removes the video track from all peers
   * and stops all tracks on the screen stream.
   */
  stopScreenShare(): void {
    if (!this.screenStream) return;

    // Remove video tracks from all peers
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      for (const [, peer] of this.peers) {
        try {
          peer.removeTrack(videoTrack, this.screenStream);
        } catch (e) {
          // Peer may not have the track
        }
      }
    }

    // Stop all tracks in the screen stream
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
   * Stop the entire voice session: destroy all peers, stop local stream,
   * clean up VAD, and remove socket listeners.
   */
  stop(): void {
    // Destroy all peer connections
    for (const [userId, peer] of this.peers.entries()) {
      try {
        peer.destroy();
      } catch {
        // Peer may already be destroyed
      }
    }
    this.peers.clear();

    // Stop local media stream
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    // Clean up Voice Activity Detection
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

    // Clean up screen share stream
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        track.stop();
      }
      this.screenStream = null;
    }

    // Remove socket listeners
    this.detachSocketListeners();
  }
}
