export function ticketStatusLabelHu(status?: string | null) {
    switch (String(status || "").trim().toLowerCase()) {
        case "pending":
            return "Fizetésre vár";
        case "paid":
            return "Fizetve";
        case "failed":
            return "Sikertelen fizetés";
        case "cancelled":
            return "Megszakítva";
        case "refunded":
            return "Visszatérítve";
        case "active":
            return "Aktív jegy";
        case "used":
            return "Felhasználva";
        default:
            return status || "-";
    }
}

export function isTicketActiveStatus(status?: string | null) {
    const value = String(status || "").trim().toLowerCase();
    return value === "paid" || value === "active";
}
