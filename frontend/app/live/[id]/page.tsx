"use client";

import { useParams } from "next/navigation";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import LiveWatchScreen from "./LiveWatchScreen";
import { useT } from "@/lib/i18n/I18nProvider";

export default function LivePage() {
    const { t } = useT();
    const rawId = useParams<{ id: string | string[] }>().id;
    const showId = decodeURIComponent(String(Array.isArray(rawId) ? rawId[0] : rawId ?? "")).trim();

    if (!showId || isPlaceholderStreamId(showId)) {
        return (
            <div className="p-10 text-white">
                <h1>{t("live.title")}</h1>
                <p>{t("live.invalid")}</p>
            </div>
        );
    }

    return <LiveWatchScreen showId={showId} />;
}
