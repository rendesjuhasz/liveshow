"use client";

import { useAuth } from "../../context/AuthContext";

export default function ProfilePage() {
    const { user, logout } = useAuth();

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs bejelentkezve.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-6">Profilom</h1>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center text-3xl font-bold">
                        {user.email.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <p className="text-xl font-semibold">{user.email}</p>
                        <p className="text-gray-400 mt-1">Bejelentkezett felhasználó</p>
                    </div>
                </div>

                {/* Info box */}
                <div className="bg-gray-700 p-4 rounded-lg mb-6">
                    <h2 className="text-xl font-semibold mb-3">Fiók adatai</h2>

                    <p className="mb-2">
                        <span className="font-bold">Email:</span> {user.email}
                    </p>

                    <p className="mb-2">
                        <span className="font-bold">Felhasználó ID:</span> {user.id}
                    </p>

                    <p className="mb-2">
                        <span className="font-bold">Státusz:</span> Aktív
                    </p>
                </div>

                {/* Logout */}
                <button
                    onClick={logout}
                    className="w-full bg-red-600 hover:bg-red-700 p-3 rounded-lg font-semibold"
                >
                    Kijelentkezés
                </button>
            </div>
        </div>
    );
}
