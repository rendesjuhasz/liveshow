import { MAX_PENDING_PER_USER } from "./question-filters";
import { isOpenQuestionStatus, planClusterResolution } from "./question-resolve";

class Mutex {
    private tail = Promise.resolve();

    run<T>(fn: () => Promise<T> | T) {
        const prev = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>((resolve) => {
            release = resolve;
        });
        return prev.then(async () => {
            try {
                return await fn();
            } finally {
                release();
            }
        });
    }
}

describe("question concurrency", () => {
    it("double fulfill charges one ticket after lock + open-status check", async () => {
        const row = { id: "q1", status: "pending", userId: "u1" };
        const lock = new Mutex();
        let spends = 0;

        const fulfill = () =>
            lock.run(() => {
                const plan = planClusterResolution([row], "fulfilled");
                if (plan.noop) return "noop";
                spends += 1;
                row.status = "fulfilled";
                return "spent";
            });

        const results = await Promise.all([fulfill(), fulfill(), fulfill()]);
        expect(results.filter((r) => r === "spent")).toHaveLength(1);
        expect(results.filter((r) => r === "noop")).toHaveLength(2);
        expect(spends).toBe(1);
        expect(row.status).toBe("fulfilled");
    });

    it("parallel reject and fulfill leave one terminal status and at most one spend", async () => {
        const outcomes = { fulfillWins: 0, rejectWins: 0 };
        for (let i = 0; i < 40; i++) {
            const row = { id: "q1", status: "pending", userId: "u1" };
            const lock = new Mutex();
            let spends = 0;

            const resolve = (next: "fulfilled" | "rejected") =>
                lock.run(() => {
                    const plan = planClusterResolution([row], next);
                    if (plan.noop) return "noop";
                    if (next === "fulfilled") spends += 1;
                    row.status = next;
                    return next;
                });

            await Promise.all([resolve("fulfilled"), resolve("rejected")]);
            expect(["fulfilled", "rejected"]).toContain(row.status);
            expect(isOpenQuestionStatus(row.status)).toBe(false);
            if (row.status === "fulfilled") {
                expect(spends).toBe(1);
                outcomes.fulfillWins += 1;
            } else {
                expect(spends).toBe(0);
                outcomes.rejectWins += 1;
            }
        }
        expect(outcomes.fulfillWins + outcomes.rejectWins).toBe(40);
    });

    it("pending limit holds under parallel submits with user+show lock", async () => {
        const pending: { status: string }[] = [];
        const lock = new Mutex();
        let accepted = 0;
        let rejected = 0;

        const submit = () =>
            lock.run(() => {
                const count = pending.filter((q) => q.status === "pending").length;
                if (count >= MAX_PENDING_PER_USER) {
                    rejected += 1;
                    return "limit";
                }
                pending.push({ status: "pending" });
                accepted += 1;
                return "ok";
            });

        const results = await Promise.all(Array.from({ length: 8 }, () => submit()));
        expect(results.filter((r) => r === "ok")).toHaveLength(MAX_PENDING_PER_USER);
        expect(pending).toHaveLength(MAX_PENDING_PER_USER);
        expect(accepted).toBe(MAX_PENDING_PER_USER);
        expect(rejected).toBe(8 - MAX_PENDING_PER_USER);
    });

    it("planClusterResolution no-ops fulfilled and rejected rows", () => {
        expect(planClusterResolution([{ id: "q1", status: "fulfilled", userId: "u1" }], "fulfilled").noop).toBe(
            true,
        );
        expect(planClusterResolution([{ id: "q1", status: "rejected", userId: "u1" }], "fulfilled").noop).toBe(
            true,
        );
        expect(planClusterResolution([{ id: "q1", status: "pending", userId: "u1" }], "fulfilled").noop).toBe(
            false,
        );
        expect(planClusterResolution([{ id: "q1", status: "approved", userId: "u1" }], "rejected").ids).toEqual([
            "q1",
        ]);
    });
});
