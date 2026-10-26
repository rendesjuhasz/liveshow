"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";
import { displayInitial, displayName } from "@/lib/display-name";
import { isAdminAppPath, isStreamerAppPath, isStreamerChromePath, isStudioChromePath, isTheaterWatchPath } from "@/lib/roles";
import { viewerLoginHref } from "@/lib/auth-return";
import { apiFetch } from "@/api/http";
import SearchDialog from "@/components/search/SearchDialog";
import { buttonVariants } from "@/components/ui/button";
import LocaleLink from "@/components/LocaleLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/I18nProvider";
import { useMounted } from "@/lib/use-mounted";
import { stripLocalePrefix } from "@/lib/i18n/paths";

const LINK_KEYS = [
    { href: "/", key: "nav.home" },
    { href: "/shows", key: "nav.events" },
    { href: "/live", key: "nav.live" },
    { href: "/archive", key: "nav.archive" },
    { href: "/streamers", key: "nav.streamers" },
    { href: "/leaderboard", key: "nav.leaderboard" },
] as const;

export default function SiteNav({ initialPath = "/" }: { initialPath?: string }) {
    const { user, status, logout } = useAuth();
    const { t } = useT();
    const mounted = useMounted();
    const livePath = usePathname();
    const [locPath, setLocPath] = useState(initialPath || "/");
    useLayoutEffect(() => {
        setLocPath(window.location.pathname);
    }, [livePath]);
    const pathname = locPath || livePath || initialPath || "/";
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notes, setNotes] = useState<
        { id: string; title: string; body: string; read?: boolean; link?: string | null }[]
    >([]);
    const notesBtnRef = useRef<HTMLButtonElement>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const guest = status === "guest";
    const authed = status === "authenticated" && Boolean(user);
    const statusLabel = user
        ? t(
              isAdmin(user)
                  ? "nav.surface.admin"
                  : isStreamer(user)
                    ? "nav.surface.streamer"
                    : "nav.surface.viewer",
          )
        : "";
    const onStreamerApp = isStreamerAppPath(pathname);
    const onStreamerChrome = isStreamerChromePath(pathname);
    const loginHref = viewerLoginHref(pathname);
    const { path: localeFreePath } = stripLocalePrefix(pathname || "/");
    const onAdminApp = isAdminAppPath(pathname);
    const onStudio = isStudioChromePath(pathname);
    const liveWatch = isTheaterWatchPath(pathname);
    const hidePublicChrome = onStudio || liveWatch;
    const homeBar = localeFreePath === "/" || liveWatch;

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        setMenuOpen(false);
        setNotesOpen(false);
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!notesOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && notesBtnRef.current?.contains(target)) return;
            setNotesOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setNotesOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [notesOpen]);

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && profileMenuRef.current?.contains(target)) return;
            setMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!mobileOpen && !searchOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [mobileOpen, searchOpen]);

    useEffect(() => {
        if (!user) {
            setNotes([]);
            return;
        }
        const loadNotes = () => {
            apiFetch("/notifications")
                .then((rows) => {
                    const list = Array.isArray(rows) ? rows : [];
                    setNotes(
                        list.map((n: any) => ({
                            id: n.id,
                            title: n.title,
                            body: n.body,
                            read: n.read,
                            link: n.link || (n.relatedId ? `/shows/${n.relatedId}` : null),
                        })),
                    );
                })
                .catch(() => undefined);
        };
        loadNotes();
        const timer = window.setInterval(loadNotes, 45_000);
        return () => window.clearInterval(timer);
    }, [user]);

    if (liveWatch) return null;

    return (
        <>
            <header
                className={cn(
                    "fixed inset-x-0 top-0 z-50 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] transition-all duration-200",
                    scrolled || !homeBar
                        ? "border-b border-white/5 bg-[#1e1e1e]/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                        : "bg-gradient-to-b from-[#1e1e1e]/80 to-transparent",
                )}
            >
                <nav className="flex h-16 items-center gap-1.5 px-2 sm:gap-3 sm:px-3 md:gap-6 md:px-8">
                    <button
                        type="button"
                        className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/10 md:hidden",
                            liveWatch && "hidden",
                        )}
                        aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.menu")}
                        aria-expanded={mobileOpen}
                        onClick={() => {
                            setMobileOpen((v) => !v);
                            setNotesOpen(false);
                            setMenuOpen(false);
                        }}
                    >
                        <span className="flex size-5 items-center justify-center">
                            {mounted && (mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />)}
                        </span>
                    </button>
                    <LocaleLink
                        href={liveWatch ? "/live" : "/"}
                        scroll={false}
                        data-brand-logo
                        className="min-w-0 shrink truncate text-lg font-black tracking-tight sm:text-xl"
                    >
                        Live<span className="text-accent">Show</span>
                    </LocaleLink>
                    {onStreamerChrome && (
                        <LocaleLink
                            href="/"
                            className="min-w-0 shrink rounded-xl bg-white/10 px-2.5 py-2 text-xs font-semibold leading-tight text-white hover:bg-white/15 sm:text-sm"
                        >
                            {t("nav.backToPublic")}
                        </LocaleLink>
                    )}
                    {!hidePublicChrome && (
                    <div className="hidden items-center gap-5 text-sm text-zinc-300 md:flex">
                        {LINK_KEYS.map((l) => (
                            <LocaleLink
                                key={l.href}
                                href={l.href}
                                className={cn(
                                    "rounded-lg px-1.5 py-1 transition-all duration-200 hover:text-white hover:shadow-[0_0_20px_rgba(77,203,255,0.15)]",
                                    (pathname === l.href ||
                                        pathname.endsWith(l.href) ||
                                        (l.href !== "/" && pathname.includes(`${l.href}/`))) &&
                                        "font-semibold text-white",
                                )}
                            >
                                {t(l.key)}
                            </LocaleLink>
                        ))}
                    </div>
                    )}
                    {mounted && onStreamerChrome && (
                        <p className="hidden text-sm font-semibold text-accent md:block">{t("nav.streamerMode")}</p>
                    )}
                    {isStreamer(user) && !onStreamerChrome && (
                        <Link
                            href="/streamer"
                            className="shrink-0 rounded-xl bg-accent px-2 py-2 text-xs font-bold text-black sm:px-3 sm:text-sm"
                        >
                            {t("nav.streamerMode")}
                        </Link>
                    )}
                    <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
                        {mounted && !hidePublicChrome && (
                            <span className="hidden md:inline-flex">
                                <LanguageSwitcher compact />
                            </span>
                        )}
                        <button
                            type="button"
                            className={cn(
                                "flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10",
                                liveWatch && "hidden",
                            )}
                            aria-label={t("nav.search")}
                            onClick={() => setSearchOpen(true)}
                            suppressHydrationWarning
                        >
                            <span className="flex size-5 items-center justify-center">
                                {mounted ? <Search className="size-5" aria-hidden /> : null}
                            </span>
                        </button>
                        <div className="relative">
                            <button
                                ref={notesBtnRef}
                                type="button"
                                className="relative flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
                                aria-label={t("nav.notifications")}
                                aria-expanded={notesOpen}
                                suppressHydrationWarning
                                onClick={() => {
                                    setNotesOpen((v) => !v);
                                    setMenuOpen(false);
                                    setMobileOpen(false);
                                }}
                            >
                                {mounted ? <Bell className="size-5" /> : <span className="size-5" />}
                                {notes.some((n) => !n.read) && (
                                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
                                )}
                            </button>
                            {notesOpen && (
                                <div className="absolute right-0 mt-2 max-h-[min(20rem,70dvh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-auto rounded-2xl bg-card p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                                    {(notes.length
                                        ? notes
                                        : [{ id: "empty", title: t("nav.noNotifications"), body: "" }]
                                    ).map((n) => (
                                        <button
                                            key={n.id}
                                            type="button"
                                            className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/5"
                                            onPointerDown={() => {
                                                if (n.id === "empty") return;
                                                apiFetch(`/notifications/${n.id}/read`, {
                                                    method: "POST",
                                                }).catch(() => undefined);
                                                setNotes((prev) =>
                                                    prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                                                );
                                            }}
                                            onClick={() => {
                                                setNotesOpen(false);
                                                if (n.id === "empty") return;
                                                if (n.link) router.push(n.link);
                                            }}
                                        >
                                            <p className={`text-sm ${n.read ? "text-zinc-500" : "text-zinc-200"}`}>
                                                {n.title}
                                            </p>
                                            {n.body ? (
                                                <p className="mt-0.5 text-xs text-zinc-500">{n.body}</p>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {authed && user ? (
                            <div className="relative flex items-center" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    className="ml-1 flex max-w-full items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/10"
                                    aria-label={t("nav.profileMenu")}
                                    aria-expanded={menuOpen}
                                    onClick={() => {
                                        setMenuOpen((v) => !v);
                                        setNotesOpen(false);
                                    }}
                                >
                                    <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
                                        <span className="flex max-w-[140px] items-center gap-1 truncate text-xs text-zinc-300 md:max-w-[220px]">
                                            {displayName(user)}
                                        </span>
                                        <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
                                            {statusLabel}
                                            {onStreamerApp ? ` ${t("nav.modeSuffix")}` : ""}
                                        </span>
                                    </div>
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-black">
                                        {displayInitial(user)}
                                    </span>
                                    {mounted ? <ChevronDown className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-full z-20 mt-2 w-[min(14rem,calc(100vw-1.5rem))] rounded-2xl bg-card p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                                        <p className="px-3 py-2 text-xs text-zinc-500">
                                            {t("nav.status")}: <span className="font-semibold text-accent">{statusLabel}</span>
                                        </p>
                                        {onStreamerApp ? (
                                            <Link
                                                href="/streamer/profile"
                                                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                {t("nav.editProfile")}
                                            </Link>
                                        ) : (
                                            <LocaleLink href="/profile" className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5">
                                                {t("nav.profile")}
                                            </LocaleLink>
                                        )}
                                        {isStreamer(user) && !onStreamerApp && (
                                            <Link
                                                href="/streamer"
                                                className="block rounded-xl px-3 py-2 text-sm text-accent hover:bg-white/5"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                {t("nav.streamerMode")}
                                            </Link>
                                        )}
                                        {user.isAdmin && (
                                            <Link
                                                href="/admin"
                                                className="block rounded-xl px-3 py-2 text-sm text-accent hover:bg-white/5"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                {t("nav.admin")}
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
                                            onClick={logout}
                                        >
                                            {t("nav.logout")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : guest ? (
                            <div className="ml-1 flex items-center gap-2">
                                <LocaleLink
                                    href="/register"
                                    className="hidden text-sm font-semibold text-zinc-200 hover:text-white sm:inline"
                                >
                                    {t("nav.register")}
                                </LocaleLink>
                                <LocaleLink
                                    href={loginHref}
                                    className={cn(
                                        buttonVariants({ variant: "gold", size: "sm" }),
                                        "relative z-10 shrink-0 px-3 font-bold sm:px-4",
                                    )}
                                >
                                    {mounted ? <UserRound className="size-4" /> : <span className="size-4" />}
                                    <span className="hidden min-[380px]:inline">{t("nav.login")}</span>
                                </LocaleLink>
                            </div>
                        ) : (
                            <div className="ml-1 h-9 w-[5.5rem] rounded-xl bg-white/5" aria-hidden />
                        )}
                    </div>
                </nav>
            </header>

            {mobileOpen && (
                <div className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto border-b border-white/5 bg-[#1e1e1e]/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
                    {!hidePublicChrome && (
                        <div className="mb-4">
                            <LanguageSwitcher />
                        </div>
                    )}
                    {!hidePublicChrome && (
                    <div className="grid gap-1">
                        {LINK_KEYS.map((l) => (
                            <LocaleLink
                                key={l.href}
                                href={l.href}
                                className={cn(
                                    "rounded-xl px-3 py-3 text-sm",
                                    pathname === l.href ||
                                        (l.href !== "/" && pathname.includes(l.href))
                                        ? "bg-white/10 font-semibold"
                                        : "text-zinc-300",
                                )}
                            >
                                {t(l.key)}
                            </LocaleLink>
                        ))}
                    </div>
                    )}
                    {user && isStreamer(user) && !onStreamerChrome && (
                        <Link
                            href="/streamer"
                            className="mt-2 block rounded-xl px-3 py-3 text-sm font-semibold text-accent"
                            onClick={() => setMobileOpen(false)}
                        >
                            {t("nav.streamerMode")}
                        </Link>
                    )}
                    {user && user.isAdmin && (
                        <Link
                            href="/admin"
                            className="mt-2 block rounded-xl px-3 py-3 text-sm font-semibold text-accent"
                            onClick={() => setMobileOpen(false)}
                        >
                            Admin
                        </Link>
                    )}
                    {guest && (
                        <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                            <LocaleLink
                                href={loginHref}
                                className={cn(buttonVariants({ variant: "gold" }), "w-full")}
                            >
                                {t("nav.login")}
                            </LocaleLink>
                            <LocaleLink
                                href="/register"
                                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                            >
                                {t("auth.submitRegister")}
                            </LocaleLink>
                            <Link href="/streamer-login" className="py-2 text-center text-sm text-zinc-400">
                                {t("nav.streamerLogin")}
                            </Link>
                            <Link href="/streamer-register" className="py-2 text-center text-sm text-zinc-400">
                                {t("nav.streamerRegister")}
                            </Link>
                        </div>
                    )}
                </div>
            )}

            <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
