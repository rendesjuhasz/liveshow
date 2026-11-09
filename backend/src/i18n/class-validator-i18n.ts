import { translate } from "./messages";

function fill(template: string, vars: Record<string, string>) {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Maps class-validator English defaults to the UI language. Unknown texts stay unchanged. */
export function localizeClassValidatorMessage(message: string, locale: string) {
    const text = String(message || "").trim();
    const tooLong = text.match(/^.+ must be shorter than or equal to (\d+) characters$/i);
    if (tooLong) return fill(translate("validate.tooLong", locale), { n: tooLong[1] });
    const tooShort = text.match(/^.+ must be longer than or equal to (\d+) characters$/i);
    if (tooShort) return fill(translate("validate.tooShort", locale), { n: tooShort[1] });
    if (/^.+ should not be empty$/i.test(text)) return translate("validate.required", locale);
    if (/^.+ must be an email$/i.test(text)) return translate("validate.email", locale);
    if (/^.+ must be a string$/i.test(text)) return translate("validate.string", locale);
    if (/^.+ must be a (number|integer)$/i.test(text)) return translate("validate.number", locale);
    if (/^property .+ should not exist$/i.test(text)) return translate("validate.unknownField", locale);
    return text;
}
