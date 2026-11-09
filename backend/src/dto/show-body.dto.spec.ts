import { ArgumentMetadata, BadRequestException, ValidationPipe } from "@nestjs/common";
import { ShowBodyDto } from "./bodies";

const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
});

const meta: ArgumentMetadata = { type: "body", metatype: ShowBodyDto };

async function parseBody(body: unknown) {
    return pipe.transform(body, meta);
}

async function expectBadRequest(body: unknown) {
    try {
        await parseBody(body);
        throw new Error("expected ValidationPipe to reject the body");
    } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getStatus()).toBe(400);
    }
}

describe("ShowBodyDto originalLocale", () => {
    it("rejects xx, empty string and a number with 400", async () => {
        await expectBadRequest({ originalLocale: "xx" });
        await expectBadRequest({ originalLocale: "" });
        await expectBadRequest({ originalLocale: 123 });
    });

    it("accepts a valid locale code", async () => {
        const parsed = await parseBody({ originalLocale: "en" });
        expect(parsed.originalLocale).toBe("en");
    });

    it("allows omitting originalLocale", async () => {
        const parsed = await parseBody({ title: "Teszt" });
        expect(parsed.originalLocale).toBeUndefined();
    });
});
