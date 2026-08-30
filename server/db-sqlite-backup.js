const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = process.env.DB_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "campusconnect.db"));
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  exchange_type TEXT NOT NULL,
  location TEXT NOT NULL,
  image TEXT DEFAULT '',
  preferred_exchange TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'Normal',
  published_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  members INTEGER DEFAULT 0,
  logo TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS club_members (
  user_id INTEGER NOT NULL,
  club_id INTEGER NOT NULL,
  PRIMARY KEY(user_id, club_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(club_id) REFERENCES clubs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  venue TEXT NOT NULL,
  organizer TEXT NOT NULL,
  event_date TEXT NOT NULL,
  registration_deadline TEXT NOT NULL,
  participants INTEGER DEFAULT 0,
  image TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS event_registrations (
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, event_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lost_found (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('Lost','Found')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  image TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_items (
  user_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  PRIMARY KEY(user_id, item_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);
try {
  db.prepare("ALTER TABLE items ADD COLUMN phone TEXT DEFAULT ''").run();
} catch (e) {
  if (!e.message.includes("duplicate column name")) throw e;
}
function seed() {
  const bcrypt = require("bcryptjs");
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count === 0) {
    const hash = bcrypt.hashSync("Demo@123", 10);
    db.prepare(`
      INSERT INTO users(name,email,password_hash,course,department,year,campus)
      VALUES(?,?,?,?,?,?,?)
    `).run("Demo Student", "demo@campusconnect.edu", hash, "B.Tech", "Computer Science", "3rd Year", "Main Campus");
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM announcements").get().c === 0) {
    const stmt = db.prepare("INSERT INTO announcements(title,description,category,priority,published_at) VALUES(?,?,?,?,?)");
    stmt.run("Mid-Semester Examination Schedule Released", "The examination timetable is now available. Please check your department notice board for room allocations.", "Examinations", "Urgent", "2026-08-12");
    stmt.run("Scholarship Applications Open", "Eligible students can submit scholarship applications through the student support office.", "Scholarship", "Normal", "2026-08-10");
    stmt.run("Independence Day Campus Program", "Join the campus celebration with student performances, speeches and community activities.", "Campus", "Normal", "2026-08-08");
    stmt.run("Library Hours Extended", "The central library will remain open until 9 PM during the examination preparation period.", "Department", "Normal", "2026-08-06");
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM clubs").get().c === 0) {
    const stmt = db.prepare("INSERT INTO clubs(name,category,description,members,logo) VALUES(?,?,?,?,?)");
    stmt.run("CodeCraft Society", "Technology", "Build projects, learn modern technologies and participate in coding competitions.", 128, "💻");
    stmt.run("Green Campus Club", "Environment", "Student-led sustainability projects, recycling drives and campus cleanups.", 96, "🌱");
    stmt.run("Literary Circle", "Literature", "A friendly community for writers, readers, poetry and public speaking.", 74, "📚");
    stmt.run("Campus Sports League", "Sports", "Inter-department sports activities, training and tournaments.", 210, "🏆");
    stmt.run("Entrepreneurship Cell", "Entrepreneurship", "Workshops, startup ideas, mentoring and student founder meetups.", 112, "🚀");
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM events").get().c === 0) {
    const stmt = db.prepare("INSERT INTO events(name,description,category,venue,organizer,event_date,registration_deadline,participants,image) VALUES(?,?,?,?,?,?,?,?,?)");
    stmt.run("Campus Hackathon 2026", "A 24-hour student hackathon focused on solving real campus and community problems.", "Technology", "Innovation Lab", "CodeCraft Society", "2026-08-22T09:00:00", "2026-08-20T23:59:00", 86, "💻");
    stmt.run("Green Campus Drive", "Bring reusable materials and join students in a campus sustainability drive.", "Environment", "Main Quadrangle", "Green Campus Club", "2026-08-18T08:00:00", "2026-08-17T18:00:00", 54, "🌱");
    stmt.run("Open Mic Evening", "Poetry, music and storytelling by students from across campus.", "Arts", "Auditorium", "Literary Circle", "2026-08-28T17:30:00", "2026-08-27T20:00:00", 123, "🎤");
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM items").get().c === 0) {
    const user = db.prepare("SELECT id FROM users WHERE email=?").get("demo@campusconnect.edu");
    const stmt = db.prepare("INSERT INTO items(user_id,name,description,category,condition,exchange_type,location,image,preferred_exchange) VALUES(?,?,?,?,?,?,?,?,?)");
    stmt.run(user.id, "Engineering Textbooks", "Set of second and third year engineering textbooks in good condition.", "Books", "Good", "Exchange", "Library Block", "📚", "Open to other technical books");
    stmt.run(user.id, "Study Table", "Compact wooden study table, ideal for hostel rooms.", "Furniture", "Good", "Giveaway", "Hostel A", "🪑", "Free pickup");
    stmt.run(user.id, "Scientific Calculator", "Working calculator with minor cosmetic marks.", "Electronics", "Fair", "Donation", "CSE Block", "🧮", "Can exchange for stationery");
    stmt.run(user.id, "Bicycle", "Well-maintained city bicycle.", "Bicycles", "Excellent", "Exchange", "Sports Complex", "🚲", "Open to cycling accessories");
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM lost_found").get().c === 0) {
    const user = db.prepare("SELECT id FROM users WHERE email=?").get("demo@campusconnect.edu");
    const stmt = db.prepare("INSERT INTO lost_found(user_id,type,name,description,category,location,image) VALUES(?,?,?,?,?,?,?)");
    stmt.run(user.id, "Lost", "Black Water Bottle", "Black insulated bottle with a small university sticker.", "Personal", "Library Block", "🧴");
    stmt.run(user.id, "Found", "Blue Notebook", "Blue notebook found near the student cafeteria.", "Books", "Cafeteria", "📘");
  }
}
seed();

module.exports = db;
const userColumns = db.prepare("PRAGMA table_info(users)").all();

if (!userColumns.some(column => column.name === "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'");
}

if (!userColumns.some(column => column.name === "status")) {
  db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
}