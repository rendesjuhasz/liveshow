"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REACTION_EMOJIS } from "@/lib/live-reactions";
import ViewerShareMenu from "@/components/ViewerShareMenu";
import ViewerSupportMenu from "@/components/ViewerSupportMenu";
import ViewerQuestionMenu from "@/components/ViewerQuestionMenu";

import { useT } from "@/lib/i18n/I18nProvider";
import { publicWatchShareUrl, type WatchShareKind } from "@/lib/share-watch";

const BTN =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/70 text-[26px] leading-none shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl active:scale-95 disabled:opacity-40";

export default function ViewerReactionBar({
    disabled,
    onReact,
    shareKind,
    shareId,
    enableSupport,
    ownShow,
    live,
    inline,
}: {
    disabled?: boolean;
    onReact?: (emoji: string) => void;
    shareKind: WatchShareKind;
    shareId: string;
    enableSupport?: boolean;
    ownShow?: boolean;
    live?: boolean;
    inline?: boolean;
}) {
    const { t, locale } = useT();
    const box = useRef<HTMLDivElement>(null);
    const last = useRef(0);
    const windowHits = useRef<number[]>([]);
    const [mounted, setMounted] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<string>(REACTION_EMOJIS[0]);

    useEffect(() => {
        setMounted(true);
        setShareUrl(publicWatchShareUrl(shareKind, shareId, locale));
    }, [shareKind, shareId, locale]);

    function send(emoji: string) {
        if (!onReact) return;
        const now = Date.now();
        if (now - last.current < 1000) return;
        const recent = windowHits.current.filter((hit) => now - hit < 10_000);
        if (recent.length >= 5) return;
        recent.push(now);
        windowHits.current = recent;
        last.current = now;
        setPicked(emoji);
        setOpen(false);
        onReact(emoji);
    }

    if (!mounted || !shareUrl) return null;

    const rail = (
        <div
            ref={box}
            className={
                inline
                    ? "pointer-events-auto flex flex-col items-end gap-2"
                    : "pointer-events-auto fixed right-3 top-[42%] z-[200] flex flex-col items-end gap-2"
            }
            role="group"
            aria-label={onReact ? t("react.group") : t("share.button")}
        >
            {onReact && open ? (
                <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-white/20 bg-black/80 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                    {REACTION_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            disabled={disabled}
                            aria-label={t("react.one").replace("{e}", emoji)}
                            className={BTN}
                            onClick={() => send(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            ) : null}
            {onReact ? (
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={t("react.group")}
                    aria-expanded={open}
                    className={BTN}
                    onClick={() => setOpen((v) => !v)}
                >
                    {picked}
                </button>
            ) : null}
            <ViewerShareMenu url={shareUrl} />
            {enableSupport ? <ViewerSupportMenu showId={shareId} /> : null}
            {shareKind === "live" ? <ViewerQuestionMenu showId={shareId} ownShow={ownShow} live={live} /> : null}
        </div>
    );

    if (inline) return rail;
    return createPortal(rail, document.body);
}
