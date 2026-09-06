import { cycleLabel, isPayoutCycle, nextPayoutDueAt, payoutDueState } from "./payout-cycle";

describe("payout cycle", () => {
    it("accepts weekly, monthly and per-show", () => {
        expect(isPayoutCycle("weekly")).toBe(true);
        expect(isPayoutCycle("daily")).toBe(false);
        expect(cycleLabel("monthly")).toBe("havi");
    });

    it("marks per-show as due when there is a balance", () => {
        const due = payoutDueState({ cycle: "per_show", available: 1200 });
        expect(due.due).toBe(true);
        expect(payoutDueState({ cycle: "per_show", available: 0 }).due).toBe(false);
    });

    it("computes the next weekly and monthly windows", () => {
        const monday = nextPayoutDueAt("weekly", new Date("2026-09-07T12:00:00"));
        expect(monday.getDay()).toBe(1);
        const month = nextPayoutDueAt("monthly", new Date("2026-09-15T12:00:00"));
        expect(month.getMonth()).toBe(9);
        expect(month.getDate()).toBe(1);
    });
});
