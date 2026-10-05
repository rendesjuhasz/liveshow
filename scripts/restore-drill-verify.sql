-- Repeatable counts for docs/restore-test.md
-- Usage: psql "$DRILL_URL" -v ON_ERROR_STOP=1 -f scripts/restore-drill-verify.sql
-- Refuses to run unless the database name contains "restore" and "drill".

DO $$
BEGIN
    IF current_database() !~* 'restore'
       OR current_database() !~* 'drill' THEN
        RAISE EXCEPTION
            'Refusing restore-drill-verify on database "%" — expected a name like liveshow_restore_drill',
            current_database();
    END IF;
END $$;

SELECT current_database() AS db;
SELECT COUNT(*) AS prisma_migrations FROM _prisma_migrations;
SELECT COUNT(*) AS users FROM "User";
SELECT COUNT(*) AS shows FROM "Show";
SELECT COUNT(*) AS streamers FROM "Streamer";
SELECT COUNT(*) AS tickets FROM "Ticket";
SELECT COUNT(*) AS archives FROM "Archive";
SELECT COUNT(*) AS email_log FROM "EmailLog";
