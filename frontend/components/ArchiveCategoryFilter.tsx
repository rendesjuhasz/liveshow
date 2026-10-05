"use client";

import Link from "next/link";
import { VIDEO_CATEGORIES, videoCategoryHref } from "@/lib/video-categories";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ArchiveCategoryFilter({ active }: { active?: string | null }) {
    const { t } = useT();
    return (
        <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-zinc-300">{t("cat.heading")}</p>
            <div className="flex flex-wrap gap-2">
                <Link
                    href="/archive"
                    className={`rounded-full px-3 py-1.5 text-sm ${
                        !active
                            ? "bg-primary text-[#0b1220] font-semibold shadow-[0_6px_16px_rgba(0,194,255,0.22)]"
                            : "bg-card text-muted shadow-md hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]"
                    }`}
                >
                    {t("cat.all")}
                </Link>
                {VIDEO_CATEGORIES.map((item) => (
                    <Link
                        key={item.value}
                        href={videoCategoryHref(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                            active === item.value
                                ? "bg-primary text-[#0b1220] font-semibold shadow-[0_6px_16px_rgba(0,194,255,0.22)]"
                                : "bg-card text-muted shadow-md hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]"
                        }`}
                    >
                        {t(`cat.${item.value}`)}
                    </Link>
                ))}
            </div>
        </div>
    );
}
