"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { applyHomeScroll, homeScrollReservePx, readHomeScroll, saveHomeScroll } from "@/lib/home-scroll";

function uniq(items: MediaItem[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const id = mediaId(item);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

function asArchiveItems(rows: unknown): MediaItem[] {
    return (Array.isArray(rows) ? rows : []).map((a: any) => ({
        id: a.showId,
        showId: a.showId,
        title: a.title,
        startTime: a.startTime,
        image: a.image,
        streamer: a.streamer ? { name: a.streamer } : null,
        ended: true,
        viewCount: Number(a.viewCount) || 0,
    }));
}

export default function HomePage() {
    const { user } = useAuth();
    const { t, locale } = useT();
    const [featured, setFeatured] = useState<MediaItem[]>([]);
    const [all, setAll] = useState<MediaItem[]>([]);
    const [live, setLive] = useState<MediaItem[]>([]);
    const [archives, setArchives] = useState<MediaItem[]>([]);
    const [popular, setPopular] = useState<MediaItem[]>([]);
    const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
    const [favs, setFavs] = useState<MediaItem[]>([]);
    const [watched, setWatched] = useState<MediaItem[]>([]);
    const snapRef = useRef<ReturnType<typeof readHomeScroll>>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const appliedY = useRef(false);
    const [reservePx, setReservePx] = useState(0);

    const hrefLive = useCallback((item: MediaItem) => `/live/${mediaId(item)}`, []);
    const hrefArchive = useCallback((item: MediaItem) => `/archive/${mediaId(item)}`, []);

    useEffect(() => {
        let cancelled = false;
        async function loadHome() {
            try {
                const d = await apiFetch("/home");
                if (cancelled) return;
                setFeatured(Array.isArray(d?.featured) ? d.featured : []);
                setAll(Array.isArray(d?.shows) ? d.shows : []);
                setLive(Array.isArray(d?.live) ? d.live : []);
                setArchives(asArchiveItems(d?.archives));
                setPopular(asArchiveItems(d?.popular));
                setFaqItems(Array.isArray(d?.faq) ? d.faq : []);
                if (!Array.isArray(d?.faq) || d.faq.length === 0) {
                    apiFetch("/faq")
                        .then((rows) => {
                            if (!cancelled && Array.isArray(rows) && rows.length) setFaqItems(rows);
                        })
                        .catch(() => undefined);
                }
            } catch {
                if (!cancelled) {
                    setFeatured([]);
                    setAll([]);
                    setLive([]);
                    setArchives([]);
                    setPopular([]);
                    setFaqItems([]);
                    apiFetch("/faq")
                        .then((rows) => {
                            if (!cancelled && Array.isArray(rows)) setFaqItems(rows);
                        })
                        .catch(() => undefined);
                }
            }
        }
        async function loadLive() {
            try {
                const d = await apiFetch("/shows/live");
                if (!cancelled) setLive(Array.isArray(d) ? d : []);
            } catch {
                if (!cancelled) setLive([]);
            }
        }
        loadHome();
        const timer = setInterval(loadLive, 15_000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [locale]);

    useEffect(() => {
        setFavs(getFavorites(user?.id).map((f) => ({ id: f.id, title: f.title, image: f.image, startTime: f.startTime })));
        setWatched(getWatched(user?.id).map((f) => ({ id: f.id, title: f.title, image: f.image, startTime: f.startTime })));
    }, [user?.id]);

    useLayoutEffect(() => {
        history.scrollRestoration = "manual";
        const snap = readHomeScroll();
        snapRef.current = snap;
        const reserve = homeScrollReservePx(snap);
        if (reserve) setReservePx(reserve);
        else applyHomeScroll(snap);
        const onLeave = () => saveHomeScroll();
        const onShow = () => {
            if (!appliedY.current) applyHomeScroll(snapRef.current);
        };
        document.addEventListener("pointerdown", onLeave, true);
        window.addEventListener("pagehide", onLeave);
        window.addEventListener("pageshow", onShow);
        const raf = requestAnimationFrame(() => {
            if (!reserve) applyHomeScroll(snapRef.current);
        });
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("pointerdown", onLeave, true);
            window.removeEventListener("pagehide", onLeave);
            window.removeEventListener("pageshow", onShow);
        };
    }, []);

    useLayoutEffect(() => {
        if (!reservePx || appliedY.current) return;
        appliedY.current = true;
        applyHomeScroll(snapRef.current);
        requestAnimationFrame(() => applyHomeScroll(snapRef.current));
    }, [reservePx]);

    const hero = featured[0] || live[0] || all[0];
    const upcoming = useMemo(() => uniq(all.filter((s) => isUpcoming(s))), [all]);
    const featuredRow = useMemo(
        () => uniq(featured.length ? featured : all.slice(0, 12)),
        [featured, all],
    );

    useLayoutEffect(() => {
        const rows = snapRef.current?.rows;
        if (!rows?.length) return;
        document.querySelectorAll<HTMLElement>("[data-home-row]").forEach((el, i) => {
            if (typeof rows[i] === "number") el.scrollLeft = rows[i];
        });
    }, [featured.length, live.length, archives.length, popular.length, all.length, upcoming.length]);

    useEffect(() => {
        if (!reservePx) return;
        const root = rootRef.current;
        if (!root) return;
        const y = snapRef.current?.y ?? 0;
        const measure = () => {
            let bottom = 0;
            for (const child of root.children) {
                const el = child as HTMLElement;
                bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
            }
            if (bottom >= y + window.innerHeight) setReservePx(0);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        return () => ro.disconnect();
    }, [reservePx, featured.length, live.length, archives.length, popular.length, all.length, upcoming.length]);

    return (
        <div
            ref={rootRef}
            className="overflow-x-hidden pb-16"
            style={{ overflowAnchor: "none", minHeight: reservePx || undefined }}
        >
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
                <MediaRow title={t("home.featured")} items={featuredRow} />
                <MediaRow title={t("home.soon")} items={upcoming} />
                <MediaRow title={t("home.liveStreams")} items={live} hrefFor={hrefLive} wide />
                <MediaRow title={t("home.popularEvents")} items={popular} hrefFor={hrefArchive} wide hoverPreview />
                <MediaRow title={t("home.watchAgain")} items={archives} hrefFor={hrefArchive} wide hoverPreview />
                {favs.length > 0 && <MediaRow title={t("home.favorites")} items={favs} />}
                {watched.length > 0 && <MediaRow title={t("home.continue")} items={watched} />}
            </div>

            <WishWall />

            <div id="gyakori-kerdesek" className="mx-auto mt-16 max-w-3xl px-4 md:px-10">
                <h2 className="mb-4 text-xl font-bold">{t("home.faq")}</h2>
                <HomeFaqPreview items={faqItems} />
            </div>
        </div>
    );
}

function HomeFaqPreview({ items }: { items: FaqItem[] }) {
    const { t } = useT();
    return (
        <div>
            <FaqList items={items} showSearch={false} showContact={false} limit={4} />
            <div className="mt-6 text-center">
                <Link href="/faq" className="text-sm text-accent hover:underline">
                    {t("home.allFaq")}
                </Link>
            </div>
        </div>
    );
}
