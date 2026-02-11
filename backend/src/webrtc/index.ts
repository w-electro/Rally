// ─── Mediasoup WebRTC SFU Server ────────────────────────────────────────────────
// Creates mediasoup workers and manages per-channel routers, transports,
// producers, and consumers for voice/video communication.

import { types as mediasoupTypes } from 'mediasoup';
import {
  workerSettings,
  routerMediaCodecs,
  webRtcTransportSettings,
} from '../config/mediasoup';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Peer {
  userId: string;
  transports: Map<string, mediasoupTypes.WebRtcTransport>;
  producers: Map<string, mediasoupTypes.Producer>;
  consumers: Map<string, mediasoupTypes.Consumer>;
}

export interface MediasoupRoom {
  router: mediasoupTypes.Router;
  peers: Map<string, Peer>;
}

// ─── State ──────────────────────────────────────────────────────────────────────

let workers: mediasoupTypes.Worker[] = [];
let nextWorkerIndex = 0;
const rooms = new Map<string, MediasoupRoom>();
let mediasoupAvailable = false;

// ─── Worker Management ──────────────────────────────────────────────────────────

function getNextWorker(): mediasoupTypes.Worker {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available');
  }
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

/**
 * Initialize mediasoup workers (one per CPU core, max 4).
 * Wrapped in try/catch since mediasoup requires native compilation
 * and may not be available in all environments.
 */
export async function initializeMediasoup(): Promise<void> {
  try {
    const mediasoup = await import('mediasoup');
    const os = await import('os');

    const numWorkers = Math.min(os.cpus().length, 4);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(
        workerSettings as mediasoupTypes.WorkerSettings
      );

      worker.on('died', (error) => {
        console.error(`[mediasoup] Worker ${worker.pid} died:`, error);
        // Remove the dead worker
        workers = workers.filter((w) => w.pid !== worker.pid);

        // Attempt to create a replacement worker
        mediasoup
          .createWorker(workerSettings as mediasoupTypes.WorkerSettings)
          .then((newWorker) => {
            newWorker.on('died', () => {
              console.error(`[mediasoup] Replacement worker ${newWorker.pid} also died`);
              workers = workers.filter((w) => w.pid !== newWorker.pid);
            });
            workers.push(newWorker);
            console.log(`[mediasoup] Replacement worker created, pid=${newWorker.pid}`);
          })
          .catch((err) => {
            console.error('[mediasoup] Failed to create replacement worker:', err);
          });
      });

      workers.push(worker);
      console.log(`[mediasoup] Worker ${i + 1}/${numWorkers} created, pid=${worker.pid}`);
    }

    mediasoupAvailable = true;
    console.log(`[mediasoup] Initialized ${numWorkers} workers`);
  } catch (err) {
    mediasoupAvailable = false;
    console.warn(
      '[mediasoup] Failed to initialize mediasoup. WebRTC features will be unavailable.',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Check whether mediasoup is available.
 */
export function isMediasoupAvailable(): boolean {
  return mediasoupAvailable && workers.length > 0;
}

// ─── Room Management ────────────────────────────────────────────────────────────

/**
 * Create a mediasoup Router for a voice/video channel.
 * If a room already exists for the channel, returns the existing one.
 */
export async function createRoom(channelId: string): Promise<MediasoupRoom> {
  if (!isMediasoupAvailable()) {
    throw new Error('Mediasoup is not available');
  }

  const existing = rooms.get(channelId);
  if (existing) {
    return existing;
  }

  const worker = getNextWorker();
  const router = await worker.createRouter({
    mediaCodecs: routerMediaCodecs as mediasoupTypes.RtpCodecCapability[],
  });

  const room: MediasoupRoom = {
    router,
    peers: new Map(),
  };

  rooms.set(channelId, room);
  console.log(`[mediasoup] Room created for channel ${channelId}`);

  return room;
}

/**
 * Get an existing room for a channel, or null if none exists.
 */
export function getRoom(channelId: string): MediasoupRoom | null {
  return rooms.get(channelId) ?? null;
}

/**
 * Remove a room and close its router when a channel is empty.
 */
export function removeRoom(channelId: string): void {
  const room = rooms.get(channelId);
  if (!room) return;

  // Close all peer transports, producers, consumers
  for (const [, peer] of room.peers) {
    cleanupPeer(peer);
  }

  // Close the router
  room.router.close();
  rooms.delete(channelId);
  console.log(`[mediasoup] Room removed for channel ${channelId}`);
}

// ─── Peer Management ────────────────────────────────────────────────────────────

/**
 * Get or create a Peer entry in a room for the given user.
 */
export function getOrCreatePeer(room: MediasoupRoom, userId: string): Peer {
  let peer = room.peers.get(userId);
  if (!peer) {
    peer = {
      userId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    room.peers.set(userId, peer);
  }
  return peer;
}

/**
 * Get a peer from a room, or null if not found.
 */
export function getPeer(room: MediasoupRoom, userId: string): Peer | null {
  return room.peers.get(userId) ?? null;
}

/**
 * Clean up all transports, producers, and consumers for a peer.
 */
export function cleanupPeer(peer: Peer): void {
  for (const [, consumer] of peer.consumers) {
    if (!consumer.closed) consumer.close();
  }
  peer.consumers.clear();

  for (const [, producer] of peer.producers) {
    if (!producer.closed) producer.close();
  }
  peer.producers.clear();

  for (const [, transport] of peer.transports) {
    if (!transport.closed) transport.close();
  }
  peer.transports.clear();
}

/**
 * Remove a peer from a room, cleaning up all their resources.
 * Returns true if the room is now empty (caller should remove the room).
 */
export function removePeer(channelId: string, userId: string): boolean {
  const room = rooms.get(channelId);
  if (!room) return true;

  const peer = room.peers.get(userId);
  if (peer) {
    cleanupPeer(peer);
    room.peers.delete(userId);
  }

  return room.peers.size === 0;
}

// ─── Transport Management ───────────────────────────────────────────────────────

export interface TransportParams {
  id: string;
  iceParameters: mediasoupTypes.IceParameters;
  iceCandidates: mediasoupTypes.IceCandidate[];
  dtlsParameters: mediasoupTypes.DtlsParameters;
}

/**
 * Create a WebRTC transport for a peer in a channel room.
 */
export async function createWebRtcTransport(
  channelId: string,
  userId: string
): Promise<TransportParams> {
  const room = rooms.get(channelId);
  if (!room) {
    throw new Error(`No room found for channel ${channelId}`);
  }

  const peer = getOrCreatePeer(room, userId);

  const transport = await room.router.createWebRtcTransport(
    webRtcTransportSettings as mediasoupTypes.WebRtcTransportOptions
  );

  // Handle transport events
  transport.on('dtlsstatechange', (dtlsState: mediasoupTypes.DtlsState) => {
    if (dtlsState === 'failed' || dtlsState === 'closed') {
      console.warn(
        `[mediasoup] Transport ${transport.id} DTLS state changed to ${dtlsState} for user ${userId}`
      );
      if (!transport.closed) {
        transport.close();
      }
    }
  });

  transport.on('@close', () => {
    peer.transports.delete(transport.id);
  });

  peer.transports.set(transport.id, transport);

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

/**
 * Connect a transport with DTLS parameters from the client.
 */
export async function connectTransport(
  channelId: string,
  userId: string,
  transportId: string,
  dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
  const room = rooms.get(channelId);
  if (!room) {
    throw new Error(`No room found for channel ${channelId}`);
  }

  const peer = room.peers.get(userId);
  if (!peer) {
    throw new Error(`No peer found for user ${userId} in channel ${channelId}`);
  }

  const transport = peer.transports.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found for user ${userId}`);
  }

  await transport.connect({ dtlsParameters });
}

// ─── Producer Management ────────────────────────────────────────────────────────

export interface ProducerInfo {
  id: string;
  kind: mediasoupTypes.MediaKind;
  userId: string;
}

/**
 * Create a producer on a transport (user starts sending audio/video).
 */
export async function createProducer(
  channelId: string,
  userId: string,
  transportId: string,
  rtpParameters: mediasoupTypes.RtpParameters,
  kind: mediasoupTypes.MediaKind,
  appData?: Record<string, unknown>
): Promise<mediasoupTypes.Producer> {
  const room = rooms.get(channelId);
  if (!room) {
    throw new Error(`No room found for channel ${channelId}`);
  }

  const peer = room.peers.get(userId);
  if (!peer) {
    throw new Error(`No peer found for user ${userId}`);
  }

  const transport = peer.transports.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found`);
  }

  const producer = await transport.produce({
    kind,
    rtpParameters,
    appData: { ...appData, userId, channelId },
  });

  producer.on('transportclose', () => {
    producer.close();
    peer.producers.delete(producer.id);
  });

  peer.producers.set(producer.id, producer);

  return producer;
}

/**
 * Close a specific producer.
 */
export function closeProducer(
  channelId: string,
  userId: string,
  producerId: string
): void {
  const room = rooms.get(channelId);
  if (!room) return;

  const peer = room.peers.get(userId);
  if (!peer) return;

  const producer = peer.producers.get(producerId);
  if (!producer) return;

  if (!producer.closed) {
    producer.close();
  }
  peer.producers.delete(producerId);
}

/**
 * Get all producers in a room (for when a new peer joins and needs to consume existing streams).
 */
export function getRoomProducers(channelId: string, excludeUserId?: string): ProducerInfo[] {
  const room = rooms.get(channelId);
  if (!room) return [];

  const producers: ProducerInfo[] = [];

  for (const [peerId, peer] of room.peers) {
    if (excludeUserId && peerId === excludeUserId) continue;
    for (const [, producer] of peer.producers) {
      if (!producer.closed) {
        producers.push({
          id: producer.id,
          kind: producer.kind,
          userId: peer.userId,
        });
      }
    }
  }

  return producers;
}

// ─── Consumer Management ────────────────────────────────────────────────────────

export interface ConsumerParams {
  id: string;
  producerId: string;
  kind: mediasoupTypes.MediaKind;
  rtpParameters: mediasoupTypes.RtpParameters;
}

/**
 * Create a consumer (user starts receiving someone else's audio/video).
 * The consumer is created on the consuming user's receive transport.
 */
export async function createConsumer(
  channelId: string,
  consumingUserId: string,
  producerId: string,
  rtpCapabilities: mediasoupTypes.RtpCapabilities,
  transportId: string
): Promise<ConsumerParams> {
  const room = rooms.get(channelId);
  if (!room) {
    throw new Error(`No room found for channel ${channelId}`);
  }

  // Verify the router can consume this producer with the given capabilities
  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume: incompatible RTP capabilities');
  }

  const consumerPeer = room.peers.get(consumingUserId);
  if (!consumerPeer) {
    throw new Error(`No peer found for consuming user ${consumingUserId}`);
  }

  const transport = consumerPeer.transports.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found for consumer`);
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true, // Start paused; client must call resume
  });

  consumer.on('transportclose', () => {
    consumer.close();
    consumerPeer.consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumer.close();
    consumerPeer.consumers.delete(consumer.id);
  });

  consumerPeer.consumers.set(consumer.id, consumer);

  return {
    id: consumer.id,
    producerId: consumer.producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

/**
 * Resume a paused consumer.
 */
export async function resumeConsumer(
  channelId: string,
  userId: string,
  consumerId: string
): Promise<void> {
  const room = rooms.get(channelId);
  if (!room) {
    throw new Error(`No room found for channel ${channelId}`);
  }

  const peer = room.peers.get(userId);
  if (!peer) {
    throw new Error(`No peer found for user ${userId}`);
  }

  const consumer = peer.consumers.get(consumerId);
  if (!consumer) {
    throw new Error(`Consumer ${consumerId} not found`);
  }

  await consumer.resume();
}

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Get router RTP capabilities for a channel (needed by clients before they can produce/consume).
 */
export function getRouterRtpCapabilities(
  channelId: string
): mediasoupTypes.RtpCapabilities | null {
  const room = rooms.get(channelId);
  if (!room) return null;
  return room.router.rtpCapabilities;
}

/**
 * Shut down all workers and clean up.
 */
export async function shutdown(): Promise<void> {
  for (const [channelId] of rooms) {
    removeRoom(channelId);
  }
  for (const worker of workers) {
    worker.close();
  }
  workers = [];
  mediasoupAvailable = false;
  console.log('[mediasoup] Shutdown complete');
}
