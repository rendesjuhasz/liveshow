"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Globe } from "lucide-react";
import { DEFAULT_LOCALE, isLocale, LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/I18nProvider";

export type ShowLocaleCopy = {
    locale: Locale;
    title: string;
    description: string;
};

function translationLocales(originalLocale?: string | null): Locale[] {
    const original = isLocale(originalLocale) ? originalLocale : DEFAULT_LOCALE;
    return LOCALES.filter((locale): locale is Locale => locale !== original);
}

export function emptyShowTranslations(originalLocale?: string | null): ShowLocaleCopy[] {
    return translationLocales(originalLocale).map((locale) => ({ locale, title: "", description: "" }));
}

export function mergeShowTranslations(
    rows?: { locale?: string; title?: string; description?: string; field?: string; value?: string }[],
    originalLocale?: string | null,
): ShowLocaleCopy[] {
    const base = emptyShowTranslations(originalLocale);
    if (!Array.isArray(rows) || !rows.length) return base;
    for (const row of rows) {
        const locale = String(row.locale || "").toLowerCase() as Locale;
        const slot = base.find((item) => item.locale === locale);
        if (!slot) continue;
        if (row.field === "title") slot.title = String(row.value || "");
        else if (row.field === "description") slot.description = String(row.value || "");
        else {
            if (row.title !== undefined) slot.title = String(row.title || "");
            if (row.description !== undefined) slot.description = String(row.description || "");
        }
    }
    return base;
}

export function translationHasCopy(row?: ShowLocaleCopy | null) {
    return Boolean(row?.title?.trim() || row?.description?.trim());
}

function filledLocales(value: ShowLocaleCopy[], originalLocale?: string | null) {
    const allowed = new Set(translationLocales(originalLocale));
    return value.filter((row) => allowed.has(row.locale) && translationHasCopy(row)).map((row) => row.locale);
}

type PanelField = "title" | "description";

type TranslationsUi = {
    openPanel: (field: PanelField, button: HTMLButtonElement) => void;
    count: number;
    label: string;
};

const TranslationsUiContext = createContext<TranslationsUi | null>(null);

export function ShowTranslationsProvider({
    value,
    onChange,
    originalLocale,
    children,
}: {
    value: ShowLocaleCopy[];
    onChange: (next: ShowLocaleCopy[]) => void;
    originalLocale?: string | null;
    children: ReactNode;
}) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [focusField, setFocusField] = useState<PanelField>("title");
    const [added, setAdded] = useState<Locale[]>([]);
    const [selected, setSelected] = useState<Locale | null>(null);
    const [desktop, setDesktop] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const panelRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLButtonElement | null>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const label = t("studio.translations.open");
    const slots = translationLocales(originalLocale);
    const count = filledLocales(value, originalLocale).length;

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        const apply = () => setDesktop(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    useEffect(() => {
        const original = isLocale(originalLocale) ? originalLocale : DEFAULT_LOCALE;
        setAdded((prev) => prev.filter((locale) => locale !== original));
        setSelected((cur) => (cur === original ? null : cur));
    }, [originalLocale]);

    useEffect(() => {
        const allowed = translationLocales(originalLocale);
        const filled = filledLocales(value, originalLocale);
        setAdded((prev) => {
            const next = prev.filter((locale) => allowed.includes(locale));
            let changed = next.length !== prev.length;
            for (const locale of filled) {
                if (!next.includes(locale)) {
                    next.push(locale);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [value, originalLocale]);

    const updatePosition = useCallback(() => {
        const button = openerRef.current;
        if (!button || !desktop) return;
        const rect = button.getBoundingClientRect();
        const width = 360;
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        setPos({ top: rect.bottom + 8, left });
    }, [desktop]);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, updatePosition]);

    const closePanel = useCallback(() => {
        setOpen(false);
        const opener = openerRef.current;
        window.setTimeout(() => opener?.focus(), 0);
    }, []);

    useEffect(() => {
        if (!open) return;
        const root = panelRef.current;
        const focusables = () =>
            root
                ? [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
                      (el) => !el.hasAttribute("disabled"),
                  )
                : [];
        const timer = window.setTimeout(() => {
            if (focusField === "description" && descriptionRef.current) descriptionRef.current.focus();
            else if (focusField === "title" && titleRef.current) titleRef.current.focus();
            else focusables()[0]?.focus();
        }, 0);
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault();
                closePanel();
                return;
            }
            if (e.key !== "Tab" || !root) return;
            const items = focusables();
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && (active === first || !root.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !root.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", onKey);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, focusField, closePanel, selected]);

    function patch(locale: Locale, field: PanelField, next: string) {
        if (value.some((item) => item.locale === locale)) {
            onChange(value.map((item) => (item.locale === locale ? { ...item, [field]: next } : item)));
            return;
        }
        onChange([
            ...value,
            {
                locale,
                title: field === "title" ? next : "",
                description: field === "description" ? next : "",
            },
        ]);
    }

    function addLocale(locale: Locale) {
        setAdded((prev) => (prev.includes(locale) ? prev : [...prev, locale]));
        setSelected(locale);
        if (!value.some((row) => row.locale === locale)) {
            onChange([...value, { locale, title: "", description: "" }]);
        }
    }

    function removeLocale(locale: Locale) {
        setAdded((prev) => {
            const next = prev.filter((item) => item !== locale);
            setSelected((cur) => (cur === locale ? next[0] || null : cur));
            return next;
        });
        onChange(value.map((row) => (row.locale === locale ? { ...row, title: "", description: "" } : row)));
    }

    const openPanel = useCallback(
        (field: PanelField, button: HTMLButtonElement) => {
            openerRef.current = button;
            setFocusField(field);
            setSelected((cur) => cur || filledLocales(value, originalLocale)[0] || added[0] || null);
            setOpen(true);
        },
        [value, originalLocale, added],
    );

    const ctx = useMemo(() => ({ openPanel, count, label }), [openPanel, count, label]);
    const row = selected ? value.find((item) => item.locale === selected) : undefined;
    const available = slots.filter((locale) => !added.includes(locale));

    const panel = open ? (
        <div className="fixed inset-0 z-[80]" onMouseDown={() => closePanel()}>
            <div className="absolute inset-0 bg-black/50 md:bg-black/20" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                onMouseDown={(e) => e.stopPropagation()}
                className={
                    desktop
                        ? "absolute flex max-h-[min(32rem,calc(100dvh-2rem))] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-auto rounded-2xl border border-white/15 bg-neutral-900 p-4 shadow-2xl"
                        : "absolute inset-x-0 bottom-0 flex max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-bottom)))] flex-col overflow-auto rounded-t-2xl border border-white/15 bg-neutral-900 px-4 pt-4 pb-[max(5.5rem,calc(1rem+env(safe-area-inset-bottom)))] shadow-2xl"
                }
                style={desktop ? { top: pos.top, left: pos.left } : undefined}
            >
                {added.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {added.map((locale) => {
                            const name = LOCALE_META[locale].nativeName;
                            const active = selected === locale;
                            return (
                                <span
                                    key={locale}
                                    className={`inline-flex items-center rounded-full border ${
                                        active
                                            ? "border-accent bg-white/15 text-white"
                                            : "border-white/15 bg-white/5 text-neutral-200"
                                    }`}
                                >
                                    <button type="button" className="min-h-11 px-3 text-sm" onClick={() => setSelected(locale)}>
                                        {name}
                                    </button>
                                    <button
                                        type="button"
                                        className="flex size-11 items-center justify-center text-lg leading-none text-neutral-400"
                                        aria-label={t("studio.translations.remove").replace("{lang}", name)}
                                        onClick={() => removeLocale(locale)}
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}
                {available.length > 0 && (
                    <label className="mb-3 grid gap-1 text-sm text-neutral-300">
                        {t("studio.translations.pickLanguage")}
                        <select
                            className="min-h-12 rounded-xl p-3 text-base text-black"
                            value=""
                            onChange={(e) => {
                                const next = e.target.value as Locale;
                                if (isLocale(next)) addLocale(next);
                            }}
                        >
                            <option value="">{t("studio.translations.pickLanguage")}</option>
                            {available.map((locale) => (
                                <option key={locale} value={locale}>
                                    {LOCALE_META[locale].nativeName}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {selected ? (
                    <div className="grid gap-2">
                        <label className="grid gap-1 text-sm">
                            {t("studio.translations.title")}
                            <input
                                ref={titleRef}
                                className="min-h-11 rounded-xl p-3 text-base text-black"
                                value={row?.title || ""}
                                maxLength={200}
                                onChange={(e) => patch(selected, "title", e.target.value)}
                            />
                        </label>
                        <label className="grid gap-1 text-sm">
                            {t("studio.translations.description")}
                            <textarea
                                ref={descriptionRef}
                                className="min-h-20 rounded-xl p-3 text-base text-black"
                                value={row?.description || ""}
                                maxLength={8000}
                                onChange={(e) => patch(selected, "description", e.target.value)}
                            />
                        </label>
                    </div>
                ) : null}
                <p className="mt-3 text-sm text-neutral-500">{t("studio.translations.writeHint")}</p>
                <button
                    type="button"
                    className="mt-4 min-h-12 w-full rounded-xl bg-yellow-500 p-3 text-base font-bold text-black"
                    onClick={closePanel}
                >
                    {t("studio.translations.done")}
                </button>
            </div>
        </div>
    ) : null;

    return (
        <TranslationsUiContext.Provider value={ctx}>
            {children}
            {open && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
        </TranslationsUiContext.Provider>
    );
}

export function ShowTranslationGlobe({ field }: { field: PanelField }) {
    const ui = useContext(TranslationsUiContext);
    if (!ui) return null;
    return (
        <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white"
            title={ui.label}
            aria-label={ui.label}
            onClick={(e) => ui.openPanel(field, e.currentTarget)}
        >
            <Globe className="size-4" aria-hidden />
            {ui.count > 0 ? <span className="text-xs font-semibold tabular-nums">{ui.count}</span> : null}
        </button>
    );
}
