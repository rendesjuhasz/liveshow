"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, X } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

type PublicLinkDraft = { label: string; url: string };

const BTN =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl active:scale-95";

const ROW =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-accent hover:bg-white/10";

export default function CreatorPublicLinks({
    name,
    links,
}: {
    name?: string;
    links?: PublicLinkDraft[] | null;
}) {
    const { t } = useT();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const items = (links || []).filter((link) => link?.label && link?.url);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open, mounted]);

    if (!items.length) return null;

    const heading = name
        ? t("archive.creatorLinksNamed").replace("{name}", name)
        : t("archive.creatorLinks");

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
            <button
                type="button"
                className={BTN}
                aria-label={t("archive.creatorLinks")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
            >
                <Link2 className="size-5" aria-hidden />
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
                                  {heading}
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
                          <ul className="flex flex-col">
                              {items.map((link) => (
                                  <li key={`${link.label}-${link.url}`}>
                                      <a
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={ROW}
                                      >
                                          {link.label}
                                      </a>
                                  </li>
                              ))}
                          </ul>
                      </dialog>,
                      document.body,
                  )
                : null}
        </>
    );
}
