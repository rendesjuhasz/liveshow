import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
    const base = siteUrl();
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/admin",
                    "/admin/",
                    "/profile",
                    "/profile/",
                    "/streamer/",
                    "/login",
                    "/register",
                    "/streamer-login",
                    "/streamer-register",
                    "/forgot-password",
                    "/reset-password",
                    "/verify-email",
                    "/username",
                    "/payment/",
                    "/tickets/",
                    "/private-stream/",
                    "/api/",
                ],
            },
        ],
        sitemap: `${base}/sitemap.xml`,
    };
}
