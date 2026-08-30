require("dotenv").config();

const Database = require("better-sqlite3");
const pgPromise = require("pg-promise");

const sqlite = new Database("./server/data/campusconnect.db");

const pgp = pgPromise();

const pg = pgp({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  console.log("Starting migration...");

  const tables = [
    "users",
    "announcements",
    "clubs",
    "events",
    "items",
    "lost_found",
    "club_members",
    "event_registrations",
    "saved_items",
    "notifications"
  ];

  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();

    console.log(`${table}: ${rows.length} records`);

    if (rows.length === 0) continue;

    for (const row of rows) {
      const columns = Object.keys(row);
      const values = columns.map((column) => row[column]);

      const columnNames = columns.map((c) => `"${c}"`).join(", ");
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      try {
        await pg.none(
          `INSERT INTO "${table}" (${columnNames})
           VALUES (${placeholders})
           ON CONFLICT DO NOTHING`,
          values
        );
      } catch (error) {
        console.error(`Error migrating ${table}:`, error.message);
      }
    }
      }

  const sequenceTables = [
  "users",
  "announcements",
  "clubs",
  "events",
  "items",
  "lost_found",
  "notifications"
];

  for (const table of sequenceTables) {
    await pg.one(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        true
      )
    `);
  }

  console.log("Database ID sequences fixed.");

  console.log("Migration completed successfully.");

  await pg.$pool.end();
  sqlite.close();
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  sqlite.close();
  pg.$pool.end();
});