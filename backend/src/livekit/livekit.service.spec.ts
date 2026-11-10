import {
    ForbiddenException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import { LivekitService } from "./livekit.service";

jest.mock("livekit-server-sdk", () => ({
    AccessToken: jest.fn().mockImplementation(() => ({
        addGrant: jest.fn(),
        toJwt: jest.fn().mockResolvedValue("lk-jwt"),
    })),
}));

function makeService(published: "mesh" | "livekit" | null = null) {
    const prisma = {
        show: {
            findUnique: jest.fn(),
        },
    };
    const tickets = {
        assertCanWatch: jest.fn().mockResolvedValue(undefined),
    };
    const session = {
        get: jest.fn().mockReturnValue(published),
        set: jest.fn(),
        clear: jest.fn(),
    };
    const svc = new LivekitService(prisma as any, tickets as any, session as any);
    return { svc, prisma, tickets, session };
}

describe("LivekitService", () => {
    const prev: Record<string, string | undefined> = {};

    function setEnv(map: Record<string, string | undefined>) {
        for (const [key, value] of Object.entries(map)) {
            prev[key] = process.env[key];
            if (value == null) delete process.env[key];
            else process.env[key] = value;
        }
    }

    afterEach(() => {
        for (const [key, value] of Object.entries(prev)) {
            if (value == null) delete process.env[key];
            else process.env[key] = value;
        }
        for (const key of Object.keys(prev)) delete prev[key];
    });

    function withKeys() {
        setEnv({
            LIVEKIT_API_KEY: "devkey",
            LIVEKIT_API_SECRET: "devsecret",
            LIVEKIT_PUBLIC_URL: "wss://live.example",
            LIVEKIT_URL: "http://127.0.0.1:7880",
            LIVE_VIDEO_BACKEND: "livekit",
            LIVEKIT_SHOW_IDS: "",
            LIVEKIT_TOKEN_TTL_SEC: "3600",
        });
    }

    it("config reports mesh when keys are missing", () => {
        setEnv({
            LIVEKIT_API_KEY: "",
            LIVEKIT_API_SECRET: "",
            LIVEKIT_PUBLIC_URL: "",
            LIVEKIT_URL: "",
            LIVE_VIDEO_BACKEND: "livekit",
            LIVEKIT_SHOW_IDS: "",
        });
        const { svc } = makeService();
        const cfg = svc.config("show-1");
        expect(cfg.configured).toBe(false);
        expect(cfg.backend).toBeNull();
        expect(cfg.plannedBackend).toBe("mesh");
        expect(cfg.publisherActive).toBe(false);
    });

    it("config reports livekit for a show when keys exist", () => {
        withKeys();
        const { svc } = makeService();
        const cfg = svc.config("show-1");
        expect(cfg.configured).toBe(true);
        expect(cfg.backend).toBeNull();
        expect(cfg.plannedBackend).toBe("livekit");
        expect(cfg.url).toBe("wss://live.example");
    });

    it("config backend follows the live publisher, not the planned flag", () => {
        withKeys();
        const { svc } = makeService("mesh");
        const cfg = svc.config("show-1");
        expect(cfg.plannedBackend).toBe("livekit");
        expect(cfg.backend).toBe("mesh");
        expect(cfg.publisherActive).toBe(true);
    });

    it("refuses tokens when LiveKit is unconfigured", async () => {
        setEnv({
            LIVEKIT_API_KEY: "",
            LIVEKIT_API_SECRET: "",
            LIVEKIT_PUBLIC_URL: "",
            LIVEKIT_URL: "",
        });
        const { svc } = makeService();
        await expect(svc.issueToken({ id: "u1", role: "streamer" }, { showId: "s1", role: "publisher" })).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it("issues a publisher token to the show owner", async () => {
        withKeys();
        const { svc, prisma, tickets } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "u1" },
        });
        const issued = await svc.issueToken({ id: "u1", role: "streamer" }, { showId: "s1", role: "publisher" });
        expect(issued.token).toBe("lk-jwt");
        expect(issued.roomName).toBe("show:s1");
        expect(issued.role).toBe("publisher");
        expect(issued.identity).toBe("pub:u1");
        expect(issued.expiresIn).toBe(3600);
        expect(tickets.assertCanWatch).not.toHaveBeenCalled();
    });

    it("blocks publisher tokens for other viewers", async () => {
        withKeys();
        const { svc, prisma } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        await expect(
            svc.issueToken({ id: "viewer", role: "user" }, { showId: "s1", role: "publisher" }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("requires login for publisher tokens", async () => {
        withKeys();
        const { svc, prisma } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        await expect(svc.issueToken(null, { showId: "s1", role: "publisher" })).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });

    it("checks ticket access for viewer tokens", async () => {
        withKeys();
        const { svc, prisma, tickets } = makeService("livekit");
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        const issued = await svc.issueToken({ id: "v1", role: "user" }, { showId: "s1", role: "viewer" });
        expect(tickets.assertCanWatch).toHaveBeenCalledWith({ id: "v1", role: "user" }, "st1", "s1", "live");
        expect(issued.role).toBe("viewer");
        expect(issued.identity).toBe("view:v1");
    });

    it("gives anonymous viewers unique LiveKit identities", async () => {
        withKeys();
        const { svc, prisma } = makeService("livekit");
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        const a = await svc.issueToken(null, { showId: "s1", role: "viewer" });
        const b = await svc.issueToken(null, { showId: "s1", role: "viewer" });
        expect(a.identity).toMatch(/^guest:[a-z0-9]{32}$/);
        expect(b.identity).toMatch(/^guest:[a-z0-9]{32}$/);
        expect(a.identity).not.toBe("guest");
        expect(a.identity).not.toBe(b.identity);
        const keyed = await svc.issueToken(null, { showId: "s1", role: "viewer", viewerKey: "abcd1234" });
        expect(keyed.identity).toBe("guest:abcd1234");
    });

    it("refuses viewer tokens for a Mesh publisher", async () => {
        withKeys();
        const { svc, prisma, tickets } = makeService("mesh");
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        await expect(
            svc.issueToken({ id: "v1", role: "user" }, { showId: "s1", role: "viewer" }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(tickets.assertCanWatch).not.toHaveBeenCalled();
    });

    it("issues viewer tokens when LiveKit is planned, even before the publisher is live", async () => {
        withKeys();
        const { svc, prisma, tickets } = makeService();
        prisma.show.findUnique.mockResolvedValue({
            id: "s1",
            streamId: "st1",
            privateStreamId: null,
            streamer: { userId: "owner" },
        });
        const issued = await svc.issueToken({ id: "v1", role: "user" }, { showId: "s1", role: "viewer" });
        expect(tickets.assertCanWatch).toHaveBeenCalled();
        expect(issued.role).toBe("viewer");
    });

    it("rejects unknown shows", async () => {
        withKeys();
        const { svc, prisma } = makeService();
        prisma.show.findUnique.mockResolvedValue(null);
        await expect(
            svc.issueToken({ id: "u1" }, { showId: "missing", role: "viewer" }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
