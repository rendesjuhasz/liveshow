"use client";

import LocaleLink from "@/components/LocaleLink";
import { useT } from "@/lib/i18n/I18nProvider";

export default function PaymentFailedPage() {
    const { t } = useT();
    return (
        <div className="min-h-dvh bg-neutral-950 px-4 py-10 text-white sm:py-16">
            <div className="mx-auto max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 sm:p-8">
                <h1 className="text-2xl font-bold mb-4">{t("payment.failed")}</h1>
                <p className="text-neutral-300 mb-6">{t("payment.retry")}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <LocaleLink href="/shows" className="text-yellow-400 underline">
                        {t("payment.back")}
                    </LocaleLink>
                    <LocaleLink href="/profile" className="text-neutral-400 underline">
                        {t("payment.myTickets")}
                    </LocaleLink>
                </div>
            </div>
        </div>
    );
}
