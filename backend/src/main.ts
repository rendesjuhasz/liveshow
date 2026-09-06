import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";
import { corsOrigins, jwtSecret } from "./auth/secrets";

async function bootstrap() {
  jwtSecret();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: process.env.NODE_ENV === "production" ? corsOrigins() : true,
    methods: "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Locale", "Accept-Language"],
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });

  await app.listen(Number(process.env.PORT ?? 3200), "0.0.0.0");
}
bootstrap();
