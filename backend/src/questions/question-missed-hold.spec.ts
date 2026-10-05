import { QuestionsService } from "./questions.service";

function makeService() {
    const tx = {
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma = {
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
    };
    const ticketGroups = { releaseQuestionHold: jest.fn().mockResolvedValue(2) };
    const follows = { recordOpen: jest.fn() };
    const svc = new QuestionsService(prisma as any, ticketGroups as any, follows as any);
    return { svc, prisma, tx, ticketGroups };
}

describe("markUnansweredMissedOnLiveStop", () => {
    it("releases question_hold tickets for missed questions", async () => {
        const { svc, tx, ticketGroups } = makeService();
        tx.$queryRaw.mockResolvedValueOnce([
            { id: "q1", userId: "u1" },
            { id: "q2", userId: "u1" },
        ]);
        jest.spyOn(svc as any, "writeAudit").mockResolvedValue(undefined);
        jest.spyOn(svc as any, "notify").mockResolvedValue(undefined);
        const result = await svc.markUnansweredMissedOnLiveStop("show-1");
        expect(result.updated).toBe(2);
        expect(ticketGroups.releaseQuestionHold).toHaveBeenCalledWith({ questionIds: ["q1", "q2"] }, tx);
    });

    it("does not touch holds when no pending questions remain", async () => {
        const { svc, tx, ticketGroups } = makeService();
        tx.$queryRaw.mockResolvedValueOnce([]);
        const result = await svc.markUnansweredMissedOnLiveStop("show-1");
        expect(result.updated).toBe(0);
        expect(ticketGroups.releaseQuestionHold).not.toHaveBeenCalled();
    });
});
