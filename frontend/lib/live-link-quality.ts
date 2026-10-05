export type LiveLinkQuality = "good" | "fair" | "poor" | "critical";

export type PreflightGrade = "excellent" | "good" | "weak" | "critical";

export function clockClass(q: LiveLinkQuality) {
    if (q === "good") return "text-emerald-400";
    if (q === "fair") return "text-yellow-300";
    if (q === "poor") return "text-orange-400";
    return "text-red-500";
}

export function gradeToLinkQuality(grade: PreflightGrade): LiveLinkQuality {
    if (grade === "excellent") return "good";
    if (grade === "good") return "fair";
    if (grade === "weak") return "poor";
    return "critical";
}

export function gradeLabel(grade: PreflightGrade) {
    if (grade === "excellent") return { emoji: "🟢", text: "Kiváló" };
    if (grade === "good") return { emoji: "🟡", text: "Jó" };
    if (grade === "weak") return { emoji: "🟠", text: "Gyenge" };
    return { emoji: "🔴", text: "Kritikus" };
}

export function formatPreflightAge(ageMs: number | null | undefined) {
    if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return "";
    const mins = Math.max(0, Math.round(ageMs / 60_000));
    if (mins < 1) return "Utolsó sikeres teszt: épp most";
    if (mins === 1) return "Utolsó sikeres teszt: 1 perce";
    if (mins < 60) return `Utolsó sikeres teszt: ${mins} perce`;
    const hours = Math.round(mins / 60);
    if (hours === 1) return "Utolsó sikeres teszt: 1 órája";
    return `Utolsó sikeres teszt: ${hours} órája`;
}
