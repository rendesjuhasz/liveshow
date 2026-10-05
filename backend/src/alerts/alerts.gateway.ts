import {
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { ForbiddenException } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { liveIoGatewayOptions } from "../auth/live-io";
import { WsAuthService, type WsUser } from "../auth/ws-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminRole } from "../auth/roles";

@WebSocketGateway(liveIoGatewayOptions())
export class AlertsGateway implements OnGatewayConnection {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly wsAuth: WsAuthService,
        private readonly prisma: PrismaService,
    ) {}

    emitAlert(showId: string, payload: unknown) {
        if (!this.server || !showId) return;
        this.server.to(`alerts:${showId}`).emit("safety-alert", payload);
    }

    async handleConnection(client: Socket) {
        try {
            client.data.user = await this.wsAuth.userFromSocket(client);
        } catch {
            client.data.user = null;
        }
    }

    private userOf(client: Socket): WsUser {
        const user = client.data?.user as WsUser | undefined;
        if (!user?.id) {
            client.disconnect(true);
            throw new ForbiddenException("Hitelesítés szükséges.");
        }
        return user;
    }

    private async assertAlertRoom(user: WsUser, showId: string) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: { streamer: true },
        });
        if (!show) throw new ForbiddenException("A műsor nem található.");
        if (isAdminRole(user)) return;
        if (show.streamer?.userId !== user.id) {
            throw new ForbiddenException("Nincs jogosultság a riasztásokhoz.");
        }
    }

    @SubscribeMessage("alerts:join")
    async join(client: Socket, payload: { showId?: string }) {
        const id = String(payload?.showId || "").trim();
        if (!id) return { ok: false };
        try {
            const user = this.userOf(client);
            await this.assertAlertRoom(user, id);
            await client.join(`alerts:${id}`);
            return { ok: true, showId: id };
        } catch {
            return { ok: false };
        }
    }

    @SubscribeMessage("alerts:leave")
    leave(client: Socket, payload: { showId?: string }) {
        const id = String(payload?.showId || "").trim();
        if (!id) return;
        client.leave(`alerts:${id}`);
    }
}
