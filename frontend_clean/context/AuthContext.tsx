"use client";
import { createContext, useContext, useState } from "react";

type User = {
    id: string;
    email: string;
};

type AuthContextType = {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    register: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: () => { },
    logout: () => { },
    register: async () => { },
});

export function AuthProvider({ children }: any) {
    const [user, setUser] = useState<User | null>(null);

    function login(u: User) {
        setUser(u);
    }

    function logout() {
        setUser(null);
    }

    async function register(email: string, password: string) {
        const res = await fetch("http://localhost:3000/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            throw new Error("A regisztráció sikertelen.");
        }

        // Ha szeretnéd, itt automatikusan be is jelentkeztethet:
        // const data = await res.json();
        // setUser({ id: data.id, email: data.email });
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
