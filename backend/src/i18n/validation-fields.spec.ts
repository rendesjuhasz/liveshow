import { BadRequestException } from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { flattenValidationFields, validationExceptionFactory } from "./validation-fields";

describe("validation fields", () => {
    it("keeps the property name as the field key", () => {
        const errors = [
            {
                property: "title",
                constraints: { maxLength: "title must be shorter than or equal to 200 characters" },
                children: [],
            },
        ] as unknown as ValidationError[];
        expect(flattenValidationFields(errors)).toEqual({
            title: "title must be shorter than or equal to 200 characters",
        });
        const ex = validationExceptionFactory(errors);
        expect(ex).toBeInstanceOf(BadRequestException);
        expect((ex.getResponse() as { fields: Record<string, string> }).fields.title).toContain("200");
    });
});
