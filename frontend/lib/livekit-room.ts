import {
    Room,
    RoomEvent,
    Track,
    ConnectionState,
    ConnectionQuality,
    VideoPresets,
} from "livekit-client";

export async function connectLivekitRoom(url: string, token: string) {
    const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
        },
        publishDefaults: {
            simulcast: true,
            videoCodec: "vp8",
            videoEncoding: VideoPresets.h720.encoding,
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        },
    });
    await room.connect(url, token, { autoSubscribe: true });
    return room;
}

export async function publishMediaStream(room: Room, stream: MediaStream) {
    for (const mediaTrack of stream.getTracks()) {
        if (mediaTrack.readyState === "ended") continue;
        await room.localParticipant.publishTrack(mediaTrack, {
            source: mediaTrack.kind === "video" ? Track.Source.Camera : Track.Source.Microphone,
            simulcast: mediaTrack.kind === "video",
        });
    }
}

export async function replaceLivekitTrack(room: Room, next: MediaStreamTrack) {
    const source = next.kind === "video" ? Track.Source.Camera : Track.Source.Microphone;
    const pub = room.localParticipant.getTrackPublication(source);
    const current = pub?.track;
    if (current && "replaceTrack" in current && typeof current.replaceTrack === "function") {
        await current.replaceTrack(next);
        return;
    }
    if (pub?.track) {
        await room.localParticipant.unpublishTrack(pub.track);
    }
    await room.localParticipant.publishTrack(next, { source, simulcast: next.kind === "video" });
}

export function attachRemoteTrack(track: { attach: (el: HTMLMediaElement) => HTMLMediaElement }, video: HTMLVideoElement) {
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    track.attach(video);
}

export async function disconnectLivekitRoom(room: Room | null) {
    if (!room) return;
    try {
        await room.disconnect();
    } catch {
        /* ignore */
    }
}

export { Room, RoomEvent, Track, ConnectionState, ConnectionQuality } from "livekit-client";
