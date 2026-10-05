import * as fs from "fs";
import * as path from "path";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BackupService } from "../backup/backup.service";
import { HLS_OUTPUT_ROOT } from "../streaming/hls-paths";
import { getCommissionPercent } from "../payouts/platform-config";
import { splitRevenue } from "../payouts/commission";

export type CostRates = {
    storageGbMonthFt: number;
    cdnMonthlyFt: number;
    transcodeHourFt: number;
    serverMonthlyFt: number;
    dbMonthlyFt: number;
    emailPerThousandFt: number;
    budgetMonthlyFt: number;
};

const SETTINGS_ID = "default";

function num(raw: unknown, fallback = 0) {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envNum(key: string, fallback = 0) {
    return num(process.env[key], fallback);
}

@Injectable()
export class CostService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly backups: BackupService,
    ) {}

    async onModuleInit() {
        await this.ensureSettings();
    }

    async report() {
        const [rates, usage, revenue] = await Promise.all([
            this.rates(),
            this.usage(),
            this.revenueThisMonth(),
        ]);
        const storageGb = usage.storageBytes / (1024 * 1024 * 1024);
        const emailThousands = usage.emailsThisMonth / 1000;
        const costs = {
            storage: roundFt(storageGb * rates.storageGbMonthFt),
            cdn: roundFt(rates.cdnMonthlyFt),
            transcode: roundFt(usage.transcodeHoursEst * rates.transcodeHourFt),
            server: roundFt(rates.serverMonthlyFt),
            database: roundFt(rates.dbMonthlyFt),
            email: roundFt(emailThousands * rates.emailPerThousandFt),
        };
        const total = roundFt(
            costs.storage + costs.cdn + costs.transcode + costs.server + costs.database + costs.email,
        );
        const ratesFilled = Object.entries(rates).some(
            ([key, value]) => key !== "budgetMonthlyFt" && value > 0,
        );
        const margin = roundFt(revenue.platformCommission - total);
        const overBudget = rates.budgetMonthlyFt > 0 && total > rates.budgetMonthlyFt;
        return {
            month: usage.month,
            rates,
            usage,
            costs,
            total,
            revenue,
            margin,
            loss: margin < 0 && ratesFilled,
            overBudget,
            ratesFilled,
            notes: this.notes(rates, usage),
        };
    }

    async saveRates(body: Partial<CostRates>) {
        const current = await this.rates();
        const next: CostRates = {
            storageGbMonthFt: num(body.storageGbMonthFt, current.storageGbMonthFt),
            cdnMonthlyFt: num(body.cdnMonthlyFt, current.cdnMonthlyFt),
            transcodeHourFt: num(body.transcodeHourFt, current.transcodeHourFt),
            serverMonthlyFt: num(body.serverMonthlyFt, current.serverMonthlyFt),
            dbMonthlyFt: num(body.dbMonthlyFt, current.dbMonthlyFt),
            emailPerThousandFt: num(body.emailPerThousandFt, current.emailPerThousandFt),
            budgetMonthlyFt: num(body.budgetMonthlyFt, current.budgetMonthlyFt),
        };
        await this.prisma.$executeRaw`
            INSERT INTO "CostSettings" (
                id, "storageGbMonthFt", "cdnMonthlyFt", "transcodeHourFt",
                "serverMonthlyFt", "dbMonthlyFt", "emailPerThousandFt", "budgetMonthlyFt", "updatedAt"
            )
            VALUES (
                ${SETTINGS_ID},
                ${next.storageGbMonthFt}, ${next.cdnMonthlyFt}, ${next.transcodeHourFt},
                ${next.serverMonthlyFt}, ${next.dbMonthlyFt}, ${next.emailPerThousandFt},
                ${next.budgetMonthlyFt}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                "storageGbMonthFt" = EXCLUDED."storageGbMonthFt",
                "cdnMonthlyFt" = EXCLUDED."cdnMonthlyFt",
                "transcodeHourFt" = EXCLUDED."transcodeHourFt",
                "serverMonthlyFt" = EXCLUDED."serverMonthlyFt",
                "dbMonthlyFt" = EXCLUDED."dbMonthlyFt",
                "emailPerThousandFt" = EXCLUDED."emailPerThousandFt",
                "budgetMonthlyFt" = EXCLUDED."budgetMonthlyFt",
                "updatedAt" = NOW()
        `;
        return this.report();
    }

    private envDefaults(): CostRates {
        return {
            storageGbMonthFt: envNum("COST_STORAGE_GB_MONTH_FT"),
            cdnMonthlyFt: envNum("COST_CDN_MONTHLY_FT"),
            transcodeHourFt: envNum("COST_TRANSCODE_HOUR_FT"),
            serverMonthlyFt: envNum("COST_SERVER_MONTHLY_FT"),
            dbMonthlyFt: envNum("COST_DB_MONTHLY_FT"),
            emailPerThousandFt: envNum("COST_EMAIL_PER_1000_FT"),
            budgetMonthlyFt: envNum("COST_BUDGET_MONTHLY_FT"),
        };
    }

    private async rates(): Promise<CostRates> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "CostSettings" WHERE id = ${SETTINGS_ID} LIMIT 1
        `.catch(() => []);
        const row = rows[0];
        const fallback = this.envDefaults();
        if (!row) return fallback;
        return {
            storageGbMonthFt: num(row.storageGbMonthFt, fallback.storageGbMonthFt),
            cdnMonthlyFt: num(row.cdnMonthlyFt, fallback.cdnMonthlyFt),
            transcodeHourFt: num(row.transcodeHourFt, fallback.transcodeHourFt),
            serverMonthlyFt: num(row.serverMonthlyFt, fallback.serverMonthlyFt),
            dbMonthlyFt: num(row.dbMonthlyFt, fallback.dbMonthlyFt),
            emailPerThousandFt: num(row.emailPerThousandFt, fallback.emailPerThousandFt),
            budgetMonthlyFt: num(row.budgetMonthlyFt, fallback.budgetMonthlyFt),
        };
    }

    private async usage() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const uploads = path.join(process.cwd(), "uploads");
        const output = HLS_OUTPUT_ROOT;
        const backups = this.backups.rootDir();
        const outbox = path.join(process.cwd(), "mail-outbox");
        const storageByFolder = {
            uploads: dirBytes(uploads),
            output: dirBytes(output),
            backups: dirBytes(backups),
            mailOutbox: dirBytes(outbox),
        };
        const storageBytes = Object.values(storageByFolder).reduce((a, b) => a + b, 0);

        const emailRows = await this.prisma.$queryRaw<any[]>`
            SELECT type, COUNT(*)::int AS n
            FROM "EmailLog"
            WHERE "createdAt" >= ${monthStart}
            GROUP BY type
        `.catch(() => []);
        const emailsByType = emailRows.map((row) => ({
            type: String(row.type || "other"),
            count: Number(row.n) || 0,
        }));
        const emailsThisMonth = emailsByType.reduce((sum, row) => sum + row.count, 0);

        const liveRows = await this.prisma.$queryRaw<any[]>`
            SELECT "liveStartedAt" FROM "Stream" WHERE "isLive" = true
        `.catch(() => []);
        const liveHoursNow = liveRows.reduce((sum, row) => {
            const started = row.liveStartedAt ? new Date(row.liveStartedAt).getTime() : 0;
            if (!started) return sum;
            return sum + Math.max(0, (Date.now() - started) / 3600000);
        }, 0);

        const archivesThisMonth = Number(
            (
                await this.prisma.$queryRaw<any[]>`
                    SELECT COUNT(*)::int AS n FROM "Archive" WHERE "createdAt" >= ${monthStart}
                `.catch(() => [{ n: 0 }])
            )[0]?.n || 0,
        );
        const transcodeHoursEst = roundHours(liveHoursNow + archivesThisMonth * 0.3);

        return {
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
            storageBytes,
            storageGb: Math.round((storageBytes / (1024 * 1024 * 1024)) * 1000) / 1000,
            storageByFolder,
            emailsThisMonth,
            emailsByType,
            liveHoursNow: roundHours(liveHoursNow),
            archivesThisMonth,
            transcodeHoursEst,
            cdn: {
                inRepo: false,
                note: "Nincs HLS CDN a kódban — a lejátszás az originről megy (Nest /output).",
            },
        };
    }

    private async revenueThisMonth() {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const pack = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM(price), 0)::int AS revenue
                FROM "TicketPackPurchase"
                WHERE status = 'paid'
                  AND COALESCE(price, 0) > 0
                  AND COALESCE(source, 'purchase') = 'purchase'
                  AND "createdAt" >= ${monthStart}
            `.catch(() => [{ revenue: 0 }])
        )[0] || { revenue: 0 };
        const priv = (
            await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(SUM(t.price), 0)::int AS revenue
                FROM "Ticket" t
                JOIN "PrivateRequest" r ON r."ticketId" = t.id
                WHERE t.status IN ('paid', 'active')
                  AND t."createdAt" >= ${monthStart}
            `.catch(() => [{ revenue: 0 }])
        )[0] || { revenue: 0 };
        const commissionPercent = await getCommissionPercent(this.prisma);
        const gross = Number(pack.revenue || 0) + Number(priv.revenue || 0);
        const split = splitRevenue(gross, commissionPercent);
        return {
            gross: split.gross,
            packGross: Number(pack.revenue || 0),
            privateGross: Number(priv.revenue || 0),
            platformCommission: split.commission,
            streamerNet: split.net,
            commissionPercent: split.commissionPercent,
        };
    }

    private notes(rates: CostRates, usage: { cdn: { inRepo: boolean } }) {
        const lines: string[] = [];
        if (!usage.cdn.inRepo && rates.cdnMonthlyFt === 0) {
            lines.push("CDN: nincs a stackben. Ha belépsz Cloudflare/Bunny-ra, írd be a havi díjat.");
        }
        if (rates.transcodeHourFt === 0) {
            lines.push("Transzkódolás: helyi FFmpeg, alapból a szerver díjban. Cloud encoderhez tölts órás díjat.");
        }
        if (rates.dbMonthlyFt === 0) {
            lines.push("Adatbázis: 0 Ft = feltételezett ugyanazon VPS. Managed Postgres díját külön add meg.");
        }
        if (rates.serverMonthlyFt === 0) {
            lines.push("Szerver: töltsd ki a VPS havi számláját, különben a margin hamisan pozitív.");
        }
        return lines;
    }

    private async ensureSettings() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "CostSettings" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "storageGbMonthFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "cdnMonthlyFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "transcodeHourFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "serverMonthlyFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "dbMonthlyFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "emailPerThousandFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "budgetMonthlyFt" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `).catch(() => undefined);
    }
}

function dirBytes(dir: string) {
    let total = 0;
    const walk = (current: string) => {
        if (!fs.existsSync(current)) return;
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const next = path.join(current, entry.name);
            if (entry.isDirectory()) walk(next);
            else if (entry.isFile()) {
                try {
                    total += fs.statSync(next).size;
                } catch {
                    /* ignore */
                }
            }
        }
    };
    walk(dir);
    return total;
}

function roundFt(n: number) {
    return Math.round(Number(n) || 0);
}

function roundHours(n: number) {
    return Math.round((Number(n) || 0) * 100) / 100;
}
