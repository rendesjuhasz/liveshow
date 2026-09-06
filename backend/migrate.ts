import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    const db = drizzle(client);

    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("Migrációk lefuttatva!");

    await client.end();
    process.exit(0);
}

main();
