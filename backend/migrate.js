"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
async function main() {
    const client = new pg_1.Client({
        connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    const db = (0, node_postgres_1.drizzle)(client);
    await (0, migrator_1.migrate)(db, { migrationsFolder: "./drizzle" });
    console.log("Migrációk lefuttatva!");
    await client.end();
    process.exit(0);
}
main();
