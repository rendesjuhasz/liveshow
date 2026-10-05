import { io, type Socket } from "socket.io-client";
import { apiFetch, apiSocketUrl, socketIoPath } from "@/api/http";

export async function fetchWsTicket() {
    const data = await apiFetch("/auth/ws-ticket");
    const token = String(data?.token || "").trim();
    if (!token) throw new Error("Hitelesítés szükséges.");
    return token;
}

export function liveSocketOptions(token = "") {
    const t = String(token || "").trim();
    const extraHeaders: Record<string, string> = {};
    if (t) extraHeaders.Authorization = `Bearer ${t}`;
    return {
        path: socketIoPath(),
        transports: ["websocket", "polling"],
        upgrade: true,
        addTrailingSlash: false as const,
        withCredentials: true,
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 30,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
        auth: t ? { token: t } : {},
        query: t ? { token: t } : {},
        extraHeaders,
    };
}

function applySocketToken(socket: Socket, token: string) {
    const t = String(token || "").trim();
    if (!t) return;
    socket.auth = { token: t };
    const opts = socket.io.opts as { query?: Record<string, string>; extraHeaders?: Record<string, string> };
    opts.query = { ...(opts.query || {}), token: t };
    opts.extraHeaders = { ...(opts.extraHeaders || {}), Authorization: `Bearer ${t}` };
}

export async function connectLiveSocket(requireAuth: boolean): Promise<Socket> {
    let token = "";
    if (requireAuth) {
        token = await fetchWsTicket();
    } else {
        try {
            token = await fetchWsTicket();
        } catch {
            token = "";
        }
    }
    const socket = io(apiSocketUrl(), liveSocketOptions(token));
    socket.io.on("reconnect_attempt", () => {
        void fetchWsTicket()
            .then((next) => applySocketToken(socket, next))
            .catch(() => undefined);
    });
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            if (socket.connected) {
                resolve();
                return;
            }
            socket.disconnect();
            reject(new Error("A jelzőszerver nem válaszol."));
        }, 12000);
        socket.once("connect", () => {
            clearTimeout(timer);
            resolve();
        });
        socket.once("connect_error", () => {
            /* wait for timeout / later connect */
        });
    });
    return socket;
}
