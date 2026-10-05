import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { execFile } from "child_process";
import { promisify } from "util";
import { unlinkSync, writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OpsService } from "../ops/ops.service";
import { gradePreflight, type PreflightMetrics } from "./preflight-grade";
import { PreflightSaveDto } from "../dto/bodies";
import type { Prisma } from "@prisma/client";

const execFileAsync = promisify(execFile);
const TMP = join(process.cwd(), "uploads", "preflight-tmp");

@Injectable()
export class PreflightService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ops: OpsService,
    ) {}

    async onModuleInit() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightAt" TIMESTAMP(3)`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightGrade" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "lastPreflightJson" JSONB`,
        ).catch(() => undefined);
        if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
    }

    echo() {
        return { t: Date.now(), status: "ok" as const };
    }

    async ingestStatus() {
        const live = this.ops.live();
        const livekit = await this.ops.checkLivekit();
        const livekitRequired = this.ops.requireLivekit();
        return {
            ok: live.status === "ok" && (!livekitRequired || livekit.status === "ok"),
            service: live.service,
            uptimeSec: live.uptimeSec,
            livekit,
            livekitRequired,
        };
    }

    last(streamerId: string) {
        return this.prisma.streamer
            .findUnique({
                where: { id: streamerId },
                select: {
                    lastPreflightAt: true,
                    lastPreflightGrade: true,
                    lastPreflightJson: true,
                },
            })
            .then((row) => this.toLastDto(row));
    }

    async save(streamerId: string, body: PreflightSaveDto) {
        const metrics: PreflightMetrics = {
            cameraOk: Boolean(body.cameraOk),
            micOk: Boolean(body.micOk),
            networkOk: Boolean(body.networkOk),
            ingestOk: Boolean(body.ingestOk),
            videoPackets: Boolean(body.videoPackets),
            audioPackets: Boolean(body.audioPackets),
            pingMs: body.pingMs ?? null,
            jitterMs: body.jitterMs ?? null,
            lossPct: body.lossPct ?? null,
            uploadMbps: body.uploadMbps ?? null,
        };
        const advice = gradePreflight(metrics);
        const snapshot = {
            ...metrics,
            ...advice,
            at: new Date().toISOString(),
        };
        const success =
            advice.grade !== "critical" &&
            metrics.cameraOk &&
            metrics.micOk &&
            metrics.networkOk &&
            metrics.ingestOk;
        if (success) {
            await this.prisma.streamer.update({
                where: { id: streamerId },
                data: {
                    lastPreflightAt: new Date(),
                    lastPreflightGrade: advice.grade,
                    lastPreflightJson: snapshot as Prisma.InputJsonValue,
                },
            });
        }
        const last = await this.last(streamerId);
        return { ...advice, metrics, last };
    }

    receiveUpload(bytes: number, startedAt: number) {
        const elapsedMs = Math.max(1, Date.now() - startedAt);
        const mbps = (bytes * 8) / elapsedMs / 1000;
        return { bytes, elapsedMs, uploadMbps: Math.round(mbps * 100) / 100 };
    }

    async inspectProbe(file: { buffer?: Buffer; path?: string; size?: number; mimetype?: string } | undefined) {
        if (!file?.buffer && !file?.path) {
            throw new BadRequestException("A próba felvétel hiányzik.");
        }
        const buf = file.buffer || null;
        if (buf && buf.length < 2048) {
            throw new BadRequestException("A próba stream túl rövid.");
        }
        let tmp = file.path || "";
        const created = !tmp && buf;
        if (created && buf) {
            if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
            tmp = join(TMP, `${randomUUID()}.webm`);
            writeFileSync(tmp, buf);
        }
        try {
            const probed = await this.ffprobe(tmp);
            return {
                ok: probed.video && probed.audio,
                video: probed.video,
                audio: probed.audio,
                size: buf?.length || file.size || 0,
                mime: file.mimetype || "",
            };
        } finally {
            if (created && tmp) {
                try {
                    unlinkSync(tmp);
                } catch {
                    /* ignore */
                }
            }
        }
    }

    private async ffprobe(filePath: string) {
        try {
            const { stdout } = await execFileAsync(
                "ffprobe",
                ["-v", "error", "-show_entries", "stream=codec_type", "-of", "json", filePath],
                { timeout: 8000, windowsHide: true },
            );
            const parsed = JSON.parse(String(stdout || "{}")) as { streams?: { codec_type?: string }[] };
            const types = new Set((parsed.streams || []).map((s) => String(s.codec_type || "")));
            return { video: types.has("video"), audio: types.has("audio") };
        } catch {
            const sniff = this.sniffContainer(filePath);
            return { video: sniff, audio: sniff };
        }
    }

    private sniffContainer(filePath: string) {
        try {
            const head = readFileSync(filePath).subarray(0, 16);
            if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
            if (head.slice(4, 8).toString("ascii") === "ftyp") return true;
            return false;
        } catch {
            return false;
        }
    }

    private toLastDto(
        row: {
            lastPreflightAt: Date | null;
            lastPreflightGrade: string | null;
            lastPreflightJson: unknown;
        } | null,
    ) {
        const at = row?.lastPreflightAt ? row.lastPreflightAt.toISOString() : null;
        const ageMs = at ? Date.now() - new Date(at).getTime() : null;
        return {
            lastPreflightAt: at,
            lastPreflightGrade: row?.lastPreflightGrade || null,
            lastPreflight: row?.lastPreflightJson || null,
            stale: ageMs != null ? ageMs > 15 * 60_000 : true,
            ageMs,
        };
    }
}
