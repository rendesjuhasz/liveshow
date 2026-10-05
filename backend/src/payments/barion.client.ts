const TEST_API = "https://api.test.barion.com";
const PROD_API = "https://api.barion.com";

export function barionApiBase() {
    const env = String(process.env.BARION_ENV || "test").toLowerCase();
    return env === "prod" || env === "production" ? PROD_API : TEST_API;
}

function envFlag(name: string) {
    const value = String(process.env[name] || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
}

/** Csak akkor aktív, ha BARION_ENABLED=true és van POS Key + payee. Fejlesztéshez alapból ki van kapcsolva. */
export function barionEnabled() {
    return (
        envFlag("BARION_ENABLED") &&
        Boolean(process.env.BARION_POS_KEY?.trim() && process.env.BARION_PAYEE?.trim())
    );
}

export type BarionStartResult = {
    PaymentId: string;
    PaymentRequestId?: string;
    Status?: string;
    GatewayUrl?: string;
    Errors?: { Title?: string; Description?: string; ErrorCode?: string }[];
};

export type BarionStateResult = {
    PaymentId: string;
    PaymentRequestId?: string;
    Status?: string;
    Errors?: { Title?: string; Description?: string }[];
};

export async function barionStartPayment(body: Record<string, unknown>) {
    const response = await fetch(`${barionApiBase()}/v2/Payment/Start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as BarionStartResult;
    if (!response.ok || !data?.GatewayUrl || !data?.PaymentId) {
        const detail =
            data?.Errors?.map((e) => e.Description || e.Title).filter(Boolean).join("; ") ||
            `Barion hiba (${response.status})`;
        throw new Error(detail);
    }
    return data;
}

export async function barionGetPaymentState(paymentId: string) {
    const posKey = process.env.BARION_POS_KEY?.trim();
    const url = new URL(`${barionApiBase()}/v2/Payment/GetPaymentState`);
    url.searchParams.set("POSKey", String(posKey || ""));
    url.searchParams.set("PaymentId", paymentId);
    const response = await fetch(url);
    const data = (await response.json().catch(() => ({}))) as BarionStateResult;
    if (!response.ok) {
        const detail =
            data?.Errors?.map((e) => e.Description || e.Title).filter(Boolean).join("; ") ||
            `Barion állapotlekérdezés sikertelen (${response.status})`;
        throw new Error(detail);
    }
    return data;
}

export async function barionRefundPayment(opts: {
    barionPaymentId: string;
    amount: number;
    comment?: string;
}) {
    const state = (await barionGetPaymentState(opts.barionPaymentId)) as BarionStateResult & {
        Transactions?: { TransactionId?: string; POSTransactionId?: string }[];
    };
    const tx = state.Transactions?.[0];
    if (!tx?.TransactionId) {
        throw new Error("A Barion fizetéshez nincs visszautalható tranzakció.");
    }
    const response = await fetch(`${barionApiBase()}/v2/Payment/Refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            POSKey: process.env.BARION_POS_KEY,
            PaymentId: opts.barionPaymentId,
            TransactionsToRefund: [
                {
                    TransactionId: tx.TransactionId,
                    POSTransactionId: tx.POSTransactionId || `${opts.barionPaymentId}-t1`,
                    AmountToRefund: opts.amount,
                    Comment: opts.comment || "LiveShow visszatérítés",
                },
            ],
        }),
    });
    const data = (await response.json().catch(() => ({}))) as {
        Errors?: { Description?: string; Title?: string }[];
    };
    if (!response.ok) {
        const detail =
            data?.Errors?.map((e) => e.Description || e.Title).filter(Boolean).join("; ") ||
            `Barion visszatérítés sikertelen (${response.status})`;
        throw new Error(detail);
    }
    return data;
}
