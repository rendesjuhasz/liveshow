import { BadRequestException } from "@nestjs/common";
import type { ValidationError } from "class-validator";

export function flattenValidationFields(errors: ValidationError[], prefix = ""): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const err of errors) {
        const path = prefix ? `${prefix}.${err.property}` : err.property;
        const texts = err.constraints ? Object.values(err.constraints) : [];
        if (texts[0]) fields[path] = String(texts[0]);
        if (err.children?.length) Object.assign(fields, flattenValidationFields(err.children, path));
    }
    return fields;
}

export function validationExceptionFactory(errors: ValidationError[]) {
    const fields = flattenValidationFields(errors);
    return new BadRequestException({
        message: Object.values(fields),
        fields,
    });
}

export const validationPipeOptions = {
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: validationExceptionFactory,
};
