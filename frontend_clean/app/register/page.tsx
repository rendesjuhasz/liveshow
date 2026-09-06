"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function handleRegister(e: any) {
        e.preventDefault();
        setError("");
        setSuccess("");

        try {
            const res = await fetch("http://localhost:3200/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Hiba a regisztráció során");
                return;
            }

            setSuccess("Sikeres regisztráció!");

            // automatikus login
            localStorage.setItem("token", data.token);

            router.push("/");
        } catch (err) {
            setError("Hiba történt a regisztráció során.");
        }
    }

    return (
        <div style={{ maxWidth: 400, margin: "50px auto" }}>
            <h1>Regisztráció</h1>

            <form onSubmit={handleRegister}>
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
                {success && <p style={{ color: "green" }}>{success}</p>}

                <button type="submit" style={{ marginTop: 20 }}>
                    Regisztráció
                </button>
            </form>
        </div>
    );
}
