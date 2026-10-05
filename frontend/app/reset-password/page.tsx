"use client";

import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ResetPasswordPage() {
    const { t } = useT();
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">{t("auth.loading")}</p>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
