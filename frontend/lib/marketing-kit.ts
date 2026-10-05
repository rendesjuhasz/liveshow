export type MarketingKit = {
    id: string;
    streamId: string;
    language: string;
    generatedAt: string;
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
    webinarVersion?: string | null;
    businessVersion?: string | null;
    model: string;
    durationMs: number;
};

export type SocialAccount = {
    id: string;
    provider: string;
    accountId: string;
    accountName: string;
    expiresAt?: string | null;
};

export type MarketingPublish = {
    id: string;
    provider: string;
    field: string;
    status: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    attempts: number;
    lastError?: string | null;
    externalId?: string | null;
};

export const MARKETING_TABS = [
    { id: "facebook", label: "Facebook" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "x", label: "X" },
    { id: "newsletter", label: "Newsletter" },
    { id: "seo", label: "SEO" },
    { id: "email", label: "Email" },
    { id: "youtube", label: "YouTube" },
    { id: "blog", label: "Blog" },
    { id: "hashtags", label: "Hashtags" },
] as const;
