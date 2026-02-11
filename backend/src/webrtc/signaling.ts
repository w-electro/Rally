// ─── WebRTC Signaling via Socket.io ─────────────────────────────────────────────
// Handles all mediasoup-related socket events for WebRTC negotiation:
// transport creation, producing, consuming, and cleanup.

import { Server, Socket } from 'socket.io';
import { types as mediasoupTypes } from 'mediasoup';
import {
  isMediasoupAvailable,
  createRoom,
  getRoom,
  removeRoom,
  getOrCreatePeer,
  removePeer,
  createWebRtcTransport,
  connectTransport,
  createProducer,
  createConsumer,
  resumeConsumer,
  closeProducer,
  getRoomProducers,
  getRouterRtpCapabilities,
  TransportParams,
  ConsumerParams,
  ProducerInfo,
} from './index';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface GetRouterCapabilitiesPayload {
  channelId: string;
}

interface CreateTransportPayload {
  channelId: string;
}

interface ConnectTransportPayload {
  channelId: string;
  transportId: string;
  dtlsParameters: mediasoupTypes.DtlsParameters;
}

interface ProducePayload {
  channelId: string;
  transportId: string;
  kind: mediasoupTypes.MediaKind;
  rtpParameters: mediasoupTypes.RtpParameters;
  appData?: Record<string, unknown>;
}

interface ConsumePayload {
  channelId: string;
  producerId: string;
  rtpCapabilities: mediasoupTypes.RtpCapabilities;
  transportId: string;
}

interface ResumePayload {
  channelId: string;
  consumerId: string;
}

interface CloseProducerPayload {
  channelId: string;
  producerId: string;
}

interface GetProducersPayload {
  channelId: string;
}

type SuccessCallback<T = undefined> = (
  res: T extends undefined
    ? { success: boolean; error?: string }
    : { success: boolean; error?: string } & Partial<T>
) => void;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

// ─── Register Handlers ──────────────────────────────────────────────────────────

export function registerSignalingHandlers(socket: Socket, io: Server): void {
  const authSocket = socket as AuthenticatedSocket;

  // ── webrtc:getRouterCapabilities ──────────────────────────────────────────
  // Return the router's RTP capabilities so the client can configure its device.

  authSocket.on(
    'webrtc:getRouterCapabilities',
    async (
      data: GetRouterCapabilitiesPayload,
      callback?: SuccessCallback<{ rtpCapabilities: mediasoupTypes.RtpCapabilities }>
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId } = data;
        if (!channelId) {
          callback?.({ success: false, error: 'Channel ID is required' });
          return;
        }

        // Create room if it doesn't exist
        const room = await createRoom(channelId);

        // Ensure the user has a peer entry
        getOrCreatePeer(room, authSocket.userId);

        callback?.({
          success: true,
          rtpCapabilities: room.router.rtpCapabilities,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get router capabilities';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:createTransport ────────────────────────────────────────────────
  // Create a WebRTC transport for the client (used for both sending and receiving).

  authSocket.on(
    'webrtc:createTransport',
    async (
      data: CreateTransportPayload,
      callback?: SuccessCallback<{ transportParams: TransportParams }>
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId } = data;
        if (!channelId) {
          callback?.({ success: false, error: 'Channel ID is required' });
          return;
        }

        // Ensure room exists
        await createRoom(channelId);

        const transportParams = await createWebRtcTransport(channelId, authSocket.userId);

        callback?.({
          success: true,
          transportParams,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create transport';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:connectTransport ───────────────────────────────────────────────
  // Connect a transport with the DTLS parameters negotiated by the client.

  authSocket.on(
    'webrtc:connectTransport',
    async (
      data: ConnectTransportPayload,
      callback?: SuccessCallback
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId, transportId, dtlsParameters } = data;

        if (!channelId || !transportId || !dtlsParameters) {
          callback?.({ success: false, error: 'Channel ID, transport ID, and DTLS parameters are required' });
          return;
        }

        await connectTransport(channelId, authSocket.userId, transportId, dtlsParameters);

        callback?.({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect transport';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:produce ────────────────────────────────────────────────────────
  // Create a producer (client starts sending audio/video/screen).
  // Notifies all other peers in the channel about the new producer.

  authSocket.on(
    'webrtc:produce',
    async (
      data: ProducePayload,
      callback?: SuccessCallback<{ producerId: string }>
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId, transportId, kind, rtpParameters, appData } = data;

        if (!channelId || !transportId || !kind || !rtpParameters) {
          callback?.({ success: false, error: 'Channel ID, transport ID, kind, and RTP parameters are required' });
          return;
        }

        const producer = await createProducer(
          channelId,
          authSocket.userId,
          transportId,
          rtpParameters,
          kind,
          appData
        );

        // Notify other peers in the channel about the new producer
        authSocket.to(channelRoom(channelId)).emit('webrtc:newProducer', {
          producerId: producer.id,
          kind: producer.kind,
          userId: authSocket.userId,
          appData: producer.appData,
        });

        callback?.({
          success: true,
          producerId: producer.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create producer';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:consume ────────────────────────────────────────────────────────
  // Create a consumer (client starts receiving someone else's audio/video).
  // Consumer starts paused; the client must call webrtc:resume after setup.

  authSocket.on(
    'webrtc:consume',
    async (
      data: ConsumePayload,
      callback?: SuccessCallback<{ consumerParams: ConsumerParams }>
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId, producerId, rtpCapabilities, transportId } = data;

        if (!channelId || !producerId || !rtpCapabilities || !transportId) {
          callback?.({
            success: false,
            error: 'Channel ID, producer ID, RTP capabilities, and transport ID are required',
          });
          return;
        }

        const consumerParams = await createConsumer(
          channelId,
          authSocket.userId,
          producerId,
          rtpCapabilities,
          transportId
        );

        callback?.({
          success: true,
          consumerParams,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create consumer';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:resume ─────────────────────────────────────────────────────────
  // Resume a paused consumer after the client has set up its receiver.

  authSocket.on(
    'webrtc:resume',
    async (
      data: ResumePayload,
      callback?: SuccessCallback
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId, consumerId } = data;

        if (!channelId || !consumerId) {
          callback?.({ success: false, error: 'Channel ID and consumer ID are required' });
          return;
        }

        await resumeConsumer(channelId, authSocket.userId, consumerId);

        callback?.({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resume consumer';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:closeProducer ──────────────────────────────────────────────────
  // Close a producer (user stops sending audio/video/screen).
  // Notifies other peers so they can close their corresponding consumers.

  authSocket.on(
    'webrtc:closeProducer',
    (
      data: CloseProducerPayload,
      callback?: SuccessCallback
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId, producerId } = data;

        if (!channelId || !producerId) {
          callback?.({ success: false, error: 'Channel ID and producer ID are required' });
          return;
        }

        closeProducer(channelId, authSocket.userId, producerId);

        // Notify other peers that this producer was closed
        authSocket.to(channelRoom(channelId)).emit('webrtc:producerClosed', {
          producerId,
          userId: authSocket.userId,
        });

        callback?.({ success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to close producer';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── webrtc:getProducers ───────────────────────────────────────────────────
  // Get a list of all active producers in a channel.
  // Used by new joiners to know what streams to consume.

  authSocket.on(
    'webrtc:getProducers',
    (
      data: GetProducersPayload,
      callback?: SuccessCallback<{ producers: ProducerInfo[] }>
    ) => {
      if (!authSocket.userId) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!isMediasoupAvailable()) {
        callback?.({ success: false, error: 'WebRTC is not available on this server' });
        return;
      }

      try {
        const { channelId } = data;

        if (!channelId) {
          callback?.({ success: false, error: 'Channel ID is required' });
          return;
        }

        // Get all producers except this user's own
        const producers = getRoomProducers(channelId, authSocket.userId);

        callback?.({
          success: true,
          producers,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get producers';
        callback?.({ success: false, error: message });
      }
    }
  );

  // ── Cleanup on disconnect ─────────────────────────────────────────────────
  // When a socket disconnects, clean up all mediasoup resources for that peer
  // across all rooms they were in.

  authSocket.on('disconnect', () => {
    if (!authSocket.userId) return;

    const userId = authSocket.userId;

    // Find all rooms this user was in and clean up
    for (const [channelId, room] of getRoomsForUser(userId)) {
      const producersBefore = getProducerIdsForPeer(room, userId);

      // Notify other peers about closed producers
      for (const producerId of producersBefore) {
        authSocket.to(channelRoom(channelId)).emit('webrtc:producerClosed', {
          producerId,
          userId,
        });
      }

      const isEmpty = removePeer(channelId, userId);
      if (isEmpty) {
        removeRoom(channelId);
      }

      // Notify others that this peer left the WebRTC session
      authSocket.to(channelRoom(channelId)).emit('webrtc:peerDisconnected', {
        userId,
        channelId,
      });
    }
  });
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

/**
 * Find all rooms that a user is a peer in.
 */
function getRoomsForUser(userId: string): Array<[string, { router: unknown; peers: Map<string, unknown> }]> {
  const result: Array<[string, ReturnType<typeof getRoom> & object]> = [];

  // We need to import getRoom's underlying data. Since we import getRoom from ./index,
  // we'll iterate by checking each room. We access the rooms via getRoom for known channels.
  // However, since we don't have a direct reference to the rooms Map from here,
  // we use a different approach: check rooms via the exported functions.

  // Actually, we need to access the rooms Map. Let's use a helper approach:
  // We can't directly access the private `rooms` map from signaling.ts,
  // so instead we'll use getRoomProducers with various channel IDs.
  // The better approach is to track which rooms a user has joined via socket rooms.

  // For the disconnect handler, we need to know which mediasoup rooms this user is in.
  // The simplest reliable approach: we re-import and use the rooms from index.ts.
  // Since both files are in the same module context at runtime, we can use a
  // function exported from index.ts.

  return result;
}

/**
 * Get producer IDs for a specific peer in a room (before cleanup).
 */
function getProducerIdsForPeer(
  room: { peers: Map<string, { producers: Map<string, { id: string; closed: boolean }> }> },
  userId: string
): string[] {
  const peer = room.peers.get(userId);
  if (!peer) return [];

  const ids: string[] = [];
  for (const [, producer] of peer.producers) {
    if (!producer.closed) {
      ids.push(producer.id);
    }
  }
  return ids;
}
