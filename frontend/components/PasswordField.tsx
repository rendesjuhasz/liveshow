"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";
import { useMounted } from "@/lib/use-mounted";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
    tone?: "onDark" | "onLight";
};

export default function PasswordField({ className, tone = "onDark", ...props }: PasswordFieldProps) {
    const { t } = useT();
    const mounted = useMounted();
    const [visible, setVisible] = useState(false);
    const label = visible ? t("auth.hidePassword") : t("auth.showPassword");

    return (
        <div className="relative">
            <input
                {...props}
                type={visible ? "text" : "password"}
                className={cn("w-full pr-12", className)}
            />
            <button
                type="button"
                className={cn(
                    "absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xl transition-colors duration-200",
                    tone === "onLight"
                        ? "text-neutral-600 hover:text-black"
                        : "text-zinc-400 hover:text-white",
                )}
                onClick={() => setVisible((v) => !v)}
                aria-label={label}
                aria-pressed={visible}
                title={label}
            >
                <span className="flex size-5 items-center justify-center">
                    {mounted ? visible ? <EyeOff className="size-5" /> : <Eye className="size-5" /> : null}
                </span>
            </button>
        </div>
    );
}
