import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, detectLocale, isLocale } from "./lib/i18n/messages";
import { isLocalePrefixedAppPath, stripLocalePrefix, withLocalePrefix } from "./lib/i18n/paths";

const COOKIE = "liveshow_locale";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (!isLocalePrefixedAppPath(pathname)) return NextResponse.next();

    const { locale: pathLocale, path } = stripLocalePrefix(pathname);
    const cookieLocale = request.cookies.get(COOKIE)?.value;
    const chosen = isLocale(cookieLocale)
        ? cookieLocale
        : pathLocale !== DEFAULT_LOCALE
          ? pathLocale
          : detectLocale(request.headers.get("accept-language"));

    if (pathLocale !== DEFAULT_LOCALE && pathLocale !== chosen && isLocale(cookieLocale)) {
        const url = request.nextUrl.clone();
        url.pathname = withLocalePrefix(path, chosen);
        const res = NextResponse.redirect(url);
        res.cookies.set(COOKIE, chosen, { path: "/", maxAge: 60 * 60 * 24 * 365 });
        return res;
    }

    if (pathLocale === DEFAULT_LOCALE && chosen !== DEFAULT_LOCALE) {
        const url = request.nextUrl.clone();
        url.pathname = withLocalePrefix(path, chosen);
        const res = NextResponse.redirect(url);
        res.cookies.set(COOKIE, chosen, { path: "/", maxAge: 60 * 60 * 24 * 365 });
        return res;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", String(chosen));
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (!cookieLocale && chosen) {
        res.cookies.set(COOKIE, String(chosen), { path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
