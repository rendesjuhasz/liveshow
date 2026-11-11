import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from "@nestjs/common";
import { localizeClassValidatorMessage } from "./class-validator-i18n";
import { MESSAGES, translate } from "./messages";
import { I18nService } from "./i18n.service";

function pickLocale(req: { query?: Record<string, unknown>; headers?: Record<string, unknown> }) {
    const q = String(req.query?.lang || "");
    const header = String(req.headers?.["x-locale"] || "");
    const accept = String(req.headers?.["accept-language"] || "");
    return q || header || accept;
}

function localizeMessage(message: string, locale: string) {
    if (/^internal server error$/i.test(message.trim())) {
        return translate("common.error", locale);
    }
    if (MESSAGES[message]) return translate(message, locale);
    for (const [key, row] of Object.entries(MESSAGES)) {
        if (row.hu === message) return translate(key, locale);
    }
    return localizeClassValidatorMessage(message, locale);
}

@Catch()
export class I18nExceptionFilter implements ExceptionFilter {
    constructor(private readonly i18n: I18nService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        const locale = this.i18n.resolveLocale(pickLocale(req), String(req.headers?.["accept-language"] || ""));

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = translate("common.error", locale);
        let error = "Internal Server Error";
        let fields: Record<string, string> | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const payload = exception.getResponse();
            error = exception.name;
            if (typeof payload === "string") {
                message = localizeMessage(payload, locale);
            } else if (payload && typeof payload === "object") {
                const body = payload as {
                    message?: string | string[];
                    error?: string;
                    fields?: Record<string, string>;
                };
                if (Array.isArray(body.message)) {
                    message = body.message.map((item) => localizeMessage(String(item), locale));
                } else if (body.message) {
                    message = localizeMessage(String(body.message), locale);
                }
                if (body.error) error = body.error;
                if (body.fields && typeof body.fields === "object") {
                    fields = {};
                    for (const [key, value] of Object.entries(body.fields)) {
                        fields[key] = localizeMessage(String(value), locale);
                    }
                }
            }
        } else if (exception instanceof Error && exception.message) {
            message = localizeMessage(exception.message, locale);
        }

        res.status(status).json({
            statusCode: status,
            message,
            error,
            locale,
            ...(fields && Object.keys(fields).length ? { fields } : {}),
        });
    }
}
