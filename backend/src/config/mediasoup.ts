import type { WorkerSettings, RouterOptions, WebRtcTransportOptions } from "mediasoup/node/lib/types";
import config from "./index";

/**
 * Mediasoup worker settings.
 * Controls logging and RTC port range for media traffic.
 */
export const workerSettings: WorkerSettings = {
  logLevel: "warn",
  rtcMinPort: 10000,
  rtcMaxPort: 10100,
};

/**
 * Router media codecs.
 * Defines the audio/video codecs the SFU will support.
 */
export const routerOptions: RouterOptions = {
  mediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
      parameters: {
        minptime: 10,
        useinbandfec: 1,
      },
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {
        "x-google-start-bitrate": 1000,
      },
    },
  ],
};

/**
 * WebRTC transport options.
 * Configures ICE, DTLS, and network listen addresses for WebRTC connections.
 */
export const webRtcTransportOptions: WebRtcTransportOptions = {
  listenIps: [
    {
      ip: config.mediasoupListenIp,
      announcedIp: config.mediasoupAnnouncedIp || undefined,
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1000000,
  minimumAvailableOutgoingBitrate: 600000,
  maxSctpMessageSize: 262144,
  maxIncomingBitrate: 1500000,
};

/**
 * Maximum number of mediasoup workers to spawn.
 * Defaults to the number of available CPU cores.
 */
export const numWorkers = Math.min(
  require("os").cpus().length,
  4 // Cap at 4 workers for dev environments
);

export default {
  workerSettings,
  routerOptions,
  webRtcTransportOptions,
  numWorkers,
};
