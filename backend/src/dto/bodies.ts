import { Transform, Type } from "class-transformer";
import {
    Allow,
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator";

export function toOptString(value: unknown) {
    if (value == null || value === "") return undefined;
    return String(value);
}

export function toOptInt(value: unknown) {
    if (value == null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : value;
}

export function toOptBool(value: unknown) {
    if (value == null || value === "") return undefined;
    if (value === true || value === "true" || value === "1" || value === "on") return true;
    if (value === false || value === "false" || value === "0") return false;
    return value;
}

export class I18nMissingDto {
    @IsString()
    @MaxLength(200)
    key!: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    locale?: string;
}

export class ContactDto {
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name!: string;

    @IsEmail()
    @MaxLength(190)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(4000)
    message!: string;
}

export const STREAMER_HELP_TOPICS = [
    "live",
    "audio",
    "video",
    "payout",
    "moderation",
    "other",
] as const;

export class StreamerHelpDto {
    @IsIn([...STREAMER_HELP_TOPICS])
    topic!: string;

    @IsString()
    @MinLength(10)
    @MaxLength(4000)
    description!: string;
}

export class ContactAdminPatchDto {
    @IsOptional()
    @IsIn(["new", "opened", "replied"])
    status?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    adminNote?: string;
}

export class WishCreateDto {
    @IsString()
    @MinLength(4)
    @MaxLength(2000)
    text!: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    visibility?: string;
}

export class TicketPackBuyDto {
    @IsString()
    @MaxLength(40)
    groupKey!: string;
}

export class ConfirmDevPayDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    ticketId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    packPurchaseId?: string;
}

export class SessionIdDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    sessionId?: string;
}

export class CancelPaymentDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    sessionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    ticketId?: string;
}

export class AuthProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    locale?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    timezone?: string;
}

export class RegisterStreamerDto {
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name!: string;

    @IsEmail()
    @MaxLength(190)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @IsString()
    @MinLength(3)
    @MaxLength(24)
    username!: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    bio?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    category?: string;

    @IsOptional()
    @IsString()
    @MaxLength(190)
    contactEmail?: string;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    termsAccepted?: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    locale?: string;
}

export class LiveViewDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    showId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    streamId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    viewerKey?: string;
}

export class ArchiveViewDto {
    @IsString()
    @MaxLength(80)
    showId!: string;

    @IsOptional()
    @Transform(({ value }) => toOptInt(value))
    @IsInt()
    @Min(0)
    @Max(86400)
    seconds?: number;

    @IsOptional()
    @Transform(({ value }) => toOptInt(value))
    @IsInt()
    @Min(0)
    @Max(86400)
    duration?: number;
}

export class ChatPostDto {
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    text!: string;
}

export class ReportCreateDto {
    @IsString()
    @MaxLength(40)
    targetType!: string;

    @IsString()
    @MaxLength(80)
    targetId!: string;

    @IsString()
    @MaxLength(80)
    reason!: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    details?: string;
}

export class StatusNoteDto {
    @IsOptional()
    @IsString()
    @MaxLength(40)
    status?: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    note?: string;
}

export class AlertSettingsDto {
    @IsOptional()
    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    emailEnabled?: boolean;

    @IsOptional()
    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    pushEnabled?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    discordWebhook?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    telegramChatId?: string;
}

export class SnoozeDto {
    @IsOptional()
    @Transform(({ value }) => toOptInt(value))
    @IsInt()
    @Min(1)
    @Max(1440)
    minutes?: number;
}

export class StreamIdDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    streamId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    showId?: string;
}

export class MarketingGenerateDto {
    @IsString()
    @MaxLength(80)
    streamId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    language?: string;
}

export class MarketingPublishDto {
    @IsOptional()
    @IsString()
    @MaxLength(40)
    provider?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    accountId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    mode?: string;

    @IsOptional()
    @IsString()
    @MaxLength(40)
    scheduledAt?: string;
}

export class PatchMarketingKitDto {
    @IsOptional() @IsString() @MaxLength(8000) facebookPost?: string;
    @IsOptional() @IsString() @MaxLength(8000) linkedinPost?: string;
    @IsOptional() @IsString() @MaxLength(8000) xPost?: string;
    @IsOptional() @IsString() @MaxLength(16000) newsletterContent?: string;
    @IsOptional() @IsString() @MaxLength(200) emailSubject1?: string;
    @IsOptional() @IsString() @MaxLength(200) emailSubject2?: string;
    @IsOptional() @IsString() @MaxLength(200) emailSubject3?: string;
    @IsOptional() @IsString() @MaxLength(200) seoTitle?: string;
    @IsOptional() @IsString() @MaxLength(400) seoDescription?: string;
    @IsOptional() @IsString() @MaxLength(8000) youtubeDescription?: string;
    @IsOptional() @IsString() @MaxLength(8000) blogOutline?: string;
    @IsOptional() @IsString() @MaxLength(80) businessVersion?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(30) @MaxLength(80, { each: true }) hashtags?: string[];
    @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) @MaxLength(200, { each: true }) ctaVariants?: string[];
    @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) @MaxLength(200, { each: true }) promoPhrases?: string[];
}

export class CostRatesDto {
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) storageGbMonthFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) cdnMonthlyFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) transcodeHourFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) serverMonthlyFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) dbMonthlyFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) emailPerThousandFt?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(1_000_000_000) budgetMonthlyFt?: number;
}

export class StreamerNameBioDto {
    @IsOptional() @IsString() @MaxLength(120) name?: string;
    @IsOptional() @IsString() @MaxLength(2000) bio?: string;
}

export class AdminCreateStreamerDto {
    @IsOptional() @IsString() @MaxLength(120) name?: string;
    @IsOptional() @IsEmail() @MaxLength(190) email?: string;
    @IsOptional() @IsString() @MaxLength(2000) bio?: string;
    @IsOptional() @IsString() @MaxLength(80) userId?: string;
}

export class StatusDto {
    @IsOptional() @IsString() @MaxLength(40) status?: string;
}

export class PayoutCreateDto {
    @IsOptional() @IsString() @MaxLength(80) streamerId?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(100_000_000) amount?: number;
}

export class PayoutPaidDto {
    @IsOptional() @IsString() @MaxLength(40) method?: string;
}

export class ReviewCreateDto {
    @IsString() @MaxLength(80) showId!: string;
    @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(5) rating!: number;
    @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class QuestionCreateDto {
    @IsString() @MaxLength(80) showId!: string;
    @IsString() @MinLength(2) @MaxLength(2000) text!: string;
}

export class SupportDto {
    @IsOptional() @IsString() @MaxLength(40) kind?: string;
    @IsOptional() @IsString() @MaxLength(2000) text?: string;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) tickets?: number;
}

export class BannedWordDto {
    @IsString() @MinLength(2) @MaxLength(80) word!: string;
}

export class ShowContentTranslationDto {
    @IsString() @IsIn(["hu", "en", "de", "it", "es", "fr"]) @MaxLength(8) locale!: string;
    @IsOptional() @IsString() @MaxLength(200) title?: string;
    @IsOptional() @IsString() @MaxLength(8000) description?: string;
}

export class ShowBodyDto {
    @IsOptional() @IsString() @MaxLength(200) title?: string;
    @IsOptional() @IsString() @MaxLength(8000) description?: string;
    @IsOptional() @IsString() @MaxLength(400) image?: string;
    @IsOptional() @IsString() @MaxLength(80) date?: string;
    @IsOptional() @IsString() @MaxLength(80) startTime?: string;
    @IsOptional() @IsString() @MaxLength(80) startLocal?: string;
    @IsOptional() @IsString() @MaxLength(80) timezone?: string;
    @IsOptional() @IsString() @MaxLength(80) endLocal?: string;
    @IsOptional() @IsString() @MaxLength(80) endTime?: string;
    @IsOptional() @IsString() @MaxLength(80) startAtUtc?: string;
    @IsOptional() @IsString() @MaxLength(80) endAtUtc?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(10_000_000) price?: number;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() live?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() featured?: boolean;
    @IsOptional() @IsString() @MaxLength(400) streamUrl?: string;
    @IsOptional() @IsString() @MaxLength(120) streamId?: string;
    @IsOptional() @IsString() @MaxLength(120) privateStreamId?: string;
    @IsOptional() @IsString() @MaxLength(80) streamerId?: string;
    @IsOptional() @IsString() @MaxLength(40) videoCategory?: string;
    @IsOptional() @IsString() @IsIn(["hu", "en", "de", "it", "es", "fr"]) @MaxLength(8) originalLocale?: string;
    @IsOptional() @IsString() @MaxLength(40) status?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
    @IsOptional() @IsString() @MaxLength(8000) extrasContent?: string;
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(6)
    @ValidateNested({ each: true })
    @Type(() => ShowContentTranslationDto)
    translations?: ShowContentTranslationDto[];
}

export class ShowLiveDto {
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() live?: boolean;
    @IsOptional() @IsString() @MaxLength(120) streamId?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1024) @Max(65535) rtpPort?: number;
}

export class VodUploadDto {
    @IsString() @MinLength(2) @MaxLength(200) title!: string;
    @IsString() @MinLength(4) @MaxLength(8000) description!: string;
    @IsOptional() @IsString() @MaxLength(40) videoCategory?: string;
}

export class PayoutAmountDto {
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(100_000_000) amount?: number;
}

export class StreamerLegalDto {
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() invoiceCapable?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() taxDeclarationAccepted?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() contractShareAccepted?: boolean;
    @IsOptional() @IsString() @MaxLength(40) preferredPayoutMethod?: string;
}

export class StreamerProfileDto {
    @IsOptional() @IsString() @MaxLength(120) name?: string;
    @IsOptional() @IsString() @MaxLength(2000) bio?: string;
    @IsOptional() @IsString() @MaxLength(80) category?: string;
    @IsOptional() @IsString() @MaxLength(190) contactEmail?: string;
    /** JSON string (multipart) or array */
    @IsOptional()
    @Allow()
    publicLinks?: unknown;
}

export class ShowIdDto {
    @IsOptional() @IsString() @MaxLength(80) showId?: string;
}

export class CommissionDto {
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(100) percent?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsNumber() @Min(0) @Max(100) streamerPercent?: number;
    @IsOptional() @IsString() @MaxLength(40) payoutCycle?: string;
}

export class GiftTicketDto {
    @IsEmail() @MaxLength(190) email!: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(10_000) ticketCount?: number;
    @IsOptional() @IsString() @MaxLength(80) showId?: string;
}

export class CampaignDto {
    @IsOptional() @IsString() @MaxLength(120) name?: string;
    @IsOptional() @IsString() @MaxLength(40) type?: string;
    @IsOptional() @IsString() @MaxLength(80) showId?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(10_000) ticketCount?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(1_000_000) maxClaims?: number;
    @IsOptional() @IsString() @MaxLength(40) status?: string;
    @IsOptional() @IsString() @MaxLength(40) startsAt?: string;
    @IsOptional() @IsString() @MaxLength(40) endsAt?: string;
}

export class SetRoleDto {
    @IsOptional() @IsString() @MaxLength(80) userId?: string;
    @IsOptional() @IsEmail() @MaxLength(190) email?: string;
    @IsOptional() @IsString() @MaxLength(20) role?: string;
}

export class NotifyPrefsDto {
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() notifyNewShow?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() notify24h?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() notify1h?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() notifyLive?: boolean;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() emailEnabled?: boolean;
}

export class CatalogItemDto {
    @IsOptional() @IsString() @MaxLength(40) key?: string;
    @IsOptional() @IsString() @MaxLength(80) name?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(1000) ticketCount?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(10_000_000) price?: number;
}

export class CatalogItemsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CatalogItemDto)
    @ArrayMaxSize(50)
    items!: CatalogItemDto[];
}

export class TranslationDto {
    @IsString() @MaxLength(200) key!: string;
    @IsString() @MaxLength(8) locale!: string;
    @IsString() @MaxLength(8000) value!: string;
    @IsOptional() @IsString() @MaxLength(20) status?: string;
}

export class TranslationKeyDto {
    @IsString() @MaxLength(200) key!: string;
    @IsString() @MaxLength(8) locale!: string;
}

export class I18nContentDto {
    @IsString() @MaxLength(40) entityType!: string;
    @IsString() @MaxLength(80) entityId!: string;
    @IsString() @MaxLength(40) field!: string;
    @IsString() @MaxLength(8) locale!: string;
    @IsString() @MaxLength(8000) value!: string;
}

export class LanguageCreateDto {
    @IsString() @MaxLength(8) code!: string;
    @IsString() @MaxLength(80) name!: string;
    @IsOptional() @IsString() @MaxLength(80) nativeName?: string;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() enabled?: boolean;
}

export class LanguageDto {
    @IsOptional() @IsString() @MaxLength(8) code?: string;
    @IsOptional() @IsString() @MaxLength(80) name?: string;
    @IsOptional() @IsString() @MaxLength(80) nativeName?: string;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() enabled?: boolean;
}

export class MediaTrackDto {
    @IsString() @MaxLength(20) kind!: string;
    @IsString() @MaxLength(8) locale!: string;
    @IsString() @MaxLength(80) label!: string;
    @IsString() @MaxLength(500) url!: string;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() isDefault?: boolean;
}

export class ReferralSettingsDto {
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() enabled?: boolean;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(1000) minimumPurchasedTickets?: number;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(100) rewardTicketAmount?: number;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() allowMultipleFromReferrer?: boolean;
}

export class FaqDto {
    @IsOptional() @IsString() @MaxLength(80) category?: string;
    @IsOptional() @IsString() @MaxLength(400) question?: string;
    @IsOptional() @IsString() @MaxLength(8000) answer?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(10000) order?: number;
    @IsOptional() @Transform(({ value }) => toOptBool(value)) @IsBoolean() isPublished?: boolean;
}

export class MaintenanceDto {
    @IsOptional() @IsString() @MaxLength(160) name?: string;
    @IsOptional() @IsString() @MaxLength(4000) description?: string;
    @IsOptional() @IsString() @IsIn(["info", "partial", "full", "emergency"]) kind?: string;
    @IsOptional() @IsString() @MaxLength(40) startsAt?: string;
    @IsOptional() @IsString() @MaxLength(40) endsAt?: string;
    @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) services?: string[];
}

export class IngestStartDto {
    @IsString() @MaxLength(120) streamId!: string;
    @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1024) @Max(65535) rtpPort!: number;
}

export class IngestStopDto {
    @IsString() @MaxLength(120) streamId!: string;
}

export class PrivateRequestDto {
    @IsOptional() @IsString() @MaxLength(200) topic?: string;
    @IsOptional() @IsString() @MaxLength(8000) details?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(720) deadlineHours?: number;
}

export class PrivateSelectDto {
    @IsString() @MaxLength(80) offerId!: string;
    @IsOptional() @IsString() @MaxLength(40) startAt?: string;
}

export class PrivateApplyDto {
    @IsOptional() @IsString() @MaxLength(4000) plan?: string;
    @IsOptional() @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(10_000_000) price?: number;
    @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(10) @MaxLength(40, { each: true }) proposedStarts?: string[];
}

export class PriceBandItemDto {
    @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(1) @Max(5) stars!: number;
    @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(10_000_000) minPrice!: number;
    @Transform(({ value }) => toOptInt(value)) @IsInt() @Min(0) @Max(10_000_000) maxPrice!: number;
}

export class LivekitTokenDto {
    @IsString()
    @MaxLength(80)
    showId!: string;

    @IsOptional()
    @IsIn(["publisher", "viewer"])
    role?: "publisher" | "viewer";

    @IsOptional()
    @IsString()
    @MaxLength(80)
    viewerKey?: string;
}

export class LivePreviewDto {
    @IsString()
    @MaxLength(40)
    mime!: string;

    @IsString()
    @MaxLength(400_000)
    data!: string;
}

export class PriceBandsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PriceBandItemDto)
    @ArrayMaxSize(10)
    items!: PriceBandItemDto[];
}

export class PreflightSaveDto {
    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    cameraOk!: boolean;

    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    micOk!: boolean;

    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    networkOk!: boolean;

    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    ingestOk!: boolean;

    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    videoPackets!: boolean;

    @Transform(({ value }) => toOptBool(value))
    @IsBoolean()
    audioPackets!: boolean;

    @IsOptional()
    @Transform(({ value }) => toOptInt(value))
    @IsNumber()
    @Min(0)
    @Max(60_000)
    pingMs?: number;

    @IsOptional()
    @Transform(({ value }) => toOptInt(value))
    @IsNumber()
    @Min(0)
    @Max(10_000)
    jitterMs?: number;

    @IsOptional()
    @Transform(({ value }) => (value == null || value === "" ? undefined : Number(value)))
    @IsNumber()
    @Min(0)
    @Max(100)
    lossPct?: number;

    @IsOptional()
    @Transform(({ value }) => (value == null || value === "" ? undefined : Number(value)))
    @IsNumber()
    @Min(0)
    @Max(1_000)
    uploadMbps?: number;
}
