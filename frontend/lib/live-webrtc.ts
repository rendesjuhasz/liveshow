export const LIVE_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function livePeerConfig(): RTCConfiguration {
    return {
        iceServers: LIVE_ICE_SERVERS,
        iceCandidatePoolSize: 4,
    };
}
