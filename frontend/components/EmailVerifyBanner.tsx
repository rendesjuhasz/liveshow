"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import LocaleLink from "@/components/LocaleLink";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";
import { isTheaterWatchPath } from "@/lib/roles";
import { cn } from "@/lib/utils";

const HIDE_KEY = "ls_hide_email_verify_banner";

function readHiddenUserId() {
    if (typeof window === "undefined") return null;
    try {
        return sessionStorage.getItem(HIDE_KEY);
    } catch {
        return null;
    }
}

function writeHiddenUserId(userId: string) {
    try {
        sessionStorage.setItem(HIDE_KEY, userId);
    } catch {
        /* private mode */
    }
}

function clearHiddenUserId() {
    try {
        sessionStorage.removeItem(HIDE_KEY);
    } catch {
        /* private mode */
    }
}

function clearVerifyBannerOffset() {
    document.documentElement.style.removeProperty("--email-verify-banner-h");
    document.documentElement.removeAttribute("data-email-verify-banner");
}

export default function EmailVerifyBanner({
    placement = "inline",
}: {
    placement?: "inline" | "global";
}) {
    const { user, ready, refreshUser } = useAuth();
    const { t } = useT();
    const pathname = usePathname();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [hiddenUserId, setHiddenUserId] = useState<string | null>(readHiddenUserId);
    const rootRef = useRef<HTMLDivElement>(null);

    const unverified = Boolean(user && user.emailVerified === false);
    const hideGlobalOnTheater = placement === "global" && isTheaterWatchPath(pathname || "");
    const dismissed =
        placement === "global" && Boolean(user && hiddenUserId === user.id);
    const visible = unverified && !hideGlobalOnTheater && !dismissed;

    useLayoutEffect(() => {
        if (!ready) return;
        if (!user) {
            clearHiddenUserId();
            setHiddenUserId(null);
            return;
        }
        setHiddenUserId(readHiddenUserId());
    }, [ready, user]);

    useLayoutEffect(() => {
        if (placement !== "global") return;
        if (!visible) {
            clearVerifyBannerOffset();
            return;
        }
        const el = rootRef.current;
        if (!el) return;

        const sync = () => {
            const height = Math.ceil(el.getBoundingClientRect().height);
            document.documentElement.style.setProperty("--email-verify-banner-h", `${height}px`);
            document.documentElement.setAttribute("data-email-verify-banner", "1");
        };
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(el);
        return () => {
            observer.disconnect();
            clearVerifyBannerOffset();
        };
    }, [placement, visible, message]);

    if (!visible || !user) return null;

    async function resend() {
        setBusy(true);
        setMessage("");
        try {
            const data = await apiFetch("/auth/resend-verification", {
                method: "POST",
                body: JSON.stringify({}),
            });
            setMessage(data?.message || t("verify.done"));
            await refreshUser().catch(() => undefined);
        } catch (err: unknown) {
            const text =
                err && typeof err === "object" && "message" in err
                    ? String((err as Error).message)
                    : t("verify.failed");
            setMessage(text);
        } finally {
            setBusy(false);
        }
    }

    function hideBanner() {
        if (!user || placement !== "global") return;
        writeHiddenUserId(user.id);
        setHiddenUserId(user.id);
        clearVerifyBannerOffset();
    }

    return (
        <div
            ref={rootRef}
            className={cn(
                "border-b border-amber-400/30 bg-[#1e1e1e] px-4 py-3 text-sm text-amber-100",
                placement === "global" &&
                    "fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40",
            )}
        >
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>{t("verify.banner").replace("{email}", user.email)}</p>
                <div className="flex shrink-0 items-center gap-3">
                    {message && <span className="text-xs text-zinc-300">{message}</span>}
                    <Button type="button" variant="gold" className="h-9 px-3 text-xs" disabled={busy} onClick={resend}>
                        {busy ? t("verify.resendBusy") : t("verify.resend")}
                    </Button>
                    <LocaleLink href="/verify-email" className="text-xs underline">
                        {t("verify.open")}
                    </LocaleLink>
                    {placement === "global" ? (
                        <button
                            type="button"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-amber-100 hover:bg-white/10"
                            aria-label={t("verify.bannerClose")}
                            onClick={hideBanner}
                        >
                            <X className="size-5" aria-hidden />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
