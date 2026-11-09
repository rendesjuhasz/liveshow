import { ForbiddenException } from "@nestjs/common";
import { StreamerDashboardService } from "./streamer-dashboard.service";

function makeDashboard(overrides?: { streamerId?: string }) {
    const show = {
        id: "show-1",
        streamerId: overrides?.streamerId || "owner",
        title: "Teszt",
        description: null,
        status: "active",
        startTime: new Date(Date.now() + 86_400_000),
        timezone: "Europe/Budapest",
        endTime: null,
        live: false,
    };
    const prisma = {
        show: {
            findUnique: jest.fn().mockResolvedValue(show),
            update: jest.fn().mockResolvedValue(show),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: "show-1", status: "active" }]),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const i18n = {
        persistShowTranslations: jest.fn().mockResolvedValue({ written: 1 }),
        contentFor: jest.fn().mockResolvedValue([]),
        groupedShowTranslations: jest.fn().mockReturnValue([]),
    };
    const noop = {} as never;
    const svc = new StreamerDashboardService(
        prisma as any,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        { countsByShowIds: async () => new Map(), peaksByShowIds: async () => new Map(), averageWatchByShowIds: async () => new Map(), liveByShow: () => new Map() } as any,
        noop,
        noop,
        i18n as any,
    );
    return { svc, prisma, i18n, show };
}

describe("show translation authorization", () => {
    it("lets the owner save translations", async () => {
        const { svc, i18n } = makeDashboard();
        await svc.updateShow({ id: "owner" } as any, "show-1", {
            translations: [{ locale: "en", title: "Hello" }],
        });
        expect(i18n.persistShowTranslations).toHaveBeenCalledWith(
            "show-1",
            [{ locale: "en", title: "Hello" }],
            "hu",
        );
    });

    it("forbids another streamer from writing translations", async () => {
        const { svc, i18n } = makeDashboard({ streamerId: "owner" });
        await expect(
            svc.updateShow({ id: "intruder" } as any, "show-1", {
                translations: [{ locale: "en", title: "Stolen" }],
            }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(i18n.persistShowTranslations).not.toHaveBeenCalled();
    });

    it("does not persist translations when loading another streamer's show", async () => {
        const { svc, i18n } = makeDashboard({ streamerId: "owner" });
        await expect(svc.getShow({ id: "intruder" } as any, "show-1")).rejects.toBeInstanceOf(
            ForbiddenException,
        );
        expect(i18n.contentFor).not.toHaveBeenCalled();
    });
});
