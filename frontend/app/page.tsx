"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import HeroBanner from "@/components/media/HeroBanner";
import MediaRow from "@/components/media/MediaRow";
import { isUpcoming, mediaId, type MediaItem } from "@/lib/media";
import { getFavorites, getWatched } from "@/lib/library";
import FaqList, { type FaqItem } from "@/components/FaqList";
import WishWall from "@/components/WishWall";
import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";

function uniq(items: MediaItem[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const id = mediaId(item);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export default function HomePage() {
    const { user } = useAuth();
    const { t, locale } = useT();
    const [featured, setFeatured] = useState<MediaItem[]>([]);
    const [all, setAll] = useState<MediaItem[]>([]);
    const [live, setLive] = useState<MediaItem[]>([]);
    const [archives, setArchives] = useState<MediaItem[]>([]);
    const [popular, setPopular] = useState<MediaItem[]>([]);
    const [favs, setFavs] = useState<MediaItem[]>([]);
    const [watched, setWatched] = useState<MediaItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function loadLive() {
            try {
                const d = await apiFetch("/shows/live");
                if (!cancelled) setLive(Array.isArray(d) ? d : []);
            } catch {
                if (!cancelled) setLive([]);
            }
        }
        apiFetch("/shows/featured").then((d) => setFeatured(Array.isArray(d) ? d : [])).catch(() => []);
        apiFetch("/shows").then((d) => setAll(Array.isArray(d) ? d : [])).catch(() => []);
        loadLive();
        const t = setInterval(loadLive, 8000);
        apiFetch("/archives")
            .then((d) =>
                setArchives(
                    (Array.isArray(d) ? d : []).map((a: any) => ({
                        id: a.showId,
                        showId: a.showId,
                        title: a.title,
                        startTime: a.startTime,
                        image: a.image,
                        streamer: a.streamer ? { name: a.streamer } : null,
                        ended: true,
                        viewCount: Number(a.viewCount) || 0,
                    })),
                ),
            )
            .catch(() => []);
        apiFetch("/archives?sort=popular")
            .then((d) =>
                setPopular(
                    (Array.isArray(d) ? d : []).slice(0, 18).map((a: any) => ({
                        id: a.showId,
                        showId: a.showId,
                        title: a.title,
                        startTime: a.startTime,
                        image: a.image,
                        streamer: a.streamer ? { name: a.streamer } : null,
                        ended: true,
                        viewCount: Number(a.viewCount) || 0,
                    })),
                ),
            )
            .catch(() => []);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [locale]);

    useEffect(() => {
        setFavs(getFavorites(user?.id).map((f) => ({ id: f.id, title: f.title, image: f.image, startTime: f.startTime })));
        setWatched(getWatched(user?.id).map((f) => ({ id: f.id, title: f.title, image: f.image, startTime: f.startTime })));
    }, [user?.id]);

    const hero = featured[0] || live[0] || all[0];
    const upcoming = useMemo(() => uniq(all.filter((s) => isUpcoming(s))), [all]);

    return (
        <div className="overflow-x-hidden pb-16">
            {hero ? (
                <HeroBanner item={hero} />
            ) : (
                <section className="flex min-h-[55dvh] items-end px-4 pb-16 pt-24 md:min-h-[70vh] md:px-10 md:pb-24 md:pt-32">
                    <div>
                        <h1 className="text-4xl font-extrabold sm:text-5xl md:text-7xl">LiveShow</h1>
                        <p className="mt-4 max-w-lg text-zinc-400">{t("home.empty")}</p>
                    </div>
                </section>
            )}

            <div className="-mt-10 relative z-20 space-y-2">
                <MediaRow title={t("home.featured")} items={uniq(featured.length ? featured : all.slice(0, 12))} />
                <MediaRow title={t("home.soon")} items={upcoming} />
                <MediaRow
                    title={t("home.liveStreams")}
                    items={live}
                    hrefFor={(item) => `/live/${mediaId(item)}`}
                    wide
                />
                <MediaRow
                    title={t("home.popularEvents")}
                    items={popular}
                    hrefFor={(item) => `/archive/${mediaId(item)}`}
                    wide
                    hoverPreview
                />
                <MediaRow
                    title={t("home.watchAgain")}
                    items={archives}
                    hrefFor={(item) => `/archive/${mediaId(item)}`}
                    wide
                    hoverPreview
                />
                {favs.length > 0 && <MediaRow title={t("home.favorites")} items={favs} />}
                {watched.length > 0 && <MediaRow title={t("home.continue")} items={watched} />}
            </div>

            <WishWall />

            <div id="gyakori-kerdesek" className="mx-auto mt-16 max-w-3xl px-4 md:px-10">
                <h2 className="mb-4 text-xl font-bold">{t("home.faq")}</h2>
                <HomeFaqPreview />
            </div>
        </div>
    );
}

function HomeFaqPreview() {
    const [items, setItems] = useState<FaqItem[]>([]);

    useEffect(() => {
        apiFetch("/faq")
            .then((data) => setItems(Array.isArray(data) ? data : []))
            .catch(() => setItems([]));
    }, []);

    return (
        <div>
            <FaqList items={items} showSearch={false} showContact={false} limit={4} />
            <div className="mt-6 text-center">
                <Link href="/faq" className="text-sm text-accent hover:underline">
                    Összes kérdés
                </Link>
            </div>
        </div>
    );
}
