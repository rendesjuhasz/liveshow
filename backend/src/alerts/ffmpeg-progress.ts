export type EncoderHealth = {
    fps?: number;
    bitrateKbps?: number;
    dropped?: number;
    speed?: number;
    stall?: boolean;
    updatedAt: number;
    lastLine?: string;
};

export function parseFfmpegProgress(chunk: string): Partial<EncoderHealth> {
    const text = String(chunk || "");
    const fps = text.match(/\bfps=\s*([\d.]+)/i);
    const br = text.match(/\bbitrate=\s*([\d.]+)\s*kbits/i);
    const drop = text.match(/\bdrop=\s*(\d+)/i);
    const speed = text.match(/\bspeed=\s*([\d.]+)x/i);
    const stall = /Connection timed out|No UDP|Invalid data found|error while decoding|Conversion failed/i.test(text);
    const out: Partial<EncoderHealth> = {};
    if (fps) out.fps = Number(fps[1]);
    if (br) out.bitrateKbps = Number(br[1]);
    if (drop) out.dropped = Number(drop[1]);
    if (speed) out.speed = Number(speed[1]);
    if (stall) out.stall = true;
    if (text.trim()) out.lastLine = text.trim().slice(-240);
    return out;
}
