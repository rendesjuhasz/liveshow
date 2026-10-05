import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "./lib/i18n/messages";
import {
    LOCALE_CHOSEN_COOKIE,
    LOCALE_COOKIE,
    needsLocalePrefixRedirect,
    resolvePublicLocale,
} from "./lib/i18n/locale-choice";
import { isLocalePrefixedAppPath, stripLocalePrefix, withLocalePrefix } from "./lib/i18n/paths";
import { fetchAdminSession, isAdminConsolePath, isAdminLoginPath } from "./lib/admin-session";

function localeCookie() {
    return {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
    };
}

function cspHeader(nonce: string) {
    const isProd = process.env.NODE_ENV === "production";
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: http: https:",
        "connect-src 'self' http://127.0.0.1:3200 http://localhost:3200 http: https: ws: wss:",
        "font-src 'self' data:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        isProd ? "upgrade-insecure-requests" : "",
    ]
        .filter(Boolean)
        .join("; ");
}

function applyMediaPermissions(response: NextResponse) {
    response.headers.set(
        "Permissions-Policy",
        "camera=(self), microphone=(self), geolocation=()",
    );
    response.headers.set(
        "Feature-Policy",
        "camera 'self'; microphone 'self'; geolocation 'none'",
    );
    return response;
}

function withNonce(request: NextRequest, extra?: Headers) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = cspHeader(nonce);
    const requestHeaders = new Headers(extra || request.headers);
    const { path } = stripLocalePrefix(request.nextUrl.pathname);
    requestHeaders.set("x-liveshow-path", path);
    requestHeaders.set("x-nonce", nonce);
    if (!requestHeaders.get("x-locale")) {
        const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
        requestHeaders.set("x-locale", isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE);
    }
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return applyMediaPermissions(response);
}

function withCsp(response: NextResponse) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    response.headers.set("Content-Security-Policy", cspHeader(nonce));
    return applyMediaPermissions(response);
}

function clientHost(request: NextRequest) {
    return (
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        ""
    )
        .split(",")[0]
        .trim();
}

function publicAbsoluteUrl(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const host = clientHost(request).split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
        url.hostname = host;
        if (isBrowserHttps(request)) {
            url.protocol = "https:";
            url.port = "";
        }
    }
    return url;
}

function redirectWwwToApex(request: NextRequest) {
    const host = clientHost(request).split(":")[0].toLowerCase();
    if (host !== "www.streamtest.hu") return null;
    const url = request.nextUrl.clone();
    url.hostname = "streamtest.hu";
    url.protocol = "https:";
    url.port = "";
    return withCsp(NextResponse.redirect(url, 308));
}

function isBrowserHttps(request: NextRequest) {
    const proto = (request.headers.get("x-forwarded-proto") || "")
        .split(",")[0]
        .trim()
        .toLowerCase();
    if (proto === "https") return true;
    if (request.nextUrl.protocol === "https:") return true;
    const cf = `${request.headers.get("cf-visitor") || ""} ${request.headers.get("x-forwarded-ssl") || ""}`;
    if (cf.toLowerCase().includes("https") || cf.toLowerCase().includes(" on")) return true;
    const host = clientHost(request).split(":")[0].toLowerCase();
    return (
        host === "streamtest.hu" ||
        host.endsWith(".streamtest.hu") ||
        host.endsWith(".trycloudflare.com") ||
        host.endsWith(".ngrok-free.app") ||
        host.endsWith(".ngrok.app") ||
        host.endsWith(".ngrok.io") ||
        host.endsWith(".loca.lt")
    );
}

function withUpstreamHttpsHints(request: NextRequest) {
    const headers = new Headers(request.headers);
    headers.set("x-liveshow-client-host", clientHost(request));
    if (isBrowserHttps(request)) {
        headers.set("x-forwarded-proto", "https");
        headers.set("x-forwarded-ssl", "on");
    }
    return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
    const offWww = redirectWwwToApex(request);
    if (offWww) return offWww;

    const { pathname } = request.nextUrl;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
        return withUpstreamHttpsHints(request);
    }

    if (isAdminConsolePath(pathname)) {
        const session = await fetchAdminSession(request.headers.get("cookie") || "");
        if (isAdminLoginPath(pathname)) {
            if (session.kind === "admin") {
                const url = request.nextUrl.clone();
                url.pathname = "/admin";
                url.search = "";
                return withCsp(NextResponse.redirect(url));
            }
        } else if (session.kind !== "admin") {
            const url = request.nextUrl.clone();
            url.pathname = "/admin/login";
            url.search = session.kind === "user" ? "error=forbidden" : "";
            return withCsp(NextResponse.redirect(url));
        }
    }

    if (process.env.NODE_ENV === "production") {
        const proto = request.headers.get("x-forwarded-proto");
        if (proto === "http") {
            const url = request.nextUrl.clone();
            url.protocol = "https:";
            return withCsp(NextResponse.redirect(url, 308));
        }
    }

    if (!isLocalePrefixedAppPath(pathname)) {
        return withNonce(request);
    }

    const { locale: pathLocale, path } = stripLocalePrefix(pathname);
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const localeChosen = request.cookies.get(LOCALE_CHOSEN_COOKIE)?.value === "1";
    const chosen = resolvePublicLocale(pathLocale, cookieLocale, localeChosen);

    if (needsLocalePrefixRedirect(pathLocale, chosen)) {
        const res = NextResponse.redirect(publicAbsoluteUrl(request, withLocalePrefix(path, chosen)));
        res.cookies.set(LOCALE_COOKIE, chosen, localeCookie());
        res.cookies.set(LOCALE_CHOSEN_COOKIE, "1", localeCookie());
        const out = withCsp(res);
        out.headers.set("Cache-Control", "private, no-store");
        return out;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", String(chosen));
    requestHeaders.set("x-pathname", path);
    const res = withNonce(request, requestHeaders);
    res.headers.set("Cache-Control", "private, no-store");
    if (chosen) {
        res.cookies.set(LOCALE_COOKIE, String(chosen), localeCookie());
    }
    return res;
}

export const config = {
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico|socket\\.io|live-io).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
