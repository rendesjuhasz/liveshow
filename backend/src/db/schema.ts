import { pgTable, serial, varchar, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    verificationCode: varchar("verification_code", { length: 255 }),
    emailVerified: boolean("email_verified").default(false),
    role: varchar("role", { length: 50 }).default("user"),
});
