import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { corsOrigins } from "../auth/secrets";

@WebSocketGateway({
    cors: {
        origin: corsOrigins(),
        credentials: true,
    },
})
export class WebrtcGateway {
    @WebSocketServer()
    server!: Server;

    @SubscribeMessage("offer")
    handleOffer(client: Socket, payload: { showId?: string }) {
        const room = String(payload?.showId || "").trim();
        if (!room) return;
        client.join(room);
        client.to(room).emit("offer", payload);
    }

    @SubscribeMessage("answer")
    handleAnswer(client: Socket, payload: { showId?: string }) {
        const room = String(payload?.showId || "").trim();
        if (!room) return;
        client.join(room);
        client.to(room).emit("answer", payload);
    }

    @SubscribeMessage("ice")
    handleIce(client: Socket, payload: { showId?: string }) {
        const room = String(payload?.showId || "").trim();
        if (!room) return;
        client.join(room);
        client.to(room).emit("ice", payload);
    }
}
