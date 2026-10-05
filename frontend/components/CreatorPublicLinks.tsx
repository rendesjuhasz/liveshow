"use client";

import { useT } from "@/lib/i18n/I18nProvider";

type PublicLinkDraft = { label: string; url: string };

export default function CreatorPublicLinks({
    name,
    links,
}: {
    name?: string;
    links?: PublicLinkDraft[] | null;
}) {
    const { t } = useT();
    if (!links?.length) return null;
    const heading = name
        ? t("archive.creatorLinksNamed").replace("{name}", name)
        : t("archive.creatorLinks");
    return (
        <section className="mt-6 mb-2 rounded-2xl border border-white/10 bg-card p-4">
            <h2 className="mb-3 text-lg font-bold">{heading}</h2>
            <ul className="flex flex-wrap gap-2">
                {links.map((link) => (
                    <li key={`${link.label}-${link.url}`}>
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-white/15"
                        >
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}
