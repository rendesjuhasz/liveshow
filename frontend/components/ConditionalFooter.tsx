"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isStudioChromePath } from "@/lib/roles";

export default function ConditionalFooter({ children }: { children: ReactNode }) {
    const pathname = usePathname() || "";
    if (isStudioChromePath(pathname)) return null;
    return <>{children}</>;
}
