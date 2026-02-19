import { Server, Socket } from 'socket.io';
import { config } from '../config';

// WebRTC signaling server for peer-to-peer voice/video connections
// Uses simple-peer compatible signaling

interface PeerConnection {
  fromUserId: string;
  toUserId: string;
  channelId: string;
}

const activePeers = new Map<string, PeerConnection[]>();

export function setupWebRTCSignaling(io: Server) {
  // ICE server configuration for clients
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: config.webrtc.turnUrl,
      username: config.webrtc.turnUsername,
      credential: config.webrtc.turnPassword,
    },
  ];

  io.on('connection', (socket: Socket & { userId?: string }) => {
    // Send ICE configuration to client
    socket.on('webrtc:get_config', () => {
      socket.emit('webrtc:config', { iceServers });
    });

    // Initiate peer connection
    socket.on('webrtc:offer', (data: {
      targetUserId: string;
      channelId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const targetSocket = findSocketByUserId(io, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:offer', {
          fromUserId: socket.userId,
          channelId: data.channelId,
          offer: data.offer,
        });
      }
    });

    // Handle answer to offer
    socket.on('webrtc:answer', (data: {
      targetUserId: string;
      channelId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const targetSocket = findSocketByUserId(io, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:answer', {
          fromUserId: socket.userId,
          channelId: data.channelId,
          answer: data.answer,
        });
      }
    });

    // ICE candidate exchange
    socket.on('webrtc:ice_candidate', (data: {
      targetUserId: string;
      channelId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const targetSocket = findSocketByUserId(io, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:ice_candidate', {
          fromUserId: socket.userId,
          channelId: data.channelId,
          candidate: data.candidate,
        });
      }
    });

    // Screen share signaling
    socket.on('webrtc:screen_share_offer', (data: {
      targetUserId: string;
      channelId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const targetSocket = findSocketByUserId(io, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:screen_share_offer', {
          fromUserId: socket.userId,
          channelId: data.channelId,
          offer: data.offer,
        });
      }
    });

    socket.on('webrtc:screen_share_answer', (data: {
      targetUserId: string;
      channelId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      const targetSocket = findSocketByUserId(io, data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc:screen_share_answer', {
          fromUserId: socket.userId,
          channelId: data.channelId,
          answer: data.answer,
        });
      }
    });

    // Spatial audio position updates
    socket.on('spatial:position', (data: {
      channelId: string;
      position: { x: number; y: number };
    }) => {
      socket.to(`voice:${data.channelId}`).emit('spatial:position_updated', {
        userId: socket.userId,
        position: data.position,
      });
    });
  });
}

function findSocketByUserId(io: Server, userId: string): (Socket & { userId?: string }) | undefined {
  for (const [, socket] of io.sockets.sockets) {
    if ((socket as any).userId === userId) return socket as any;
  }
  return undefined;
}

export { activePeers };
