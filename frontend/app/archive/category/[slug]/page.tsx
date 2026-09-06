"use client";

import { useParams } from "next/navigation";
import ArchiveBrowser from "@/components/ArchiveBrowser";

export default function ArchiveCategoryPage() {
    const { slug } = useParams<{ slug: string }>();
    return <ArchiveBrowser category={String(slug || "")} />;
}
