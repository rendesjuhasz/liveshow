"use client";

function href(provider: "google" | "microsoft" | "apple", nextPath?: string) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    return `/api/auth/oauth/${provider}${next}`;
}

function GoogleMark() {
    return (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46c-.28 1.48-1.12 2.74-2.4 3.58v2.98h3.88c2.27-2.09 3.55-5.17 3.55-8.59z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-2.98c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.07C3.25 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.3A7.23 7.23 0 0 1 4.89 12c0-.8.14-1.57.38-2.3V6.63H1.27A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.27 5.37l4-3.07z" />
            <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.63l4 3.07C6.22 6.86 8.87 4.75 12 4.75z" />
        </svg>
    );
}

function MicrosoftMark() {
    return (
        <svg className="size-5 shrink-0" viewBox="0 0 23 23" aria-hidden>
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M12 1h10v10H12z" />
            <path fill="#00A4EF" d="M1 12h10v10H1z" />
            <path fill="#FFB900" d="M12 12h10v10H12z" />
        </svg>
    );
}

function AppleMark({ className }: { className?: string }) {
    return (
        <svg className={className || "size-5 shrink-0"} viewBox="0 0 24 24" aria-hidden fill="currentColor">
            <path d="M16.37 1.5c.03 1.32-.48 2.6-1.37 3.54-.9.96-2.2 1.7-3.52 1.6-.08-1.28.5-2.6 1.35-3.5.92-.98 2.3-1.7 3.54-1.64zM20.9 17.3c-.54 1.24-.8 1.8-1.5 2.9-1.02 1.55-2.46 3.48-4.24 3.5-1.58.02-2 .99-3.76 1-1.77.01-2.24-.98-3.83-1-1.78-.03-3.14-1.76-4.16-3.3C1.2 16.9-.4 11.6 1.86 8.08c1.12-1.75 3.1-2.86 4.96-2.86 1.85 0 3.02 1.02 4.55 1.02 1.5 0 2.41-1.03 4.56-1.03 1.62 0 3.34.88 4.45 2.4-3.91 2.14-3.28 7.72.52 9.7z" />
        </svg>
    );
}

export default function SocialAuthButtons({
    nextPath,
    googleLabel,
    microsoftLabel,
    appleLabel,
}: {
    nextPath?: string;
    googleLabel: string;
    microsoftLabel: string;
    appleLabel: string;
}) {
    const btn =
        "flex min-h-11 w-full items-center justify-center gap-3 rounded-md px-4 text-sm font-semibold tracking-tight transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
    return (
        <div className="grid gap-3">
            <a
                href={href("google", nextPath)}
                className={`${btn} bg-white text-[#1f1f1f] shadow-[0_0_0_1px_#dadce0] hover:bg-[#f7f8f8] focus-visible:outline-[#4285F4]`}
            >
                <GoogleMark />
                {googleLabel}
            </a>
            <a
                href={href("microsoft", nextPath)}
                className={`${btn} bg-white text-[#5e5e5e] shadow-[0_0_0_1px_#8c8c8c] hover:bg-[#f2f2f2] focus-visible:outline-[#2f2f2f]`}
            >
                <MicrosoftMark />
                {microsoftLabel}
            </a>
            <a
                href={href("apple", nextPath)}
                className={`${btn} bg-white text-black focus-visible:outline-white`}
            >
                <AppleMark className="size-5 shrink-0 text-black" />
                {appleLabel}
            </a>
        </div>
    );
}
