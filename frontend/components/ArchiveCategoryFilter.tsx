import Link from "next/link";
import { VIDEO_CATEGORIES, videoCategoryHref } from "@/lib/video-categories";

export default function ArchiveCategoryFilter({ active }: { active?: string | null }) {
    return (
        <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-zinc-300">Kategória</p>
            <div className="flex flex-wrap gap-2">
                <Link
                    href="/archive"
                    className={`rounded-full px-3 py-1.5 text-sm ${
                        !active
                            ? "bg-accent text-black font-semibold"
                            : "bg-white/10 text-zinc-200 hover:bg-white/15"
                    }`}
                >
                    Összes
                </Link>
                {VIDEO_CATEGORIES.map((item) => (
                    <Link
                        key={item.value}
                        href={videoCategoryHref(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                            active === item.value
                                ? "bg-accent text-black font-semibold"
                                : "bg-white/10 text-zinc-200 hover:bg-white/15"
                        }`}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}
