export type PayoutCycle = "weekly" | "monthly" | "per_show";

export const PAYOUT_CYCLES: PayoutCycle[] = ["weekly", "monthly", "per_show"];

export function isPayoutCycle(value: string): value is PayoutCycle {
    return (PAYOUT_CYCLES as readonly string[]).includes(value);
}

export function nextPayoutDueAt(cycle: PayoutCycle, from = new Date()): Date {
    const start = new Date(from);
    if (cycle === "weekly") {
        const day = start.getDay();
        const add = day === 1 ? 7 : (8 - day) % 7 || 7;
        const next = new Date(start);
        next.setDate(start.getDate() + add);
        next.setHours(9, 0, 0, 0);
        return next;
    }
    if (cycle === "monthly") {
        return new Date(start.getFullYear(), start.getMonth() + 1, 1, 9, 0, 0, 0);
    }
    return start;
}

export function payoutDueState(input: {
    cycle: PayoutCycle;
    available: number;
    now?: Date;
}) {
    const available = Math.max(0, Math.round(input.available || 0));
    const now = input.now || new Date();
    const nextAt = nextPayoutDueAt(input.cycle, now);
    if (available <= 0) {
        return {
            due: false,
            nextAt,
            label: "Nincs kifizethető egyenleg.",
        };
    }
    if (input.cycle === "per_show") {
        return {
            due: true,
            nextAt: now,
            label: "Műsoronkénti ciklus: a felhasznált jegyek után az összeg igényelhető.",
        };
    }
    const due = now.getTime() >= nextAt.getTime() - 24 * 60 * 60 * 1000;
    const when = nextAt.toLocaleString("hu-HU");
    return {
        due,
        nextAt,
        label: due
            ? `Kifizetés esedékes (ciklus: ${cycleLabel(input.cycle)}, határidő: ${when}).`
            : `Következő kifizetési ablak: ${when} (${cycleLabel(input.cycle)}).`,
    };
}

export function cycleLabel(cycle: PayoutCycle) {
    if (cycle === "weekly") return "heti";
    if (cycle === "monthly") return "havi";
    return "műsoronként";
}
