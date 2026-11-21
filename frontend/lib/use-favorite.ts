"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
    isFavorite,
    isRemoteFavorite,
    onFavoritesChange,
    toggleAccountFavorite,
    toggleFavorite,
} from "@/lib/library";
import { mediaId, type MediaItem } from "@/lib/media";

export function useFavorite(item: MediaItem | null | undefined) {
    const { user, ready } = useAuth();
    const id = item ? mediaId(item) : "";
    const [fav, setFav] = useState(false);

    useEffect(() => {
        if (!id || !ready) return;
        const sync = () => {
            setFav(user ? isRemoteFavorite(id) : isFavorite(id, null));
        };
        sync();
        return onFavoritesChange(sync);
    }, [id, user?.id, ready]);

    async function toggle() {
        if (!item || !id) return;
        if (!user) {
            setFav(toggleFavorite(item, null));
            return;
        }
        const next = !isRemoteFavorite(id);
        setFav(next);
        try {
            await toggleAccountFavorite(item);
        } catch {
            setFav(!next);
        }
    }

    return { fav, toggle };
}
