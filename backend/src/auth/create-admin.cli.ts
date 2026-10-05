/**
 * Create or promote an admin. Does not go through public register.
 * Usage (from backend/): npm run create-admin -- email@example.com 'StrongPass1' "Név"
 */
import { config as loadEnv } from "dotenv";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

loadEnv({ path: join(__dirname, "..", "..", ".env") });

async function main() {
    const email = String(process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL || "")
        .trim()
        .toLowerCase();
    const password = String(process.argv[3] || process.env.ADMIN_PASSWORD || "");
    const name = String(process.argv[4] || "Admin").trim() || "Admin";

    if (!email.includes("@") || password.length < 8) {
        console.error("Használat: npm run create-admin -- email@domain.hu 'jelszólegalabb8' \"Megjelenő név\"");
        process.exit(1);
    }
    if (process.env.NODE_ENV === "production" && email === "admin@admin.com") {
        console.error("Élesben admin@admin.com nem használható.");
        process.exit(1);
    }

    const prisma = new PrismaClient();
    const hash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: { password: hash, role: "admin", name },
        });
        await prisma.$executeRaw`
            UPDATE "User" SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = ${existing.id}
        `.catch(() => undefined);
        console.log(`Frissítve: ${email} (role=admin, email verified)`);
    } else {
        const created = await prisma.user.create({
            data: { email, password: hash, role: "admin", name },
        });
        await prisma.$executeRaw`
            UPDATE "User" SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = ${created.id}
        `.catch(() => undefined);
        console.log(`Létrehozva: ${email} (role=admin)`);
    }
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
