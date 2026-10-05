"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { withLocalePrefix } from "@/lib/i18n/paths";

export default function LocaleLink({
    href,
    children,
    scroll,
    ...rest
}: LinkProps & { href: string; children?: ReactNode; className?: string; scroll?: boolean }) {
    const { locale } = useT();
    const next = typeof href === "string" && href.startsWith("/") ? withLocalePrefix(href, locale) : href;
    const home = href === "/";
    return (
        <Link href={next} scroll={scroll ?? (home ? false : true)} suppressHydrationWarning {...rest}>
            {children}
        </Link>
    );
}
