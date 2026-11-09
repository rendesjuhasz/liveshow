"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { apiFetch, apiUpload } from "@/api/http";
import {
    COOKIE_SESSION,
    clearAuthToken,
    isUnauthorizedError,
} from "@/api/auth-storage";
import {
    isAdminRole,
    isModeratorRole,
    isStreamerRole,
    normalizeRole,
    type UserRole,
} from "@/lib/roles";
import { FALLBACK_GUEST_LOCALE, isLocale } from "@/lib/i18n/messages";

export type User = {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    locale?: string | null;
    timezone?: string | null;
    role: UserRole;
    isAdmin?: boolean;
    xp?: number;
    badges?: { id: string; key: string; title: string; description: string }[];
    streamer?: {
        id: string;
        name: string;
        status: string;
    } | null;
    emailVerified?: boolean;
    totpEnabled?: boolean;
};

export type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextType = {
    user: User | null;
    token: string | null;
    ready: boolean;
    status: AuthStatus;
    login: (email: string, password: string) => Promise<User>;
    logout: () => void;
    register: (
        email: string,
        password: string,
        name: string,
        referralCode?: string,
        username?: string,
    ) => Promise<User>;
    registerStreamer: (formData: FormData) => Promise<void>;
    refreshUser: () => Promise<User | null>;
    refreshSession: () => Promise<User | null>;
    acceptSession: (data: unknown) => User | null;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    ready: false,
    status: "loading",
    login: async () => {
        throw new Error("AuthProvider hiányzik.");
    },
    logout: () => {},
    register: async () => {
        throw new Error("AuthProvider hiányzik.");
    },
    registerStreamer: async () => {},
    refreshUser: async () => null,
    refreshSession: async () => null,
    acceptSession: () => null,
});

function parseUser(data: any): User | null {
    const raw = data?.user ?? data;
    const id = raw?.id ?? raw?.sub;
    const email = raw?.email;
    if (!id || !email) return null;
    return {
        id: String(id),
        email: String(email),
        name: String(raw.name || raw.streamer?.name || data?.streamer?.name || "").trim() || null,
        username: String(raw.username || "").trim() || null,
        locale: (() => {
            const value = String(raw.locale || "").trim().toLowerCase();
            if (isLocale(value)) return value;
            const primary = value.split("-")[0];
            return isLocale(primary) ? primary : undefined;
        })(),
        timezone: raw.timezone ? String(raw.timezone) : undefined,
        role: raw.isAdmin === true || normalizeRole(raw.role) === "admin" ? "admin" : normalizeRole(raw.role),
        isAdmin: raw.isAdmin === true || normalizeRole(raw.role) === "admin",
        totpEnabled: raw.totpEnabled === true,
        xp: typeof raw.xp === "number" ? raw.xp : undefined,
        badges: Array.isArray(raw.badges) ? raw.badges : undefined,
        streamer: raw?.streamer
            ? {
                  id: String(raw.streamer.id),
                  name: String(raw.streamer.name || ""),
                  status: String(raw.streamer.status || ""),
              }
            : data?.streamer
              ? {
                    id: String(data.streamer.id),
                    name: String(data.streamer.name || ""),
                    status: String(data.streamer.status || ""),
                }
              : null,
        emailVerified: raw.emailVerified !== false,
    };
}

export function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const signedInRef = useRef(false);
    const sessionEpoch = useRef(0);

    const applySession = useCallback((signedIn: boolean, nextUser: User | null) => {
        if (signedIn && nextUser) {
            signedInRef.current = true;
            setToken(COOKIE_SESSION);
            setUser(nextUser);
        } else {
            signedInRef.current = false;
            clearAuthToken();
            setToken(null);
            setUser(null);
        }
    }, []);

    const acceptSession = useCallback(
        (data: unknown) => {
            sessionEpoch.current += 1;
            const nextUser = parseUser(data);
            if (nextUser) applySession(true, nextUser);
            return nextUser;
        },
        [applySession],
    );

    const loadMe = useCallback(async () => {
        const epoch = ++sessionEpoch.current;
        const data = await apiFetch("/auth/me");
        const nextUser = parseUser(data);
        if (!nextUser) {
            throw new Error("Érvénytelen /auth/me válasz.");
        }
        if (epoch !== sessionEpoch.current) return nextUser;
        applySession(true, nextUser);
        return nextUser;
    }, [applySession]);

    const refreshUser = useCallback(async () => {
        const epoch = sessionEpoch.current + 1;
        try {
            return await loadMe();
        } catch (err) {
            if (isUnauthorizedError(err)) {
                if (epoch === sessionEpoch.current) applySession(false, null);
                return null;
            }
            throw err;
        }
    }, [applySession, loadMe]);

    useEffect(() => {
        let cancelled = false;
        const epoch = sessionEpoch.current + 1;

        (async () => {
            try {
                await loadMe();
            } catch (err) {
                if (cancelled) return;
                if (isUnauthorizedError(err) && epoch === sessionEpoch.current) {
                    applySession(false, null);
                }
            }
            if (!cancelled) setReady(true);
        })();

        return () => {
            cancelled = true;
            sessionEpoch.current += 1;
        };
    }, [applySession, loadMe]);

    const login = useCallback(
        async (email: string, password: string) => {
            sessionEpoch.current += 1;
            const data = await apiFetch("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });
            const fallback = parseUser(data);
            if (fallback) applySession(true, fallback);
            try {
                return await loadMe();
            } catch {
                if (fallback) return fallback;
                throw new Error("A belépés sikerült, de a profil nem tölthető be. Frissítsd az oldalt.");
            }
        },
        [applySession, loadMe],
    );

    const register = useCallback(
        async (email: string, password: string, name: string, referralCode?: string, username?: string) => {
            sessionEpoch.current += 1;
            const lang =
                typeof document !== "undefined" ? document.documentElement.lang : "";
            const locale = isLocale(lang) ? lang : FALLBACK_GUEST_LOCALE;
            const data = await apiFetch("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    username,
                    referralCode,
                    locale,
                }),
            });
            const fallback = parseUser(data);
            if (fallback) applySession(true, fallback);
            try {
                return await loadMe();
            } catch {
                if (fallback) return fallback;
                throw new Error("A regisztráció sikerült, de a profil nem tölthető be.");
            }
        },
        [applySession, loadMe],
    );

    const registerStreamer = useCallback(
        async (formData: FormData) => {
            sessionEpoch.current += 1;
            const lang =
                typeof document !== "undefined" ? document.documentElement.lang : "";
            const locale = isLocale(lang) ? lang : FALLBACK_GUEST_LOCALE;
            if (!formData.get("locale")) formData.append("locale", locale);
            const data = await apiUpload("/auth/register-streamer", formData);
            const fallback = parseUser(data);
            if (fallback) applySession(true, fallback);
            await loadMe();
        },
        [applySession, loadMe],
    );

    const logout = useCallback(() => {
        sessionEpoch.current += 1;
        void apiFetch("/auth/logout", { method: "POST", skipRefresh: true }).catch(() => undefined);
        applySession(false, null);
    }, [applySession]);

    const status: AuthStatus = !ready ? "loading" : user ? "authenticated" : "guest";

    const value = useMemo(
        () => ({
            user,
            token,
            ready,
            status,
            login,
            logout,
            register,
            registerStreamer,
            refreshUser,
            refreshSession: refreshUser,
            acceptSession,
        }),
        [
            user,
            token,
            ready,
            status,
            login,
            logout,
            register,
            registerStreamer,
            refreshUser,
            acceptSession,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}

export function isAdmin(user: User | null) {
    return isAdminRole(user);
}

export function isModerator(user: User | null) {
    return isModeratorRole(user);
}

export function isStreamer(user: User | null) {
    return isStreamerRole(user) || Boolean(user?.streamer);
}
