"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Share2, X } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { shareNetworkUrl } from "@/lib/share-watch";

const BTN =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] active:scale-95";

const ROW =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-white hover:bg-white/10";

export default function ViewerShareMenu({ url }: { url: string }) {
    const { t } = useT();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open, mounted]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 2500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    async function copyLink() {
        setCopyError(false);
        setCopied(true);
        const ok = await writeClipboard(url);
        if (!ok) {
            setCopied(false);
            setCopyError(true);
        }
    }

    function openNetwork(network: "facebook" | "messenger" | "x" | "whatsapp") {
        const href = shareNetworkUrl(network, url);
        window.open(href, "_blank", "noopener,noreferrer");
    }

    function onDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const rect = dialog.getBoundingClientRect();
        const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
        if (outside) setOpen(false);
    }

    return (
        <>
            <button type="button" className={BTN} aria-label={t("share.button")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
                <Share2 className="size-5" aria-hidden />
            </button>
            {mounted && open
                ? createPortal(
                      <dialog
                          ref={dialogRef}
                          className="viewer-share-dialog"
                          aria-labelledby={titleId}
                          onCancel={(event) => {
                              event.preventDefault();
                              setOpen(false);
                          }}
                          onClose={() => setOpen(false)}
                          onClick={onDialogClick}
                      >
                          <div className="mb-3 flex items-center justify-between">
                              <h2 id={titleId} className="text-lg font-bold text-white">
                                  {t("share.title")}
                              </h2>
                              <button
                                  type="button"
                                  className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                                  aria-label={t("share.close")}
                                  onClick={() => setOpen(false)}
                              >
                                  <X className="size-5" />
                              </button>
                          </div>
                          <p className="mb-2 truncate rounded-lg bg-black px-3 py-2 text-xs text-zinc-200" title={url}>
                              {url}
                          </p>
                          <div className="flex flex-col">
                              <button type="button" className={ROW} onClick={() => void copyLink()}>
                                  {copied ? <Check className="size-5 text-emerald-400" /> : <Copy className="size-5" />}
                                  {copied ? t("share.copied") : t("share.copy")}
                              </button>
                              <p className="sr-only" aria-live="polite">
                                  {copied ? t("share.copied") : copyError ? t("share.copyFail") : ""}
                              </p>
                              {copyError ? <p className="px-3 pb-2 text-sm text-red-400">{t("share.copyFail")}</p> : null}
                              {copied ? (
                                  <p role="status" className="mx-3 mb-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
                                      {t("share.copied")}
                                  </p>
                              ) : null}
                              <button type="button" className={ROW} onClick={() => openNetwork("facebook")}>
                                  <BrandMark tone="#1877F2">f</BrandMark>
                                  {t("share.facebook")}
                              </button>
                              <button type="button" className={ROW} onClick={() => openNetwork("messenger")}>
                                  <BrandMark tone="#006AFF">m</BrandMark>
                                  {t("share.messenger")}
                              </button>
                              <button type="button" className={ROW} onClick={() => openNetwork("x")}>
                                  <BrandMark tone="#111">X</BrandMark>
                                  {t("share.x")}
                              </button>
                              <button type="button" className={ROW} onClick={() => openNetwork("whatsapp")}>
                                  <BrandMark tone="#25D366">W</BrandMark>
                                  {t("share.whatsapp")}
                              </button>
                          </div>
                      </dialog>,
                      document.body,
                  )
                : null}
        </>
    );
}

async function writeClipboard(text: string) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* insecure context / missing permission — try execCommand */
    }
    try {
        const input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.top = "0";
        input.style.left = "0";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        input.remove();
        return ok;
    } catch {
        return false;
    }
}

function BrandMark({ tone, children }: { tone: string; children: string }) {
    return (
        <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
            style={{ background: tone }}
            aria-hidden
        >
            {children}
        </span>
    );
}
