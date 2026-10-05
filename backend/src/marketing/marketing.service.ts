import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ViewLogService } from "../stats/view-log.service";
import { publicFrontendUrl } from "../auth/public-url";
import { isAdminRole } from "../auth/roles";
import { assertRateLimit } from "../security/rate-limit";
import { generateMarketingKitJson } from "./marketing.openai";
import { isCorporateCategory, isEducationalCategory } from "./marketing.prompts";
import { readOAuthState, signOAuthState } from "./marketing.crypto";
import {
    asProvider,
    exchangeFacebookCode,
    exchangeLinkedInCode,
    exchangeXCode,
    facebookAuthUrl,
    linkedinAuthUrl,
    publishFacebook,
    publishLinkedIn,
    publishX,
    xAuthUrl,
    type SocialProvider,
} from "./marketing.oauth";

const EDITABLE = [
    "facebookPost",
    "linkedinPost",
    "xPost",
    "newsletterContent",
    "emailSubject1",
    "emailSubject2",
    "emailSubject3",
    "seoTitle",
    "seoDescription",
    "youtubeDescription",
    "blogOutline",
    "hashtags",
    "ctaVariants",
    "promoPhrases",
    "webinarVersion",
    "businessVersion",
] as const;

type Authed = { id: string; email?: string; role?: string };

@Injectable()
export class MarketingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly views: ViewLogService,
    ) {}

    private get kits() {
        return (this.prisma as any).marketingKit;
    }
    private get runs() {
        return (this.prisma as any).marketingKitRun;
    }
    private get accountsDb() {
        return (this.prisma as any).socialAccount;
    }
    private get jobs() {
        return (this.prisma as any).marketingPublish;
    }

    async generate(user: Authed, streamId: string, language: string) {
        const lang = language === "en" ? "en" : "hu";
        await assertRateLimit(`mkit:${user.id}`, 8, 15 * 60_000);
        const show = await this.requireShow(user, streamId);
        const started = Date.now();
        const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini");
        try {
            const ctx = await this.contextFor(show as any, lang);
            const { kit, model: used } = await generateMarketingKitJson(ctx);
            const durationMs = Date.now() - started;
            const row = await this.kits.create({
                data: {
                    showId: show.id,
                    streamId: show.streamId || null,
                    language: lang,
                    facebookPost: kit.facebookPost,
                    linkedinPost: kit.linkedinPost,
                    xPost: kit.xPost,
                    newsletterContent: kit.newsletterContent,
                    emailSubject1: kit.emailSubject1,
                    emailSubject2: kit.emailSubject2,
                    emailSubject3: kit.emailSubject3,
                    seoTitle: kit.seoTitle,
                    seoDescription: kit.seoDescription,
                    youtubeDescription: kit.youtubeDescription,
                    blogOutline: kit.blogOutline,
                    hashtags: JSON.stringify(kit.hashtags),
                    ctaVariants: JSON.stringify(kit.ctaVariants),
                    promoPhrases: JSON.stringify(kit.promoPhrases),
                    webinarVersion: kit.webinarVersion || null,
                    businessVersion: kit.businessVersion || null,
                    model: used,
                    durationMs,
                    createdBy: user.id,
                },
            });
            await this.runs.create({
                data: {
                    showId: show.id,
                    kitId: row.id,
                    createdBy: user.id,
                    language: lang,
                    model: used,
                    durationMs,
                    ok: true,
                },
            });
            return { marketingKit: this.serializeKit(row) };
        } catch (err: any) {
            const durationMs = Date.now() - started;
            await this.runs.create({
                data: {
                    showId: show.id,
                    createdBy: user.id,
                    language: lang,
                    model,
                    durationMs,
                    ok: false,
                    error: String(err?.message || err).slice(0, 500),
                },
            });
            throw err;
        }
    }

    async latest(user: Authed, streamId: string) {
        const show = await this.requireShow(user, streamId);
        const kit = await this.kits.findFirst({
            where: { showId: show.id },
            orderBy: { generatedAt: "desc" },
        });
        const generationCount = await this.runs.count({
            where: { showId: show.id, ok: true },
        });
        const accounts = await this.listAccounts(user);
        const publishes = kit
            ? await this.jobs.findMany({
                  where: { kitId: kit.id },
                  orderBy: { createdAt: "desc" },
                  take: 30,
              })
            : [];
        return {
            marketingKit: kit ? this.serializeKit(kit) : null,
            generationCount,
            accounts,
            publishes: publishes.map((p: any) => this.serializePublish(p)),
        };
    }

    async history(user: Authed, streamId: string) {
        const show = await this.requireShow(user, streamId);
        const runs = await this.runs.findMany({
            where: { showId: show.id },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        return { runs };
    }

    async patchKit(user: Authed, kitId: string, body: Record<string, unknown>) {
        const kit = await this.kits.findUnique({ where: { id: kitId } });
        if (!kit) throw new NotFoundException("A marketing kit nem található.");
        await this.requireShow(user, kit.showId);
        const data: Record<string, string> = {};
        for (const key of EDITABLE) {
            if (body[key] == null) continue;
            if (key === "hashtags" || key === "ctaVariants" || key === "promoPhrases") {
                data[key] = Array.isArray(body[key])
                    ? JSON.stringify(body[key])
                    : String(body[key]);
            } else {
                data[key] = String(body[key]);
            }
        }
        if (!Object.keys(data).length) throw new BadRequestException("Nincs módosítható mező.");
        const updated = await this.kits.update({ where: { id: kitId }, data });
        return { marketingKit: this.serializeKit(updated) };
    }

    async oauthStart(user: Authed, providerRaw: string, showId: string) {
        const provider = asProvider(providerRaw);
        await this.requireShow(user, showId);
        const exp = String(Math.floor(Date.now() / 1000) + 600);
        if (provider === "facebook") {
            const state = signOAuthState({ uid: user.id, showId, provider, exp });
            return { url: facebookAuthUrl(state) };
        }
        if (provider === "linkedin") {
            const state = signOAuthState({ uid: user.id, showId, provider, exp });
            return { url: linkedinAuthUrl(state) };
        }
        const verifier = randomBytes(32).toString("base64url");
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        const state = signOAuthState({ uid: user.id, showId, provider, exp, verifier });
        return { url: xAuthUrl(state, challenge) };
    }

    async oauthCallback(providerRaw: string, code: string, state: string) {
        const provider = asProvider(providerRaw);
        const payload = readOAuthState(state);
        if (payload.provider !== provider) throw new BadRequestException("OAuth provider eltérés.");
        const userId = payload.uid;
        let account: {
            accountId: string;
            accountName: string;
            tokenEnc: string;
            refreshEnc: string | null;
            expiresAt: Date | null;
            meta: unknown;
        };
        if (provider === "facebook") account = await exchangeFacebookCode(code);
        else if (provider === "linkedin") account = await exchangeLinkedInCode(code);
        else account = await exchangeXCode(code, payload.verifier || "");

        await this.accountsDb.upsert({
            where: {
                userId_provider_accountId: {
                    userId,
                    provider,
                    accountId: account.accountId,
                },
            },
            create: {
                userId,
                provider,
                accountId: account.accountId,
                accountName: account.accountName,
                tokenEnc: account.tokenEnc,
                refreshEnc: account.refreshEnc,
                expiresAt: account.expiresAt,
                meta: account.meta as any,
            },
            update: {
                accountName: account.accountName,
                tokenEnc: account.tokenEnc,
                refreshEnc: account.refreshEnc,
                expiresAt: account.expiresAt,
                meta: account.meta as any,
            },
        });
        const front = publicFrontendUrl();
        return `${front}/streamer/shows/${payload.showId}?connected=${provider}`;
    }

    async listAccounts(user: Authed) {
        const rows = await this.accountsDb.findMany({
            where: { userId: user.id },
            orderBy: { provider: "asc" },
        });
        return rows.map((a: any) => ({
            id: a.id,
            provider: a.provider,
            accountId: a.accountId,
            accountName: a.accountName,
            expiresAt: a.expiresAt,
        }));
    }

    async disconnectAccount(user: Authed, id: string) {
        const row = await this.accountsDb.findUnique({ where: { id } });
        if (!row || row.userId !== user.id) throw new NotFoundException("A fiók nem található.");
        await this.accountsDb.delete({ where: { id } });
        return { ok: true };
    }

    async enqueuePublish(
        user: Authed,
        kitId: string,
        body: { provider?: string; accountId?: string; mode?: string; scheduledAt?: string },
    ) {
        const kit = await this.kits.findUnique({ where: { id: kitId } });
        if (!kit) throw new NotFoundException("A marketing kit nem található.");
        await this.requireShow(user, kit.showId);
        const provider = asProvider(body.provider || "");
        const account = await this.accountsDb.findFirst({
            where: { id: String(body.accountId || ""), userId: user.id, provider },
        });
        if (!account) throw new BadRequestException("Csatlakoztasd a fiókot a közzétételhez.");
        const field = provider === "facebook" ? "facebookPost" : provider === "linkedin" ? "linkedinPost" : "xPost";
        const mode = body.mode === "schedule" ? "schedule" : "now";
        const scheduledAt = mode === "schedule" ? new Date(String(body.scheduledAt || "")) : null;
        if (mode === "schedule" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
            throw new BadRequestException("Érvényes scheduledAt kell.");
        }
        const job = await this.jobs.create({
            data: {
                kitId: kit.id,
                showId: kit.showId,
                createdBy: user.id,
                provider,
                accountId: account.id,
                field,
                status: mode === "schedule" ? "scheduled" : "pending",
                scheduledAt,
                nextAttemptAt: mode === "schedule" ? scheduledAt : new Date(),
            },
        });
        if (mode === "now") await this.processJob(job.id);
        const fresh = await this.jobs.findUnique({ where: { id: job.id } });
        return { publish: this.serializePublish(fresh!) };
    }

    async retryPublish(user: Authed, jobId: string) {
        const job = await this.jobs.findUnique({ where: { id: jobId } });
        if (!job) throw new NotFoundException("A közzététel nem található.");
        await this.requireShow(user, job.showId);
        await this.jobs.update({
            where: { id: job.id },
            data: { status: "pending", nextAttemptAt: new Date(), lastError: null },
        });
        await this.processJob(job.id);
        const fresh = await this.jobs.findUnique({ where: { id: jobId } });
        return { publish: this.serializePublish(fresh!) };
    }

    async processDueJobs() {
        const due = await this.jobs.findMany({
            where: {
                status: { in: ["pending", "scheduled", "failed"] },
                nextAttemptAt: { lte: new Date() },
                attempts: { lt: 5 },
            },
            take: 8,
            orderBy: { nextAttemptAt: "asc" },
        });
        for (const job of due) {
            if (job.status === "scheduled" && job.scheduledAt && job.scheduledAt > new Date()) continue;
            await this.processJob(job.id).catch(() => undefined);
        }
    }

    async processJob(jobId: string) {
        const job = await this.jobs.findUnique({ where: { id: jobId } });
        if (!job || job.status === "published" || job.status === "publishing") return;
        const kit = await this.kits.findUnique({ where: { id: job.kitId } });
        const account = await this.accountsDb.findUnique({ where: { id: job.accountId } });
        if (!kit || !account) {
            await this.jobs.update({
                where: { id: jobId },
                data: { status: "failed", lastError: "Hiányzó kit vagy fiók.", attempts: { increment: 1 } },
            });
            return;
        }
        await this.jobs.update({
            where: { id: jobId },
            data: { status: "publishing", attempts: { increment: 1 } },
        });
        const text = String((kit as any)[job.field] || "");
        try {
            let externalId = "";
            if (job.provider === "facebook") {
                externalId = await publishFacebook(account.tokenEnc, account.accountId, text);
            } else if (job.provider === "linkedin") {
                const meta = (account.meta as { urn?: string } | null) || {};
                externalId = await publishLinkedIn(account.tokenEnc, meta.urn || account.accountId, text);
            } else {
                externalId = await publishX(account.tokenEnc, text);
            }
            await this.jobs.update({
                where: { id: jobId },
                data: {
                    status: "published",
                    publishedAt: new Date(),
                    externalId,
                    lastError: null,
                },
            });
        } catch (err: any) {
            const attempts = job.attempts + 1;
            const delay = Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1));
            await this.jobs.update({
                where: { id: jobId },
                data: {
                    status: "failed",
                    lastError: String(err?.message || err).slice(0, 500),
                    nextAttemptAt: new Date(Date.now() + delay),
                },
            });
        }
    }

    private serializeKit(row: any) {
        const parse = (raw: string, fallback: unknown) => {
            try {
                return JSON.parse(raw);
            } catch {
                return fallback;
            }
        };
        return {
            id: row.id,
            streamId: row.showId,
            hlsStreamId: row.streamId,
            language: row.language,
            generatedAt: row.generatedAt,
            facebookPost: row.facebookPost,
            linkedinPost: row.linkedinPost,
            xPost: row.xPost,
            newsletterContent: row.newsletterContent,
            emailSubject1: row.emailSubject1,
            emailSubject2: row.emailSubject2,
            emailSubject3: row.emailSubject3,
            seoTitle: row.seoTitle,
            seoDescription: row.seoDescription,
            youtubeDescription: row.youtubeDescription,
            blogOutline: row.blogOutline,
            hashtags: parse(row.hashtags, []),
            ctaVariants: parse(row.ctaVariants, []),
            promoPhrases: parse(row.promoPhrases, []),
            webinarVersion: row.webinarVersion,
            businessVersion: row.businessVersion,
            model: row.model,
            durationMs: row.durationMs,
            createdBy: row.createdBy,
        };
    }

    private serializePublish(row: {
        id: string;
        provider: string;
        status: string;
        scheduledAt: Date | null;
        publishedAt: Date | null;
        attempts: number;
        lastError: string | null;
        externalId: string | null;
        createdAt: Date;
        field: string;
    }) {
        return {
            id: row.id,
            provider: row.provider,
            field: row.field,
            status: row.status,
            scheduledAt: row.scheduledAt,
            publishedAt: row.publishedAt,
            attempts: row.attempts,
            lastError: row.lastError,
            externalId: row.externalId,
            createdAt: row.createdAt,
        };
    }

    private async requireShow(user: Authed, streamId: string) {
        const id = String(streamId || "").trim();
        if (!id) throw new BadRequestException("A streamId kötelező.");
        const show = await this.prisma.show.findFirst({
            where: { OR: [{ id }, { streamId: id }] },
            include: { streamer: true, archives: true, stream: true },
        });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (isAdminRole(user)) return show;
        const ownerUserId = show.streamer?.userId;
        if (!ownerUserId || ownerUserId !== user.id) {
            throw new ForbiddenException("Csak a műsor tulajdonosa vagy admin készíthet marketing kitet.");
        }
        return { ...show, archive: (show as any).archives || null };
    }

    private async contextFor(
        show: {
            id: string;
            title: string;
            description: string | null;
            videoCategory: string;
            tags: string | null;
            transcript: string | null;
            chapters: unknown;
            startTime: Date | null;
            status: string;
            live: boolean;
            streamId: string | null;
            streamer: { name: string; bio: string | null; category: string } | null;
            archive: { size: number; createdAt: Date } | null;
        },
        language: "hu" | "en",
    ) {
        const [viewCount, peak] = await Promise.all([
            this.views.viewCount(show.id).catch(() => 0),
            this.views.peakLiveViewers([show.id]).catch(() => 0),
        ]);
        const chapters = Array.isArray(show.chapters)
            ? (show.chapters as { t?: string; title?: string }[])
                  .map((c) => `${c.t || ""} ${c.title || ""}`.trim())
                  .filter(Boolean)
                  .join("; ")
            : "";
        const duration = show.archive
            ? `archív fájl ${(show.archive.size / (1024 * 1024)).toFixed(1)} MB, készült ${show.archive.createdAt.toISOString()}`
            : show.live
              ? "élő adás folyamatban"
              : "nincs rögzített hossz";
        return {
            title: show.title,
            description: show.description || "",
            category: show.videoCategory || show.streamer?.category || "",
            tags: show.tags || "",
            transcript: (show.transcript || "").slice(0, 8000),
            chapters,
            stats: `megtekintés ${viewCount}, élő peak ${peak}`,
            duration,
            event: `kezdés ${show.startTime?.toISOString() || "nincs"}, státusz ${show.status}, élő=${show.live}`,
            creator: `${show.streamer?.name || "tartalomkészítő"}${show.streamer?.bio ? ` — ${show.streamer.bio}` : ""}`,
            language,
            educational: isEducationalCategory(show.videoCategory),
            corporate: isCorporateCategory(show.videoCategory),
        };
    }
}
