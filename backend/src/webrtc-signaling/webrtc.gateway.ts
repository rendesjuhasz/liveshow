import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { ForbiddenException, Logger, OnModuleDestroy } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { liveIoGatewayOptions } from "../auth/live-io";
import { WsAuthService, type WsUser } from "../auth/ws-auth.service";
import { TicketsService } from "../tickets/tickets.service";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminRole } from "../auth/roles";
import { LivePreviewService } from "./live-preview.service";
import { LiveReactionStore, parseReactionPayload } from "./live-reactions";
import { LiveVideoSessionService } from "../livekit/live-video-session";
import { parseLiveVideoBackend, plannedLiveVideoBackend } from "../livekit/livekit-config";

@WebSocketGateway(liveIoGatewayOptions())
export class WebrtcGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer()
    server!: Server;

    private readonly log = new Logger(WebrtcGateway.name);
    private publishers = new Map<string, string>();
    private publisherGrace = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly reactions = new LiveReactionStore();
    private static readonly PUBLISHER_GRACE_MS = 15_000;

    constructor(
        private readonly wsAuth: WsAuthService,
        private readonly tickets: TicketsService,
        private readonly prisma: PrismaService,
        private readonly preview: LivePreviewService,
        private readonly videoSession: LiveVideoSessionService,
    ) {}

    onModuleDestroy() {
        for (const timer of this.publisherGrace.values()) clearTimeout(timer);
        this.publisherGrace.clear();
    }

    private emitReactionCounts(showId: string) {
        const payload = { type: "reactions", counts: this.reactions.snapshot(showId), ts: Date.now() };
        this.server.to(`pub:${showId}`).emit("live:reactions", payload);
        const pub = this.publishers.get(showId);
        if (pub) this.server.to(pub).emit("live:reactions", payload);
    }

    emitChat(showId: string, payload: unknown) {
        if (!this.server || !showId) return;
        this.server.to(`chat:${showId}`).emit("live:chat", payload);
        this.server.to(`view:${showId}`).emit("live:chat", payload);
        this.server.to(`pub:${showId}`).emit("live:chat", payload);
    }

    async handleConnection(client: Socket) {
        try {
            client.data.user = await this.wsAuth.userFromSocket(client);
            client.data.authError = "";
        } catch (err: unknown) {
            client.data.user = null;
            client.data.authError = err instanceof Error ? err.message : "Hitelesítés szükséges.";
        }
    }

    handleDisconnect(client: Socket) {
        for (const [showId, socketId] of this.publishers) {
            if (socketId !== client.id) continue;
            this.publishers.delete(showId);
            this.armPublisherGrace(showId);
        }
        const viewShowId = String(client.data.viewShowId || "");
        if (viewShowId) {
            const pub = this.publishers.get(viewShowId);
            if (pub) this.server.to(pub).emit("live:viewer-left", { viewerId: client.id });
        }
    }

    private clearPublisherGrace(showId: string) {
        const timer = this.publisherGrace.get(showId);
        if (timer) clearTimeout(timer);
        this.publisherGrace.delete(showId);
    }

    private armPublisherGrace(showId: string) {
        this.clearPublisherGrace(showId);
        this.log.warn(`Publisher socket dropped (${showId}); waiting ${WebrtcGateway.PUBLISHER_GRACE_MS}ms to reconnect`);
        this.publisherGrace.set(
            showId,
            setTimeout(() => {
                this.publisherGrace.delete(showId);
                if (this.publishers.has(showId)) return;
                this.reactions.clear(showId);
                this.videoSession.clear(showId);
                this.server.to(`view:${showId}`).emit("live:ended");
                this.log.warn(`Publisher gone (${showId}); viewers notified`);
            }, WebrtcGateway.PUBLISHER_GRACE_MS),
        );
    }

    private async userOf(client: Socket): Promise<WsUser> {
        const cached = client.data?.user as WsUser | undefined;
        if (cached?.id) return cached;
        try {
            const user = await this.wsAuth.userFromSocket(client);
            client.data.user = user;
            client.data.authError = "";
            return user;
        } catch (err: unknown) {
            const message =
                (typeof client.data?.authError === "string" && client.data.authError) ||
                (err instanceof Error ? err.message : "") ||
                "Hitelesítés szükséges. Lépj be újra tartalomkészítőként.";
            throw new ForbiddenException(message);
        }
    }

    private async assertPublisher(user: WsUser, showId: string) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: { streamer: { select: { userId: true } } },
        });
        if (!show) throw new ForbiddenException("A műsor nem található.");
        const owner = show.streamer?.userId === user.id;
        if (!owner && !isAdminRole(user)) {
            throw new ForbiddenException("Csak a műsor tartalomkészítője indíthat kamerás adást.");
        }
        return show;
    }

    @SubscribeMessage("preflight:ping")
    async handlePreflightPing(client: Socket) {
        try {
            await this.userOf(client);
            return { ok: true, t: Date.now() };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Hitelesítés szükséges.";
            client.emit("live:error", { message });
            return { ok: false, message };
        }
    }

    @SubscribeMessage("live:publisher")
    async handlePublisher(client: Socket, payload: { showId?: string; videoBackend?: string }) {
        try {
            const showId = String(payload?.showId || "").trim();
            if (!showId) return;
            const user = await this.userOf(client);
            await this.assertPublisher(user, showId);
            if (!this.publishers.has(showId) && !this.publisherGrace.has(showId)) {
                this.reactions.reset(showId);
            }
            this.clearPublisherGrace(showId);
            const planned = plannedLiveVideoBackend(showId);
            const videoBackend = parseLiveVideoBackend(payload?.videoBackend);
            if (videoBackend && videoBackend !== planned) {
                client.emit("live:error", {
                    message: "Az élő videó útvonal nem egyezik a műsor beállításával.",
                });
                return;
            }
            this.publishers.set(showId, client.id);
            this.videoSession.set(showId, videoBackend || planned);
            await client.join(`pub:${showId}`);
            client.emit("live:reactions", {
                type: "reactions",
                counts: this.reactions.snapshot(showId),
                ts: Date.now(),
            });
            const viewers = await this.server.in(`view:${showId}`).fetchSockets();
            for (const viewer of viewers) {
                client.emit("live:viewer", { viewerId: viewer.id });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "A kamerás adás nem indult el.";
            client.emit("live:error", { message });
        }
    }

    @SubscribeMessage("live:viewer")
    async handleViewer(client: Socket, payload: { showId?: string }) {
        try {
            const showId = String(payload?.showId || "").trim();
            if (!showId) return;
            const show = await this.prisma.show.findUnique({ where: { id: showId } });
            if (!show) throw new ForbiddenException("A műsor nem található.");
            const streamId = String(show.streamId || show.privateStreamId || "").trim();
            if (!streamId) throw new ForbiddenException("Ehhez a műsorhoz nincs stream.");
            const feature = show.privateStreamId && streamId === show.privateStreamId ? "privateStream" : "live";
            const user = (client.data?.user as WsUser | undefined) || null;
            await this.tickets.assertCanWatch(user, streamId, showId, feature);
            client.data.viewShowId = showId;
            await client.join(`view:${showId}`);
            const pub = this.publishers.get(showId);
            if (pub) this.server.to(pub).emit("live:viewer", { viewerId: client.id });
            this.server.to(`pub:${showId}`).emit("live:viewer", { viewerId: client.id });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "A nézés nem engedélyezett.";
            client.emit("live:error", { message });
        }
    }

    @SubscribeMessage("live:chat-join")
    async handleChatJoin(client: Socket, payload: { showId?: string }) {
        const showId = String(payload?.showId || "").trim();
        if (!showId) return { ok: false };
        await client.join(`chat:${showId}`);
        return { ok: true, showId };
    }

    @SubscribeMessage("live:offer")
    handleOffer(client: Socket, payload: { showId?: string; viewerId?: string; sdp?: unknown }) {
        const showId = String(payload?.showId || "").trim();
        const viewerId = String(payload?.viewerId || "").trim();
        if (!showId || !viewerId || this.publishers.get(showId) !== client.id) return;
        const packet = { sdp: payload.sdp, viewerId };
        this.server.to(viewerId).emit("live:offer", packet);
        this.server.to(`view:${showId}`).emit("live:offer", packet);
    }

    @SubscribeMessage("live:answer")
    handleAnswer(client: Socket, payload: { showId?: string; sdp?: unknown }) {
        const showId = String(payload?.showId || "").trim();
        const pub = this.publishers.get(showId);
        if (!showId || !pub) return;
        this.server.to(pub).emit("live:answer", { viewerId: client.id, sdp: payload.sdp });
        this.server.to(`pub:${showId}`).emit("live:answer", { viewerId: client.id, sdp: payload.sdp });
    }

    @SubscribeMessage("live:ice")
    handleIce(
        client: Socket,
        payload: { showId?: string; viewerId?: string; candidate?: unknown; from?: string },
    ) {
        const showId = String(payload?.showId || "").trim();
        if (!showId) return;
        if (payload.from === "pub") {
            if (this.publishers.get(showId) !== client.id) return;
            const viewerId = String(payload.viewerId || "").trim();
            if (!viewerId) return;
            const packet = { candidate: payload.candidate, viewerId };
            this.server.to(viewerId).emit("live:ice", packet);
            this.server.to(`view:${showId}`).emit("live:ice", packet);
            return;
        }
        const pub = this.publishers.get(showId);
        if (pub) this.server.to(pub).emit("live:ice", { viewerId: client.id, candidate: payload.candidate });
        this.server.to(`pub:${showId}`).emit("live:ice", { viewerId: client.id, candidate: payload.candidate });
    }

    @SubscribeMessage("live:frame")
    handleFrame(client: Socket, payload: { showId?: string; mime?: string; data?: string }) {
        const showId = String(payload?.showId || "").trim();
        if (!showId || this.publishers.get(showId) !== client.id) return;
        const data = String(payload?.data || "");
        if (!data || data.length > 900_000) return;
        const mime = String(payload?.mime || "image/jpeg");
        this.preview.put(showId, mime, data);
            this.server.to(`view:${showId}`).emit("live:frame", {
            mime,
            data,
        });
    }

    @SubscribeMessage("live:reaction")
    handleReaction(
        client: Socket,
        payload: {
            type?: string;
            reactionType?: string;
            value?: string;
            emoji?: string;
            streamId?: string;
            showId?: string;
        },
    ) {
        const parsed = parseReactionPayload(payload || {});
        const showId = String(client.data?.viewShowId || "").trim();
        const claimedShow = String(payload?.showId || "").trim();
        if (!parsed.countKey || !showId) return;
        if (claimedShow && claimedShow !== showId) return;
        const viewerKey = String((client.data?.user as WsUser | undefined)?.id || client.id || "");
        if (!this.reactions.allowRate(`${showId}:${viewerKey}`)) return;
        const counts = this.reactions.add(showId, parsed.countKey);
        const packet = {
            type: "reaction" as const,
            reactionType: parsed.reactionType,
            value: parsed.value,
            emoji: parsed.reactionType === "emoji" ? parsed.value : undefined,
            ts: Date.now(),
            counts,
        };
        if (parsed.animate && this.reactions.shouldAnimate(showId)) {
            this.server.to(`pub:${showId}`).emit("live:reaction", packet);
            const pub = this.publishers.get(showId);
            if (pub) this.server.to(pub).emit("live:reaction", packet);
        } else if (this.reactions.shouldSnapshot(showId)) {
            this.emitReactionCounts(showId);
        }
    }
}
