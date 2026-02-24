import { Server } from 'socket.io';

/** Shared reference to the Socket.IO server instance.
 *  Set once at startup, then imported by REST routes that need to broadcast events. */
let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function getIO(): Server | null {
  return io;
}
