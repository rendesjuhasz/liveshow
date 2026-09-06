import { PrismaService } from "../prisma/prisma.service";

export function reviewDb(prisma: PrismaService) {
    return (prisma as any).review;
}
