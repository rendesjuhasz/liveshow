import {
    ForbiddenException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import { AccessToken } from "livekit-server-sdk";
import { PrismaService } from "../prisma/prisma.service";
import { TicketsService } from "../tickets/tickets.service";
import { isAdminUser } from "../auth/is-admin";
import { guestViewerId } from "../stats/viewer-id";
import { LiveVideoSessionService } from "./live-video-session";
import {
    livekitApiKey,
    livekitApiSecret,
    livekitKeysConfigured,
    livekitPublicUrl,
    livekitRoomName,
    livekitTokenTtlSec,
    liveVideoBackendDefault,
    livekitShowAllowlist,
    usesLivekitForShow,
    type LiveVideoBackend,
} from "./livekit-config";

export type LivekitRole = "publisher" | "viewer";

@Injectable()
export class LivekitService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tickets: TicketsService,
        private readonly session: LiveVideoSessionService,
    ) {}

    config(showId?: string) {
        const configured = livekitKeysConfigured();
        const id = String(showId || "").trim();
        const planned: LiveVideoBackend = id
            ? usesLivekitForShow(id)
                ? "livekit"
                : "mesh"
            : liveVideoBackendDefault();
        const published = id ? this.session.get(id) : null;
        return {
            backend: published,
            plannedBackend: planned,
            publisherActive: Boolean(published),
            configured,
            url: configured ? livekitPublicUrl() : "",
            allowlist: livekitShowAllowlist(),
            defaultBackend: liveVideoBackendDefault(),
        };
    }

    async issueToken(
        user: { id?: string; email?: string; role?: string } | null | undefined,
        input: { showId?: string; role?: string; viewerKey?: string },
    ) {
        if (!livekitKeysConfigured()) {
            throw new ServiceUnavailableException(
                "A LiveKit nincs beállítva (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_PUBLIC_URL).",
            );
        }

        const showId = String(input.showId || "").trim();
        if (!showId) {
            throw new NotFoundException("A műsor azonosító kötelező.");
        }

        const role: LivekitRole = input.role === "publisher" ? "publisher" : "viewer";
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: { streamer: { select: { userId: true } } },
        });
        if (!show) throw new NotFoundException("A műsor nem található.");

        const streamId = String(show.streamId || show.privateStreamId || "").trim();
        if (!streamId) {
            throw new ForbiddenException("Ehhez a műsorhoz nincs stream.");
        }

        const userId = String(user?.id || "").trim();
        const isOwner = Boolean(userId && show.streamer?.userId === userId);
        const admin = isAdminUser(user);

        if (role === "publisher") {
            if (!userId) throw new UnauthorizedException("Bejelentkezés szükséges.");
            if (!isOwner && !admin) {
                throw new ForbiddenException("Csak a műsor tartalomkészítője indíthat kamerás adást.");
            }
        } else {
            const published = this.session.get(showId);
            if (published !== "livekit") {
                throw new ForbiddenException("Ehhez a műsorhoz most nincs LiveKit adás.");
            }
            await this.tickets.assertCanWatch(user, streamId, showId, "live");
        }

        const identity =
            role === "publisher"
                ? `pub:${userId}`
                : userId
                  ? `view:${userId}`
                  : guestViewerId(input.viewerKey);
        const room = livekitRoomName(showId);
        const ttl = livekitTokenTtlSec();
        const at = new AccessToken(livekitApiKey(), livekitApiSecret(), {
            identity,
            ttl,
            name: role === "publisher" ? "publisher" : "viewer",
            metadata: JSON.stringify({ showId, role, streamId }),
        });
        at.addGrant({
            roomJoin: true,
            room,
            canPublish: role === "publisher",
            canSubscribe: true,
            canPublishData: role === "publisher",
        });
        const token = await Promise.resolve(at.toJwt());

        return {
            url: livekitPublicUrl(),
            token,
            roomName: room,
            role,
            showId,
            streamId,
            identity,
            expiresIn: ttl,
            backend: "livekit" as const,
        };
    }
}
