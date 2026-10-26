"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircleQuestion, X } from "lucide-react";
import ShowTalk from "@/app/live/[id]/ShowTalk";
import { useT } from "@/lib/i18n/I18nProvider";

const BTN =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.55)] active:scale-95";

export default function ViewerQuestionMenu({
    showId,
    ownShow = false,
    live = true,
}: {
    showId: string;
    ownShow?: boolean;
    live?: boolean;
}) {
    const { t } = useT();
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
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
                aria-label={t("talk.title")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
            >
                <MessageCircleQuestion className="size-5" aria-hidden />
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
                                  {t("talk.title")}
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
                          <ShowTalk showId={showId} ownShow={ownShow} live={live} canAsk={!ownShow} variant="plain" />
                      </dialog>,
                      document.body,
                  )
                : null}
        </>
    );
}
