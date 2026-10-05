"use client";

import { useParams } from "next/navigation";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import LiveViewer from "./LiveViewer";
import { useT } from "@/lib/i18n/I18nProvider";

export default function LivePage() {
    const { t } = useT();
    const { id } = useParams<{ id: string }>();
    const showId = decodeURIComponent(id ?? "").trim();

    if (!showId || isPlaceholderStreamId(showId)) {
        return (
            <div className="p-10 text-white">
                <h1>{t("live.title")}</h1>
                <p>{t("live.invalid")}</p>
            </div>
        );
    }

    return <LiveViewer showId={showId} />;
}
