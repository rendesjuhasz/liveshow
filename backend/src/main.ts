import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { config as loadEnv } from "dotenv";
import { join } from "path";

loadEnv({ path: join(__dirname, "..", ".env") });
import helmet from "helmet";
import { AppModule } from "./app.module";
import { corsOrigins, jwtSecret, assertRequiredSecrets } from "./auth/secrets";
import { CSRF_HEADER } from "./security/http-guard";
import { pingRateLimitStore, trustProxyEnabled } from "./security/rate-limit";

async function bootstrap() {
    assertRequiredSecrets();
    jwtSecret();
    await pingRateLimitStore();
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
    if (trustProxyEnabled()) {
        app.set("trust proxy", 1);
    }

    app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: false,
                directives: {
                    defaultSrc: ["'none'"],
                    frameAncestors: ["'none'"],
                    baseUri: ["'none'"],
                    formAction: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false,
            hsts:
                process.env.NODE_ENV === "production"
                    ? { maxAge: 15552000, includeSubDomains: true }
                    : false,
        }),
    );

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    app.enableCors({
        origin: process.env.NODE_ENV === "production" ? corsOrigins() : true,
        methods: "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "X-Locale",
            "Accept-Language",
            CSRF_HEADER,
            "stripe-signature",
        ],
        credentials: true,
    });

    await app.listen(Number(process.env.PORT ?? 3200), "0.0.0.0");
}
bootstrap();
