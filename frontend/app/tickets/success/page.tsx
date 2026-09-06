import { redirect } from "next/navigation";

export default async function TicketSuccessRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
        if (typeof value === "string") q.set(key, value);
    }
    const suffix = q.toString();
    redirect(`/payment/success${suffix ? `?${suffix}` : ""}`);
}
