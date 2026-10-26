"use client";

import Link from "next/link";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { useMounted } from "@/lib/use-mounted";

export default function AdminAccessGate({ children }: { children: React.ReactNode }) {
    const { user, ready, logout } = useAuth();
    const mounted = useMounted();

    // Do not replace `children` during SSR/hydration. The server already ran
    // requireAdminPage(); swapping to "Betöltés..." left the RSC children in the
    // HTML while the client tree rendered a different root (hydration mismatch).
    if (!mounted || !ready) {
        return <>{children}</>;
    }

    if (!user) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-gray-900 px-4 text-white">
                <div className="max-w-md text-center">
                    <p className="mb-4">Ez az admin felület, nem a nyilvános LiveShow.</p>
                    <Link href="/" className="text-accent underline">
                        Vissza a LiveShow főoldalra
                    </Link>
                </div>
            </div>
        );
    }

    if (!isAdmin(user)) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-gray-900 px-4 text-white">
                <div className="max-w-md text-center">
                    <p className="mb-2">Nincs admin jogosultság.</p>
                    <p className="mb-6 text-sm text-zinc-400">
                        Jelenlegi belépés: <strong className="text-white">{user.email}</strong>
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            type="button"
                            className="text-zinc-300 underline"
                            onClick={() => {
                                logout();
                                window.location.assign("/admin/login");
                            }}
                        >
                            Kilépés és admin belépés
                        </button>
                        <Link href="/" className="text-accent underline">
                            Vissza a főoldalra
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
