"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-10 py-20">

      {/* HERO */}
      <div className="text-center mb-24">
        <h1 className="text-6xl font-extrabold mb-6">
          LiveShow Platform
        </h1>

        <p className="text-neutral-400 text-xl max-w-2xl mx-auto">
          Élő előadások, tech talkok, AI workshopok és prémium streamek egy helyen.
        </p>

        <div className="mt-10 flex justify-center gap-6">
          <Link
            href="/shows"
            className="px-10 py-4 bg-white text-black rounded-2xl text-xl font-bold hover:bg-neutral-300 transition-all hover:scale-105 active:scale-95"
          >
            Műsorok megtekintése
          </Link>

          {!user && (
            <Link
              href="/login"
              className="px-10 py-4 bg-neutral-800 text-white rounded-2xl text-xl font-bold hover:bg-neutral-700 transition-all hover:scale-105 active:scale-95"
            >
              Bejelentkezés
            </Link>
          )}
        </div>
      </div>

      {/* FEATURED */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-10">Kiemelt műsorok</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            {
              id: 1,
              title: "AI Talk Live",
              cover: "/covers/tech1.jpg",
            },
            {
              id: 2,
              title: "Startup Night",
              cover: "/covers/startup1.jpg",
            },
            {
              id: 3,
              title: "Deep Learning Explained",
              cover: "/covers/ai2.jpg",
            },
          ].map((item) => (
            <Link
              key={item.id}
              href="/shows"
              className="group block rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="relative h-64">
                <img
                  src={item.cover}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:opacity-70"
                />
                <div className="absolute bottom-0 p-4">
                  <h3 className="text-2xl font-bold drop-shadow-xl">
                    {item.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div className="text-neutral-500 text-center mt-40 text-lg">
        © 2026 LiveShow Platform — Minden jog fenntartva
      </div>
    </div>
  );
}
