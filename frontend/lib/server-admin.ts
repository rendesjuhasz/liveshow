import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAdminSession, isAdminLoginPath } from "@/lib/admin-session";

export { isAdminConsolePath, isAdminLoginPath } from "@/lib/admin-session";

export async function requireAdminPage() {
    const h = await headers();
    const path = h.get("x-liveshow-path") || "";
    if (isAdminLoginPath(path)) return;
    const jar = await cookies();
    const cookieHeader = jar
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
    const session = await fetchAdminSession(cookieHeader);
    if (session.kind === "admin") return;
    if (session.kind === "user") redirect("/admin/login?error=forbidden");
    redirect("/admin/login");
}
