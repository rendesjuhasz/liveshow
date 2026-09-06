"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { displayInitial, displayName } from "@/lib/display-name";
import { isStreamerAppPath, sessionStatusLabel } from "@/lib/roles";
import { apiFetch } from "@/api/http";
import SearchDialog from "@/components/search/SearchDialog";
import { buttonVariants } from "@/components/ui/button";
import LocaleLink from "@/components/LocaleLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/I18nProvider";

const LINK_KEYS = [
    { href: "/", key: "nav.home" },
    { href: "/shows", key: "nav.events" },
    { href: "/live", key: "nav.live" },
    { href: "/archive", key: "nav.archive" },
    { href: "/streamers", key: "nav.streamers" },
    { href: "/leaderboard", key: "nav.leaderboard" },
] as const;

export default function SiteNav() {
    const { user, logout } = useAuth();
    const { t } = useT();
    const pathname = usePathname();
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [navReady, setNavReady] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notes, setNotes] = useState<
        { id: string; title: string; body: string; read?: boolean; link?: string | null }[]
    >([]);
    const notesBtnRef = useRef<HTMLButtonElement>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const guest = !user;
    const statusLabel = user ? sessionStatusLabel(user, pathname) : "";
    const onStreamerApp = isStreamerAppPath(pathname);
    const onAdminApp = pathname.startsWith("/admin");

    useEffect(() => {
        setNavReady(true);
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

    return (
        <>
            <header
                suppressHydrationWarning
                className={cn(
                    "fixed inset-x-0 top-0 z-50 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] transition-colors duration-300",
                    !navReady || scrolled || pathname !== "/"
                        ? "bg-black/90 backdrop-blur-xl"
                        : "bg-gradient-to-b from-black/80 to-transparent",
                )}
            >
                <nav className="flex h-16 items-center gap-1.5 px-2 sm:gap-3 sm:px-3 md:gap-6 md:px-8">
                    <button
                        type="button"
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/10 md:hidden"
                        aria-label={mobileOpen ? "Menü bezárása" : "Menü"}
                        aria-expanded={mobileOpen}
                        onClick={() => {
                            setMobileOpen((v) => !v);
                            setNotesOpen(false);
                            setMenuOpen(false);
                        }}
                    >
                        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>
                    <Link
                        href={onStreamerApp ? "/streamer" : onAdminApp ? "/admin" : "/"}
                        className="min-w-0 shrink truncate text-lg font-black tracking-tight sm:text-xl"
                    >
                        Live<span className="text-accent">Show</span>
                    </Link>
                    {!onStreamerApp && !onAdminApp && (
                    <div className="hidden items-center gap-5 text-sm text-zinc-300 md:flex">
                        {LINK_KEYS.map((l) => (
                            <LocaleLink
                                key={l.href}
                                href={l.href}
                                className={cn(
                                    "hover:text-white",
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
                    {onStreamerApp && (
                        <p className="hidden text-sm font-semibold text-accent md:block">Streamer mód</p>
                    )}
                    <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
                        {!onStreamerApp && !onAdminApp && (
                            <span className="hidden md:inline-flex">
                                <LanguageSwitcher compact />
                            </span>
                        )}
                        <button
                            type="button"
                            className="flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
                            aria-label={t("nav.search")}
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="size-5" />
                        </button>
                        <div className="relative">
                            <button
                                ref={notesBtnRef}
                                type="button"
                                className="relative flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
                                aria-label={t("nav.notifications")}
                                aria-expanded={notesOpen}
                                onClick={() => {
                                    setNotesOpen((v) => !v);
                                    setMenuOpen(false);
                                    setMobileOpen(false);
                                }}
                            >
                                <Bell className="size-5" />
                                {notes.some((n) => !n.read) && (
                                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
                                )}
                            </button>
                            {notesOpen && (
                                <div className="absolute right-0 mt-2 max-h-[min(20rem,70dvh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                                    {(notes.length
                                        ? notes
                                        : [{ id: "empty", title: "Nincs új értesítés", body: "" }]
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
                        {user ? (
                            <div className="relative flex items-center" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    className="ml-1 flex max-w-full items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/10"
                                    aria-label="Profilmenü"
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
                                            {onStreamerApp ? " mód" : ""}
                                        </span>
                                    </div>
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-black">
                                        {displayInitial(user)}
                                    </span>
                                    <ChevronDown className="size-4 shrink-0" />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 top-full z-20 mt-2 w-[min(14rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                                        <p className="px-3 py-2 text-xs text-zinc-500">
                                            Státusz: <span className="font-semibold text-accent">{statusLabel}</span>
                                        </p>
                                        {onStreamerApp ? (
                                            <Link
                                                href="/streamer/profile"
                                                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                Profil szerkesztése
                                            </Link>
                                        ) : (
                                            <LocaleLink href="/profile" className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5">
                                                {t("nav.profile")}
                                            </LocaleLink>
                                        )}
                                        {isAdmin(user) && onAdminApp && (
                                            <Link
                                                href="/admin"
                                                className="block rounded-xl px-3 py-2 text-sm text-accent hover:bg-white/5"
                                            >
                                                Admin
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
                        ) : (
                            <div className="ml-1 flex items-center gap-2">
                                <LocaleLink
                                    href="/register"
                                    className="hidden text-sm font-semibold text-zinc-200 hover:text-white sm:inline"
                                >
                                    {t("nav.register")}
                                </LocaleLink>
                                <Link
                                    href="/streamer-login"
                                    className="hidden text-sm font-semibold text-accent hover:text-white md:inline"
                                >
                                    {t("nav.streamerLogin")}
                                </Link>
                                <LocaleLink
                                    href="/login"
                                    className={cn(
                                        buttonVariants({ variant: "gold", size: "sm" }),
                                        "shrink-0 px-3 font-bold sm:px-4",
                                    )}
                                >
                                    <UserRound className="size-4" />
                                    <span className="hidden min-[380px]:inline">{t("nav.login")}</span>
                                </LocaleLink>
                            </div>
                        )}
                    </div>
                </nav>
            </header>

            {mobileOpen && (
                <div className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 max-h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto border-b border-white/10 bg-black/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
                    {!onStreamerApp && !onAdminApp && (
                        <div className="mb-4">
                            <LanguageSwitcher />
                        </div>
                    )}
                    {!onStreamerApp && !onAdminApp && (
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
                    {guest && (
                        <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
                            <LocaleLink
                                href="/login"
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
                            <Link href="/streamer-login" className="py-2 text-center text-sm text-accent">
                                Streamer belépés
                            </Link>
                            <Link href="/streamer-register" className="py-2 text-center text-sm text-zinc-400">
                                Streamer regisztráció
                            </Link>
                        </div>
                    )}
                </div>
            )}

            <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
