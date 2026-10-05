"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { appSurfaceKey } from "@/lib/roles";
import { useT } from "@/lib/i18n/I18nProvider";

export default function RoleDocumentTitle() {
    const pathname = usePathname();
    const { t } = useT();
    const title = `${t(appSurfaceKey(pathname))} · LiveShow`;

    useLayoutEffect(() => {
        const apply = () => {
            if (document.title !== title) document.title = title;
        };
        apply();
        const tag = document.querySelector("title");
        const observer = new MutationObserver(apply);
        observer.observe(tag || document.head, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        return () => observer.disconnect();
    }, [title]);

    return null;
}
