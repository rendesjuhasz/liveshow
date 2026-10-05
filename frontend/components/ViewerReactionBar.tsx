"use client";

import { useRef } from "react";
import { REACTION_EMOJIS } from "@/lib/live-reactions";

import { useT } from "@/lib/i18n/I18nProvider";

export default function ViewerReactionBar({
    disabled,
    onReact,
}: {
    disabled?: boolean;
    onReact: (emoji: string) => void;
}) {
    const { t } = useT();
    const last = useRef(0);
    const windowHits = useRef<number[]>([]);

    function send(emoji: string) {
        const now = Date.now();
        if (now - last.current < 1000) return;
        const recent = windowHits.current.filter((t) => now - t < 10_000);
        if (recent.length >= 5) return;
        recent.push(now);
        windowHits.current = recent;
        last.current = now;
        onReact(emoji);
    }

    return (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start" role="group" aria-label={t("react.group")}>
            {REACTION_EMOJIS.map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    disabled={disabled}
                    aria-label={t("react.one").replace("{e}", emoji)}
                    className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-[28px] leading-none active:bg-white/20 disabled:opacity-40 md:text-[32px] lg:text-[36px]"
                    onClick={() => send(emoji)}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}
