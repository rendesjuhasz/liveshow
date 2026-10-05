"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { stripLocalePrefix } from "@/lib/i18n/paths";

export default function MainPad({ children }: { children: ReactNode }) {
    const path = usePathname();
    const flush = stripLocalePrefix(path || "/").path === "/";
    return (
        <div
            className={
                flush
                    ? ""
                    : "pt-[calc(4rem+env(safe-area-inset-top))]"
            }
        >
            {children}
        </div>
    );
}
