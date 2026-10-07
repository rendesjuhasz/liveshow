"use client";

import { useRef, useState, type PointerEvent } from "react";

const HOLD_MS = 2000;

export default function StreamerHoldStop({
    disabled,
    landscape,
    busyLabel,
    onArmed,
}: {
    disabled?: boolean;
    landscape?: boolean;
    busyLabel?: string;
    onArmed: () => void;
}) {
    const [pct, setPct] = useState(0);
    const [holding, setHolding] = useState(false);
    const raf = useRef(0);
    const armed = useRef(false);

    function clearHold() {
        window.cancelAnimationFrame(raf.current);
        armed.current = false;
        setHolding(false);
        setPct(0);
    }

    function onDown(ev: PointerEvent<HTMLButtonElement>) {
        if (disabled) return;
        ev.preventDefault();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        armed.current = false;
        setHolding(true);
        const start = performance.now();
        const tick = (now: number) => {
            const next = Math.min(1, (now - start) / HOLD_MS);
            setPct(next);
            if (next >= 1) {
                if (!armed.current) {
                    armed.current = true;
                    onArmed();
                }
                setHolding(false);
                setPct(0);
                return;
            }
            raf.current = window.requestAnimationFrame(tick);
        };
        raf.current = window.requestAnimationFrame(tick);
    }

    function onUp() {
        if (armed.current) {
            window.cancelAnimationFrame(raf.current);
            armed.current = false;
            setHolding(false);
            setPct(0);
            return;
        }
        clearHold();
    }

    return (
        <button
            type="button"
            disabled={disabled}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onLostPointerCapture={onUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Adás leállítása: tartsd nyomva két másodpercig"
            className={`relative overflow-hidden touch-none border border-white/25 bg-white/5 font-medium text-red-100/90 shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md disabled:opacity-40 ${
                landscape
                    ? "mt-0 min-h-10 shrink-0 basis-28 rounded-xl text-xs"
                    : "mt-3 min-h-11 w-full max-w-[13rem] self-center rounded-xl text-sm"
            }`}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-[#fe2c55]/90 transition-[width] duration-75"
                style={{ width: `${Math.round(pct * 100)}%` }}
            />
            <span className="relative z-10">
                {busyLabel ? busyLabel : holding ? "Tartsd nyomva…" : "Tartsd: leállítás"}
            </span>
        </button>
    );
}
