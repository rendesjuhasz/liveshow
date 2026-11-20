"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n/I18nProvider";
import { isFavorite, toggleFavorite } from "@/lib/library";
import { mediaId, type MediaItem } from "@/lib/media";
import { cn } from "@/lib/utils";

export default function TheaterFavoriteButton({ item }: { item: MediaItem }) {
    const { user } = useAuth();
    const { t } = useT();
    const id = mediaId(item);
    const [fav, setFav] = useState(false);

    useEffect(() => {
        setFav(isFavorite(id, user?.id));
    }, [id, user?.id]);

    if (!id) return null;

    return (
        <button
            type="button"
            className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            aria-label={fav ? t("media.favoriteRemove") : t("media.favoriteAdd")}
            onClick={() => setFav(toggleFavorite({ ...item, id }, user?.id))}
        >
            <Heart className={cn("size-5", fav ? "fill-accent text-accent" : "text-white")} aria-hidden />
        </button>
    );
}
