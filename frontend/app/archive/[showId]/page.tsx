"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { buildSignedArchiveUrl } from "@/lib/getStreamToken";
import { recordWatched } from "@/lib/library";
import ReviewForm from "@/components/ReviewForm";
import CreatorPublicLinks from "@/components/CreatorPublicLinks";
import ShowTalk from "@/app/live/[id]/ShowTalk";
import { Eye } from "lucide-react";
import { formatCount } from "@/lib/views";
import { useT } from "@/lib/i18n/I18nProvider";
import LocaleLink from "@/components/LocaleLink";

export default function ArchiveWatchPage() {
    const { showId } = useParams<{ showId: string }>();
    const { user, ready } = useAuth();
    const { t } = useT();
    const [info, setInfo] = useState<any>(null);
    const [src, setSrc] = useState("");
    const [error, setError] = useState("");
    const [viewCount, setViewCount] = useState(0);
    const countedRef = useRef(false);

    useEffect(() => {
        if (!showId) return;
        apiFetch(`/archives/${showId}`)
            .then((data) => {
                setInfo(data);
                setViewCount(Number(data?.viewCount) || 0);
            })
            .catch((err: any) => setError(err.message || t("archive.unknownCat")));
    }, [showId]);

    useEffect(() => {
        countedRef.current = false;
    }, [showId, user?.id]);

    useEffect(() => {
        if (!ready || !info) return;
        if (!info.exists) {
            setError("Ehhez a műsorhoz még nem készült el a visszanézhető felvétel.");
            return;
        }
        if (!info.streamId) return;
        setError("");
        buildSignedArchiveUrl(info.streamId, showId, info.publicPath)
            .then((signed) => {
                setSrc(signed.url);
                recordWatched(
                    { id: String(showId), title: info?.title, image: info?.image },
                    user?.id,
                );
            })
            .catch((err: any) => setError(err.message || "Nem sikerült elindítani a lejátszást."));
    }, [ready, user, info, showId]);

    return (
        <div className="mx-auto min-h-dvh max-w-4xl bg-background px-4 py-8 text-white md:px-10">
            <LocaleLink href="/archive" className="text-sm text-accent hover:underline">
                ← {t("archive.title")}
            </LocaleLink>
            <h1 className="text-3xl font-bold my-4">{info?.title || t("archive.heading")}</h1>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Eye className="size-4 text-accent" aria-hidden />
                {t("media.views").replace("{n}", formatCount(viewCount))}
            </p>
            {info?.videoCategory && (
                <p className="mb-2">
                    <LocaleLink
                        href={`/archive/category/${info.videoCategory}`}
                        className="text-sm font-semibold uppercase tracking-wide text-accent hover:underline"
                    >
                        {t(`cat.${info.videoCategory}`)}
                    </LocaleLink>
                </p>
            )}
            <p className="mb-4 text-sm text-zinc-400">{t("live.watchFree")}</p>
            {error && <p className="text-red-400 mb-4">{error}</p>}
            {src ? (
                <video
                    src={src}
                    controls
                    className="w-full aspect-video bg-black rounded-xl"
                    onTimeUpdate={(e) => {
                        if (countedRef.current || !showId || !user) return;
                        const video = e.currentTarget;
                        const seconds = Number(video.currentTime) || 0;
                        const duration = Number(video.duration) || 0;
                        const enoughTime = seconds >= 10;
                        const enoughShare = duration >= 8 && seconds / duration >= 0.2;
                        if (!enoughTime && !enoughShare) return;
                        countedRef.current = true;
                        apiFetch("/views/archive", {
                            method: "POST",
                            body: JSON.stringify({
                                showId: String(showId),
                                seconds,
                                duration,
                            }),
                        })
                            .then((res) => {
                                if (typeof res?.viewCount === "number") setViewCount(res.viewCount);
                            })
                            .catch(() => {
                                countedRef.current = false;
                            });
                    }}
                />
            ) : (
                !error && <p>{t("common.loading")}</p>
            )}
            <CreatorPublicLinks
                name={info?.creatorLinks?.name}
                links={info?.creatorLinks?.links}
            />
            {showId ? <ReviewForm showId={String(showId)} /> : null}
            {showId ? (
                <div className="mt-10">
                    <ShowTalk showId={String(showId)} canAsk={false} live={false} />
                </div>
            ) : null}
        </div>
    );
}
