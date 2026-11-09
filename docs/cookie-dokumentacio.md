# Sütik és hozzájárulás-kezelés (LiveShow)

Állapot: a kódbázis 2026-11-03-i olvasása. **Alkalmazáskódot ez a dokumentum nem módosított.**

## Rövid összefoglaló

A LiveShow **saját süti-sávot** használ (nincs Cookiebot / OneTrust / Didomi). Az alsó sáv első látogatáskor megjelenik, **nem zárja le** az oldalt. A döntés (`accepted` / `rejected`) **localStorage**-ben van, kulcs: `cookieConsent`, **nincs lejárat**, **nincs adatbázis**.

A belépés, CSRF, HLS lejátszás és a nyelv **szükséges** sütiket / tárhelyet használ, **függetlenül** a sáv gombjától. A tájékoztató azt írja, hogy opcionális (analitikai) sütik csak elfogadás után indulnak. A frontendben **nincs** Google Analytics, Meta Pixel vagy más hozzájáruláshoz kötött külső tracker, és **nincs** olyan kódág, amely `accepted` nélkül ne töltene be ilyet — mert ilyet a saját kód nem tölt.

A tesztelő TC-001 fail-je (döntésig az oldal ne legyen használható) **eltér** a megvalósítástól: a sáv overlay nélkül, `pointer-events-none` a háttéren, kattintható csak a kártya.

---

## 1. Süti-sáv / consent banner

### Fájlok és komponensek

| Szerep | Útvonal |
|--------|---------|
| Sáv UI | `frontend/components/CookieBanner.tsx` |
| Döntés API (írás/olvasás) | `frontend/lib/cookie-consent.ts` |
| Beillesztés minden oldalon | `frontend/components/AppShell.tsx` 9., 68. |
| Tájékoztató oldali gombok | `frontend/components/CookieConsentControls.tsx` |
| Tájékoztató oldal | `frontend/app/cookie-tajekoztato/page.tsx` |
| Layout (SEO) | `frontend/app/cookie-tajekoztato/layout.tsx` |
| Szövegek (hu/en/de/it/es/fr) | `frontend/lib/i18n/messages.ts` 585–595. |

`AppShell` a gyökér layoutban van: `frontend/app/layout.tsx` 72–74.

### Külső szolgáltató / csomag

**Saját fejlesztés.** A `frontend/package.json` nem tartalmaz `cookie-consent`, Cookiebot, OneTrust, Didomi, `js-cookie` vagy `universal-cookie` függőséget. Nincs `gtag` / Cookiebot script a layoutban.

### Mikor jelenik meg

1. `CookieBanner` kezdetben `open = false` (`CookieBanner.tsx` 15.).
2. Mount után: `setOpen(!readCookieConsent())` (17–19.).
3. `readCookieConsent()` akkor ad értéket, ha a `localStorage` `cookieConsent` kulcsa pontosan `accepted` vagy `rejected` (`cookie-consent.ts` 16–28.).
4. Tehát a sáv akkor jön elő, ha **még nincs** érvényes döntés: első látogatás, más böngésző, privát ablak, törölt oldaladatok, vagy a tájékoztatón a „Döntés törlése”.
5. **Nincs időalapú lejárat** a döntésen. A sáv **nem** jön elő magától X nap után.

Megjegyzés: a `CookieBanner` **nem** figyeli a `liveshow-cookie-consent` eseményt. Ha a tájékoztatón törlöd a döntést **ugyanazon a betöltésen**, a sáv csak **újramount / újratöltés** után jelenik meg újra. A `CookieConsentControls` viszont azonnal frissül (`CookieConsentControls.tsx` 22–29.).

### Gombok

A sávon **két** gomb van. **Nincs** „Beállítások” / kategória-választó.

| Gomb | i18n kulcs | `data-cookie-choice` | Hatás |
|------|------------|----------------------|--------|
| Elfogadom | `cookie.accept` | `accepted` | `writeCookieConsent("accepted")`, sáv bezár (`CookieBanner.tsx` 21–27., 67–71.) |
| Elutasítom | `cookie.reject` | `rejected` | `writeCookieConsent("rejected")`, sáv bezár (21–27., 57–63.) |

Linkek a sáv szövegében (`CookieBanner.tsx` 47–53.):

- `/cookie-tajekoztato` — `t("legal.cookies")`
- `/adatkezeles` — `t("legal.privacy")`

A tájékoztató oldalon plusz gomb: **Döntés törlése** → `clearCookieConsent()` (`CookieConsentControls.tsx` 68–80.).

`writeCookieConsent` (`cookie-consent.ts` 31–34.):

- `localStorage.setItem("cookieConsent", value)`
- `document.documentElement.setAttribute("data-cookie-consent", value)`
- `window.dispatchEvent(new Event("liveshow-cookie-consent"))`

### Blokkolja-e az oldalt?

**Nem.**

- Külső wrapper: `pointer-events-none fixed inset-x-0 bottom-0 z-50` (`CookieBanner.tsx` 33–35.) — a teljes alsó sáv **átengedi** a kattintást az oldalra.
- Belső kártya: `pointer-events-auto` (41.) — csak a sáv tartalma kap egér/ujj eseményt.
- `role="dialog"` de `aria-modal="false"` (36–37.) — nem modal.
- Nincs sötét teljes képernyős overlay, nincs `overflow: hidden` / scroll lock a body-n.
- `AppShell` `overflowAnchor = "none"` (34.) a görgetés ugrálása ellen van, nem süti-zár.

Az oldal (menü, kártyák, belépés) **döntés nélkül is** használható. Ez a TC-001 elvárt „csak a sáv kattintható” viselkedéssel **ellentétes**, a kódban szándékos.

`AppShell` 27–32.: ha van mentett döntés, `data-cookie-consent` attribútum a `<html>`-en; mindig beállítja: `data-cookie-ready="1"`. Ezt más fájl **nem** olvassa szkript-kapcsolásra.

---

## 2. Döntés tárolása

| Kérdés | Válasz | Hivatkozás |
|--------|--------|------------|
| Hol? | **localStorage**, nem HTTP süti, nem adatbázis | `cookie-consent.ts` 18., 32. |
| Kulcs | `cookieConsent` | 1. |
| Érték | `"accepted"` vagy `"rejected"` (más érték = nincs döntés) | 4–7., 19–23. |
| Lejárat | Nincs (localStorage, amíg a user / kód törli) | — |
| Esemény | `liveshow-cookie-consent` | 2., 12–14. |
| HTML jelző | `data-cookie-consent` | 33., 39.; `AppShell.tsx` 28–30. |

Későbbi változtatás:

- Sáv: új `choose()` felülírja a kulcsot, sáv eltűnik.
- Tájékoztató: Elfogadom / Elutasítom ugyanaz; Döntés törlése kiveszi a kulcsot és az attribútumot (`cookie-consent.ts` 37–40.).
- **Nincs** szerver-szinkron, **nincs** user-rekord mező a consentre (a backendben nincs `cookieConsent` oszlop-használat ehhez a folyamathoz).

---

## 3. Sütik és böngészőtárhely

### 3.1 HTTP sütik (Set-Cookie / document.cookie)

Nincs `Domain=` a saját kódban → **host-only**, `path=/`, `SameSite=Lax`.

`Secure`: auth/HLS a backend `isHttpsRequest` szerint (`http-guard.ts` 132–149.; `auth.cookies.ts` 11.); locale süti productionben vagy HTTPS oldalon (`middleware.ts` 12–18.; `I18nProvider.tsx` 56–60.).

| Név | Ki állítja | Cél | Lejárat / maxAge | HttpOnly | Secure | SameSite | Kategória |
|-----|------------|-----|------------------|----------|--------|----------|-----------|
| `ls_access` | Nest `setAuthCookies` | Access JWT, belépés | 1 óra (`ACCESS_MS` = 3 600 000 ms) | **igen** | HTTPS-kérésnél | Lax | **Szükséges** (session) |
| `ls_refresh` | ugyanott | Refresh token | 7 nap | **igen** | ugyanaz | Lax | **Szükséges** |
| `ls_csrf` | `setCsrfCookie` | CSRF double-submit; JS olvashatja | 7 nap | **nem** | ugyanaz | Lax | **Szükséges** |
| `ls_hls` | `GET /token/generate`, archív preview | HLS lejátszás HMAC pecsét | élő 120 s, archív 300 s, preview 90 s | **igen** | ugyanaz | Lax | **Szükséges** (lejátszás) |
| `liveshow_locale` | Next middleware + `I18nProvider` | Nyelv | 1 év (31 536 000 s) | nem | prod / HTTPS | Lax | **Szükséges** (nyelv) |
| `liveshow_locale_chosen` | middleware + `I18nProvider` ha a user választott | Nyelv szándékos választás jele (`=1`) | 1 év | nem | ugyanaz | Lax | **Szükséges** (nyelv) |

Források:

- Nevek: `backend/src/security/http-guard.ts` 6–9.
- Auth opciók: `backend/src/auth/auth.cookies.ts` 4–29.
- Törlés kilépéskor: ugyanott 32–35.; `auth.controller.ts` 157–161.
- HLS TTL: `backend/src/security/token/token.service.ts` 5–6.; cookie: `token.controller.ts` 50–56.; preview: `public-archives.controller.ts` 63–68.
- Locale: `frontend/lib/i18n/locale-choice.ts` 3–4.; `middleware.ts` 12–18., 191–204.; `I18nProvider.tsx` 56–61.

**Olvasás a kliensen**

- `ls_csrf`: `frontend/api/auth-storage.ts` 21–35., 86–94. (`document.cookie`).
- Legacy `ls_token` **törlése** (Max-Age=0): `auth-storage.ts` 4., 38–41., 61. — a kód **nem** állít új `ls_token` JWT-t.
- `liveshow_locale` / chosen: `locale-choice.ts` 6–9.; middleware `request.cookies.get`.
- `ls_access` / `ls_refresh`: a böngésző JS **nem** olvassa; a kliens `getAuthToken()` mindig `null` (`auth-storage.ts` 64–67.). A middleware admin kapu a Cookie fejlécet **szerveren** továbbítja (`frontend/lib/admin-session.ts` 29.).

### 3.2 localStorage

Egyik kulcs sem kap `expires`. Semelyik nincs a süti-sáv `accepted` feltételéhez kötve.

| Kulcs | Fájl | Cél | Kategória |
|-------|------|-----|-----------|
| `cookieConsent` | `cookie-consent.ts` | Hozzájárulás | Consent (szükséges a sáv állapotához) |
| `liveshow_locale` | `I18nProvider.tsx` 28., 123–160. | Nyelv (süti mellett) | Szükséges |
| `liveshow_locale_chosen` | ugyanott 29., 123., 160. | Nyelv választva | Szükséges |
| `liveshow_ref` | `app/register/page.tsx` 12., 32–50. | Referral kód a regisztrációig | Funkció / marketing-szerű, **nem** a sávhoz kötve |
| `liveshow.streamer.supportSound` | `streamer-support-sound.ts` 5–14. | Készítő hangjelzés 0/1 | Funkció |
| `liveshow:fav:<userId\|anon>` | `library.ts` 14–15., 42–44., 58–72. | Kedvencek, max 80 | Funkció |
| `liveshow:watch-purged:4` | `library.ts` 12., 20–28. | Régi „folytatás” lista törlésének jele | Technikai |
| `liveshow:watch:*` (régi) | `library.ts` 25.; `layout.tsx` 61.; `AppShell.tsx` 36–41. | **Törlik** betöltéskor | — |
| `token` | `auth-storage.ts` 1., 56–57. | Legacy JWT — **törlés** sessionStorage-ből és localStorage-ből | — |

`http.ts` 163. a `liveshow_locale` kulcsot **olvassa** a `lang` query-hez.

### 3.3 sessionStorage

| Kulcs | Fájl | Cél | Élettartam |
|-------|------|-----|------------|
| `ls_csrf` | `auth-storage.ts` 2., 80–98. | CSRF másolat a sütiből | lap / fül |
| `token` | 56. | legacy törlés | — |
| `liveshow_viewer` | `viewer-key.ts` 1., 13–16. | Vendég néző UUID (stat / LiveKit / token) | fül |
| `liveshow_home_scroll` | `home-scroll.ts` 1., 22., 31. | Főoldal görgetés | fül |
| `liveshow_streamer_intent` | `streamer-login-intent.ts` 1–21. | Készítő belépési szándék `"1"` | fül |
| `liveshow_wish_tab` | `WishWall.tsx` 31., 94., 193. | Kívánság fal public/private fül | fül |

### 3.4 IndexedDB

Nincs `indexedDB` hivatkozás a `frontend` forrásban.

### 3.5 Adatbázis

A hozzájárulás **nincs** User táblában. A belépési refresh **hash**-e a User rekordon van (`refreshTokenHash`) — ez **nem** böngészősüti, szerveroldali.

---

## 4. Harmadik fél szkriptek

Saját `frontend/app/layout.tsx` **nem** tölt GA / Meta Pixel / Hotjar / chat widget scriptet. CSP (`middleware.ts` 21–38.): `script-src 'self' 'nonce-…' 'strict-dynamic'` (+ devben `'unsafe-eval'`). `connect-src` enged `http:` `https:` `ws:` `wss:` — hálózati hívás lehetséges, de a forrásban nincs tracker bootstrap.

| Forrás | Hogyan töltődik | Consent előtt/után | Megjegyzés |
|--------|-----------------|--------------------|------------|
| Saját Next bundle | same-origin | mindig | — |
| `hls.js` | npm, a lejátszó importálja (`Player.tsx`) | mindig, ha van HLS | nem süti-sáv |
| `livekit-client` | npm (`livekit-room.ts`) | élő LiveKit útvonalon | WebRTC a LiveKit szerverre; JWT a memóriában |
| `socket.io-client` | npm (`live-socket.ts`) | élő nézés / stúdió | saját `/live-io` |
| Google / Microsoft / Apple belépés | átirányítás `/api/auth/oauth/…` (`SocialAuthButtons.tsx` 3–5.; `oauth-providers.ts`) | gombnyomásra, **nem** a sávhoz kötve | a **szolgáltató** domainjén lehetnek sütik |
| Facebook / X / WhatsApp megosztás | `window.open` URL (`share-watch.ts` 22–37.) | megosztás gombra | nem beágyazott pixel |
| Stripe / Barion | API + redirect a fizetés oldalára; **nincs** `loadStripe` / `js.stripe.com` a frontendben | fizetéskor | a **fizető** domain sütije |
| `next/font/google` Outfit | `layout.tsx` 4–17. | build-time font | runtime Google Analytics **nincs** a kódban |
| Facebook App ID | `NEXT_PUBLIC_FACEBOOK_APP_ID` a Messenger share URL-ben | megosztáskor | nem Pixel |

A süti-sáv **`accepted` / `rejected` értéke egyetlen script-loaderben sem szerepel** (grep: csak banner, controls, AppShell attribútum).

---

## 5. Működés elutasítás és döntés nélkül

### Elutasítom

1. `cookieConsent=rejected` a localStorage-ben, sáv eltűnik.
2. **Nem** törlődnek `ls_access`, nyelv, HLS, CSRF.
3. **Nem** áll le belépés, lejátszás, OAuth, fizetés-redirect.
4. Nincs saját analitikai script, amit ki kellene kapcsolni — a kód nem indít ilyet elfogadáskor sem.

A tájékoztató szövege (`cookie-tajekoztato/page.tsx` 33–35., 39–42.; `adatkezeles/page.tsx` 72–78.) azt állítja: elutasítás után opcionális/analitikai sütik nem töltődnek; elfogadás után harmadik fél analitika. **A frontend forrásban nincs ehhez kötött loader.**

### Semmire nem kattint

1. Sáv alul marad (`open === true`).
2. `cookieConsent` hiányzik.
3. Az oldal **használható** (lásd 1. blokkolás).
4. Szükséges sütik ettől függetlenül beállhatnak (pl. locale middleware, belépés után auth, nézéskor `ls_hls`).

---

## 6. Kapcsolódó tartalom

| Tartalom | Hol |
|----------|-----|
| Cookie tájékoztató (HU, statikus) | `frontend/app/cookie-tajekoztato/page.tsx` (frissítve 2026. augusztus 23.) |
| Döntés UI a tájékoztatón | `CookieConsentControls.tsx` (gombfeliratok magyarul, nem i18n) |
| Adatkezelés, 7. § Sütik | `frontend/app/adatkezeles/page.tsx` 71–79. |
| Sáv szövege, 6 nyelv | `messages.ts` `cookie.title` / `cookie.body` / `cookie.accept` / `cookie.reject` 585–595. |
| Footer link | `SiteFooter.tsx` 10.; `LegalShell.tsx` 9. |
| SEO title/desc | `messages.ts` `seo.cookieTitle` 95., `seo.cookieDesc` 96.; `seo.ts` 56. |
| Layout metadata | `cookie-tajekoztato/layout.tsx` 7–8. |

Sáv törzse magyarul (`cookie.body`): a működéshez szükséges sütik + a hozzájárulás rögzítése; opcionális (pl. statisztikai) sütik csak elfogadás után.

---

## Táblázat: sütik és szkriptek (összesített)

| Név / szkript | Típus | Szükséges? | Consent kapu a kódban? |
|---------------|-------|------------|-------------------------|
| `ls_access` | HTTP süti | igen, belépés | nem |
| `ls_refresh` | HTTP süti | igen | nem |
| `ls_csrf` | HTTP süti + sessionStorage | igen | nem |
| `ls_hls` | HTTP süti | igen, stream | nem |
| `liveshow_locale` | HTTP süti + localStorage | igen, nyelv | nem |
| `liveshow_locale_chosen` | HTTP süti + localStorage | igen, nyelv | nem |
| `cookieConsent` | localStorage | sáv állapota | önmaga a döntés |
| `liveshow_ref` | localStorage | referral | nem |
| `liveshow.streamer.supportSound` | localStorage | UX | nem |
| `liveshow:fav:*` | localStorage | UX | nem |
| `liveshow_viewer` | sessionStorage | vendég ID | nem |
| `liveshow_home_scroll` | sessionStorage | UX | nem |
| `liveshow_streamer_intent` | sessionStorage | UX | nem |
| `liveshow_wish_tab` | sessionStorage | UX | nem |
| hls.js / livekit-client / socket.io-client | saját bundle | lejátszás | nem |
| GA / Meta Pixel / Cookiebot | — | — | **nincs a forrásban** |
| OAuth / Stripe / Barion / Facebook share | idegen oldal | fiók / fizetés / megosztás | nem a sáv |

---

## Amit nem találtam / bizonytalan

- **Éles Cloudflare** (`__cf_bm`, `cf_clearance`) sütiket a **saját repo nem állít**. Tunnel / CDN adhat ilyet; ez a kódból nem látszik.
- **Next.js / böngésző** belső sütik (`__next`, stb.) nincsenek a projektben név szerint.
- A tájékoztató **bejelentkezési tokent** is localStorage-hez köti (`cookie-tajekoztato/page.tsx` 21–23.). A **jelenlegi** auth JWT HttpOnly sütiben van; a `token` kulcsot a kliens **törli**. A tájékoztató ezen sora **elavult** lehet.
- Van-e **élesben** kézzel berakott GA a szerver HTML-be (Nginx, Cloudflare Worker) — a **gitelt frontendben nincs**. Ezt deploy konfigurációból nem ellenőriztem.
- `frontend_clean/` régi login `localStorage.setItem("token")` — **nem** a futó `AppShell` út.
- Marketing Facebook OAuth a **backenden** (`marketing.oauth.ts`); admin/készítő csatlakozás, nem a nézői sáv.
- A `CookieBanner` és a „Döntés törlése” **ugyanazon oldalon** való azonnali újra-megjelenése nincs összekötve eseményfigyelővel (lásd 1. szakasz).
- Jogilag a `liveshow_ref` és a vendég `liveshow_viewer` „szükséges vs marketing” besorolása **termék/jogi** kérdés; a kód nem kategorizálja, és nem köti a sávhoz.

---

## Kapcsolat a TC-001 teszttel

Elvárt: első betöltéskor az oldal ne legyen használható a sávon kívül.  
Kód: sáv van, oldal használható (`pointer-events-none` a wrapperen).  
Ez **specifikáció-eltérés**, nem eltűnt banner.
