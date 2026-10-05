import { apiFetch } from "@/api/http";

export async function fetchLanIps(): Promise<string[]> {
    try {
        const data = await apiFetch("/health/lan");
        const rows = Array.isArray(data?.ips) ? data.ips : [];
        return rows.map((ip: unknown) => String(ip || "").trim()).filter(Boolean);
    } catch {
        return [];
    }
}

function isLoopbackAddr(addr: string) {
    return addr === "127.0.0.1" || addr === "0.0.0.0" || addr === "::1" || addr.startsWith("127.");
}

export function expandIceCandidate(
    candidate: RTCIceCandidateInit,
    lanIps: string[],
): RTCIceCandidateInit[] {
    const out: RTCIceCandidateInit[] = [candidate];
    const line = String(candidate.candidate || "");
    const m = line.match(/^(candidate:\S+\s+\d+\s+\S+\s+\d+\s+)(\S+)(\s+\d+\s+typ\s+\S+.*)$/i);
    if (!m || lanIps.length === 0) return out;
    const addr = m[2];
    if (!isLoopbackAddr(addr)) return out;
    for (const ip of lanIps) {
        out.push({
            ...candidate,
            candidate: `${m[1]}${ip}${m[3]}`,
        });
    }
    return out;
}

export function rewriteSdpForLan(sdp: string, lanIps: string[]): string {
    if (!sdp || lanIps.length === 0) return sdp;
    const ip = lanIps[0];
    return sdp
        .split("\n")
        .map((line) => {
            if (!line.startsWith("a=candidate:")) return line;
            const m = line.match(/^(a=candidate:\S+\s+\d+\s+\S+\s+\d+\s+)(\S+)(\s+\d+\s+typ\s+\S+.*)$/i);
            if (!m) return line;
            if (!isLoopbackAddr(m[2])) return line;
            return `${m[1]}${ip}${m[3]}`;
        })
        .join("\n");
}

export function emitIce(
    send: (candidate: RTCIceCandidateInit) => void,
    candidate: RTCIceCandidate | null,
    lanIps: string[],
) {
    if (!candidate) return;
    const init = candidate.toJSON();
    for (const item of expandIceCandidate(init, lanIps)) {
        send(item);
    }
}
