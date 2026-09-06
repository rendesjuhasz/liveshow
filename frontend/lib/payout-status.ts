export function payoutStatusLabel(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "Folyamatban";
        case "paid":
            return "Kifizetve";
        case "rejected":
            return "Elutasítva";
        default:
            return "Függőben";
    }
}

export function payoutStatusClass(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "text-yellow-400";
        case "paid":
            return "text-green-400";
        case "rejected":
            return "text-red-400";
        default:
            return "text-neutral-300";
    }
}
