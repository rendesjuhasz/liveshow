"use client";

import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ForgotPasswordPage() {
    const { t } = useT();
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">{t("auth.loading")}</p>}>
            <ForgotPasswordForm />
        </Suspense>
    );
}
