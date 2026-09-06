"use client";

import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">Betöltés...</p>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
