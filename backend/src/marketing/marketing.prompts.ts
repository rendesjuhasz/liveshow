export type MarketingKitJson = {
    facebookPost: string;
    linkedinPost: string;
    xPost: string;
    newsletterContent: string;
    emailSubject1: string;
    emailSubject2: string;
    emailSubject3: string;
    seoTitle: string;
    seoDescription: string;
    youtubeDescription: string;
    blogOutline: string;
    hashtags: string[];
    ctaVariants: string[];
    promoPhrases: string[];
    webinarVersion?: string;
    businessVersion?: string;
};

export type StreamMarketingContext = {
    title: string;
    description: string;
    category: string;
    tags: string;
    transcript: string;
    chapters: string;
    stats: string;
    duration: string;
    event: string;
    creator: string;
    language: "hu" | "en";
    educational: boolean;
    corporate: boolean;
};

export function isEducationalCategory(cat: string) {
    return ["oktatas", "tanacsadas"].includes(String(cat || "").toLowerCase());
}

export function isCorporateCategory(cat: string) {
    return ["uzleti", "kereskedelem", "tanacsadas"].includes(String(cat || "").toLowerCase());
}

export function buildMarketingSystemPrompt(ctx: StreamMarketingContext) {
    const lang = ctx.language === "en" ? "English" : "Hungarian";
    return [
        `You are a senior live-stream marketer. Write every field in ${lang}.`,
        "Return ONLY valid JSON with the exact keys requested.",
        "Do not invent fake viewer counts; use the stats text as-is or omit numbers.",
        "xPost must be at most 260 characters (leave room for a link).",
        "seoTitle ≤ 60 characters. seoDescription ≤ 155 characters.",
        "hashtags: exactly 20 items, no # prefix in the JSON strings (we add # in the UI).",
        "ctaVariants: exactly 3. promoPhrases: exactly 5 short punchy lines.",
        ctx.educational
            ? "Also fill webinarVersion: a landing-page style blurb for an educational webinar replay."
            : "Set webinarVersion to empty string.",
        ctx.corporate
            ? "Also fill businessVersion: a B2B LinkedIn-style thought-leadership recap."
            : "Set businessVersion to empty string.",
        "Facebook: conversational, 1–2 short paragraphs + emoji sparingly + CTA.",
        "LinkedIn: professional, no emoji spam, insight first, CTA last.",
        "Newsletter: greeting, 2–4 paragraphs, bullet takeaways, CTA.",
        "YouTube description: summary, timestamps if chapters exist, links, hashtags last.",
        "Blog outline: H2/H3 markdown outline only, 6–10 sections.",
    ].join(" ");
}

export function buildMarketingUserPrompt(ctx: StreamMarketingContext) {
    return [
        `Title: ${ctx.title}`,
        `Description: ${ctx.description || "(none)"}`,
        `Category: ${ctx.category || "(none)"}`,
        `Tags: ${ctx.tags || "(none)"}`,
        `Creator: ${ctx.creator}`,
        `Event: ${ctx.event}`,
        `Duration: ${ctx.duration}`,
        `Viewer stats: ${ctx.stats}`,
        `Chapters: ${ctx.chapters || "(none)"}`,
        `Transcript excerpt: ${ctx.transcript || "(none)"}`,
        "JSON keys: facebookPost, linkedinPost, xPost, newsletterContent, emailSubject1, emailSubject2, emailSubject3, seoTitle, seoDescription, youtubeDescription, blogOutline, hashtags, ctaVariants, promoPhrases, webinarVersion, businessVersion",
    ].join("\n");
}

export function parseMarketingJson(raw: string): MarketingKitJson {
    const trimmed = String(raw || "").trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1] : trimmed;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Az AI nem adott érvényes JSON-t.");
    const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
    const str = (k: string) => String(parsed[k] ?? "").trim();
    const arr = (k: string, n: number) => {
        const v = parsed[k];
        const list = Array.isArray(v)
            ? v.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean)
            : String(v || "")
                  .split(/[\n,]+/)
                  .map((x) => x.replace(/^#/, "").trim())
                  .filter(Boolean);
        if (list.length < n) {
            while (list.length < n) list.push(list[list.length - 1] || k);
        }
        return list.slice(0, n);
    };
    const kit: MarketingKitJson = {
        facebookPost: str("facebookPost"),
        linkedinPost: str("linkedinPost"),
        xPost: str("xPost").slice(0, 280),
        newsletterContent: str("newsletterContent"),
        emailSubject1: str("emailSubject1"),
        emailSubject2: str("emailSubject2"),
        emailSubject3: str("emailSubject3"),
        seoTitle: str("seoTitle").slice(0, 70),
        seoDescription: str("seoDescription").slice(0, 170),
        youtubeDescription: str("youtubeDescription"),
        blogOutline: str("blogOutline"),
        hashtags: arr("hashtags", 20),
        ctaVariants: arr("ctaVariants", 3),
        promoPhrases: arr("promoPhrases", 5),
        webinarVersion: str("webinarVersion"),
        businessVersion: str("businessVersion"),
    };
    const required: (keyof MarketingKitJson)[] = [
        "facebookPost",
        "linkedinPost",
        "xPost",
        "newsletterContent",
        "emailSubject1",
        "seoTitle",
        "youtubeDescription",
        "blogOutline",
    ];
    for (const key of required) {
        if (!String(kit[key] || "").trim()) {
            throw new Error(`Hiányos AI válasz: ${key}`);
        }
    }
    return kit;
}
