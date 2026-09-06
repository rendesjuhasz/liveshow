"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

export default function AdminModeratorsPage() {
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("moderator");

    function load() {
        apiFetch("/admin/moderators").then((d) => setRows(Array.isArray(d) ? d : []));
    }

    useEffect(() => {
        if (gate.ok) load();
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Moderátorok</h1>
                <form
                    className="flex flex-wrap gap-2 mb-6"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        await apiFetch("/admin/moderators", {
                            method: "POST",
                            body: JSON.stringify({ email, role }),
                        });
                        setEmail("");
                        load();
                    }}
                >
                    <input className="p-2 text-black rounded" placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <select className="p-2 text-black rounded" value={role} onChange={(e) => setRole(e.target.value)}>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                    </select>
                    <button className="bg-blue-600 px-4 rounded">Szerepkör mentése</button>
                </form>
                <ul className="space-y-2">
                    {rows.map((u) => (
                        <li key={u.id} className="bg-gray-800 p-3 rounded">
                            {u.email} · {u.role}
                        </li>
                    ))}
                </ul>
                <a href="/admin" className="block mt-8 text-blue-400">← Vissza az adminhoz</a>
            </div>
        </div>
    );
}
