import { socketCorsOrigin } from "./secrets";

/** Same-origin Next proxy path. Both gateways MUST share this so Nest reuses one Socket.IO server. */
export const LIVE_IO_PATH = "/live-io";

export function liveIoGatewayOptions() {
    return {
        path: LIVE_IO_PATH,
        cors: {
            origin: socketCorsOrigin(),
            credentials: true,
        },
        maxHttpBufferSize: 1_000_000,
        pingInterval: 20000,
        pingTimeout: 60000,
        transports: ["websocket", "polling"] as const,
    };
}
