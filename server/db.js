const pgPromise = require("pg-promise");

const pgp = pgPromise({
  capSQL: true
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}
const db = pgp({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});


async function initializeDatabase() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      course TEXT DEFAULT '',
      department TEXT DEFAULT '',
      year TEXT DEFAULT '',
      campus TEXT DEFAULT 'Main Campus',
      avatar TEXT DEFAULT '',
      role TEXT DEFAULT 'student',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT NOT NULL,
      condition TEXT NOT NULL,
      exchange_type TEXT NOT NULL,
      location TEXT NOT NULL,
      image TEXT DEFAULT '',
      preferred_exchange TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clubs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      members INTEGER DEFAULT 0,
      logo TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS club_members (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, club_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      venue TEXT NOT NULL,
      organizer TEXT NOT NULL,
      event_date TIMESTAMP NOT NULL,
      registration_deadline TIMESTAMP NOT NULL,
      participants INTEGER DEFAULT 0,
      image TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS lost_found (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('Lost','Found')),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      image TEXT DEFAULT '',
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_items (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("PostgreSQL database initialized.");
}

initializeDatabase().catch((err) => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});

module.exports = db;