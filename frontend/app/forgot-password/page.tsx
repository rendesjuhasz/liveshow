"use client";

import { Suspense } from "react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<p className="p-8 text-zinc-400">Betöltés...</p>}>
            <ForgotPasswordForm />
        </Suspense>
    );
}
