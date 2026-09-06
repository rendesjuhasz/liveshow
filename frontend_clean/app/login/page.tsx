"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleLogin(e: any) {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("http://localhost:3200/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Hibás bejelentkezés");
                return;
            }

            // token mentése
            localStorage.setItem("token", data.token);

            router.push("/");
        } catch (err) {
            setError("Hiba történt a bejelentkezés során.");
        }
    }

    return (
        <div style={{ maxWidth: 400, margin: "50px auto" }}>
            <h1>Bejelentkezés</h1>

            <form onSubmit={handleLogin}>
                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label style={{ marginTop: 10 }}>Jelszó</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                {error && <p style={{ color: "red" }}>{error}</p>}

                <button type="submit" style={{ marginTop: 20 }}>
                    Belépés
                </button>
            </form>
        </div>
    );
}
