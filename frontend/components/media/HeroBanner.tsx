"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coverUrl, formatWhen, watchHref, type MediaItem } from "@/lib/media";
import { useT } from "@/lib/i18n/I18nProvider";
import { useMounted } from "@/lib/use-mounted";

export default function HeroBanner({ item }: { item: MediaItem }) {
    const { t } = useT();
    const mounted = useMounted();
    const watchTo = watchHref(item);
    const when = mounted ? formatWhen(item.startAtUtc || item.startTime) : "";

    return (
        <section className="relative min-h-[70dvh] w-full overflow-hidden md:min-h-[88vh]">
            <motion.img
                key={coverUrl(item)}
                src={coverUrl(item)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={false}
                animate={{ scale: 1 }}
                transition={{ duration: 12, ease: "linear" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-black/20 to-black/40" />

            <div className="relative z-10 flex min-h-[70dvh] max-w-3xl flex-col justify-end px-4 pb-16 pt-28 md:min-h-[88vh] md:px-10 md:pb-32 md:pt-32">
                {item.live && (
                    <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-md bg-live px-3 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-[0_6px_16px_rgba(255,59,48,0.4)]">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" />
                        {t("home.liveBadge")}
                    </span>
                )}
                <motion.h1
                    className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-6xl lg:text-7xl"
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {item.title}
                </motion.h1>
                <p className="mt-4 line-clamp-3 max-w-xl text-sm text-zinc-200 md:text-base">
                    {item.description || t("home.premiumDesc")}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-accent">
                    {item.videoCategoryLabel ? `${item.videoCategoryLabel} · ` : ""}
                    {item.live ? t("home.nowWatching") : when}
                    {item.streamer?.name ? ` · ${item.streamer.name}` : ""}
                </p>
                <div className="mt-6 flex w-full flex-col gap-3 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap">
                    <Button asChild variant="gold" size="lg" className="w-full sm:w-auto">
                        <Link href={watchTo}>
                            <Play className="size-5 fill-current" />
                            {t("home.watchNow")}
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                        <Link href={`/shows/${item.id}`}>
                            <Info className="size-5" />
                            {t("home.details")}
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
