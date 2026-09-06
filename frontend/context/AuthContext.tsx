"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { apiFetch, apiUpload } from "@/api/http";
import {
    clearAuthToken,
    getAuthToken,
    isUnauthorizedError,
    setAuthToken,
} from "@/api/auth-storage";
import {
    isAdminRole,
    isModeratorRole,
    isStreamerRole,
    normalizeRole,
    type UserRole,
} from "@/lib/roles";

export type User = {
    id: string;
    email: string;
    name?: string | null;
    locale?: string | null;
    role: UserRole;
    xp?: number;
    badges?: { id: string; key: string; title: string; description: string }[];
    streamer?: {
        id: string;
        name: string;
        status: string;
    } | null;
};

type AuthContextType = {
    user: User | null;
    token: string | null;
    ready: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => void;
    register: (email: string, password: string, name: string, referralCode?: string) => Promise<User>;
    registerStreamer: (formData: FormData) => Promise<void>;
    refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    ready: false,
    login: async () => {
        throw new Error("AuthProvider hiányzik.");
    },
    logout: () => {},
    register: async () => {},
    registerStreamer: async () => {},
    refreshUser: async () => null,
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
        locale: raw.locale ? String(raw.locale) : undefined,
        role: normalizeRole(raw.role),
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
    };
}

function userFromJwt(token: string): User | null {
    try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) return null;
        const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
        return parseUser(JSON.parse(json));
    } catch {
        return null;
    }
}

function tokenFromAuthResponse(data: any): string | null {
    const token = data?.token || data?.access_token;
    return typeof token === "string" && token.trim() ? token.trim() : null;
}

export function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const applySession = useCallback((nextToken: string | null, nextUser: User | null) => {
        if (nextToken) {
            setAuthToken(nextToken);
            setToken(nextToken);
        } else {
            clearAuthToken();
            setToken(null);
        }
        setUser(nextUser);
    }, []);

    const loadMe = useCallback(async (sessionToken: string) => {
        setAuthToken(sessionToken);
        const data = await apiFetch("/auth/me");
        const nextUser = parseUser(data);
        if (!nextUser) {
            throw new Error("Érvénytelen /auth/me válasz.");
        }
        applySession(sessionToken, nextUser);
        return nextUser;
    }, [applySession]);

    const refreshUser = useCallback(async () => {
        const stored = getAuthToken();
        if (!stored) {
            applySession(null, null);
            return null;
        }

        try {
            return await loadMe(stored);
        } catch (err) {
            if (isUnauthorizedError(err)) {
                applySession(null, null);
                return null;
            }
            throw err;
        }
    }, [applySession, loadMe]);

    useEffect(() => {
        const stored = getAuthToken();
        if (!stored) {
            setReady(true);
            return;
        }

        setToken(stored);
        const optimistic = userFromJwt(stored);
        if (optimistic) {
            setUser(optimistic);
        }
        setReady(true);

        let cancelled = false;

        loadMe(stored)
            .catch((err) => {
                if (cancelled) return;
                if (isUnauthorizedError(err)) {
                    applySession(null, null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [applySession, loadMe]);

    const login = useCallback(async (email: string, password: string) => {
        const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        const nextToken = tokenFromAuthResponse(data);
        if (!nextToken) {
            throw new Error("A belépés nem adott vissza tokent.");
        }

        const fallback = parseUser(data) || userFromJwt(nextToken);
        applySession(nextToken, fallback);
        try {
            return await loadMe(nextToken);
        } catch {
            if (fallback) return fallback;
            throw new Error("A belépés sikerült, de a profil nem tölthető be. Frissítsd az oldalt.");
        }
    }, [applySession, loadMe]);

    const register = useCallback(async (email: string, password: string, name: string, referralCode?: string) => {
        const data = await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({
                email,
                password,
                name,
                referralCode,
                locale: typeof window !== "undefined" ? window.localStorage.getItem("liveshow_locale") || "hu" : "hu",
            }),
        });

        const nextToken = tokenFromAuthResponse(data);
        if (!nextToken) {
            throw new Error("A regisztráció nem adott vissza tokent.");
        }

        applySession(nextToken, parseUser(data) || userFromJwt(nextToken));
        try {
            return await loadMe(nextToken);
        } catch {
            const fallback = parseUser(data) || userFromJwt(nextToken);
            if (fallback) return fallback;
            throw new Error("A regisztráció sikerült, de a profil nem tölthető be.");
        }
    }, [applySession, loadMe]);

    const registerStreamer = useCallback(async (formData: FormData) => {
        const data = await apiUpload("/auth/register-streamer", formData);

        const nextToken = tokenFromAuthResponse(data);
        if (!nextToken) {
            throw new Error("A streamer regisztráció nem adott vissza tokent.");
        }

        applySession(nextToken, parseUser(data) || userFromJwt(nextToken));
        await loadMe(nextToken);
    }, [applySession, loadMe]);

    const logout = useCallback(() => {
        applySession(null, null);
    }, [applySession]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                ready,
                login,
                logout,
                register,
                registerStreamer,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
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
