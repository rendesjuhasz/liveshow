/** Prisma cannot deserialize PostgreSQL `void` from `pg_advisory_xact_lock`. The lock still runs. */
function ignoreVoidDeserialize(err: unknown) {
    const msg = String((err as Error)?.message || err);
    if (/void|deserialize/i.test(msg)) return;
    throw err;
}

export async function advisoryXactLock(
    db: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> },
    keyA: string,
    keyB?: string,
) {
    try {
        if (keyB == null) {
            await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${keyA}))`;
            return;
        }
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${keyA}), hashtext(${keyB}))`;
    } catch (err) {
        ignoreVoidDeserialize(err);
    }
}
