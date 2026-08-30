require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");
const auth = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

    function publicUser(id) {
  return db.prepare(`
    SELECT id,name,email,course,department,year,campus,avatar,role,status,created_at
    FROM users WHERE id=?
  `).get(id);
}
 
app.get("/api/health", (_, res) => res.json({ ok: true, app: "CampusConnect API" }));

app.post("/api/auth/register", (req, res) => {
  const {
  name,
  email,
  password,
  course = "",
  department = "",
  year = "",
  campus = "Main Campus",
  role = "student",
  adminCode = ""
} = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
if (!["student", "admin"].includes(role)) {
  return res.status(400).json({
    message: "Invalid account type."
  });
}

if (role === "admin" && adminCode !== process.env.ADMIN_REGISTRATION_CODE) {
  return res.status(403).json({
    message: "Invalid admin registration code."
  });
}
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users(
  name,
  email,
  password_hash,
  course,
  department,
  year,
  campus,
  role
)
VALUES(?,?,?,?,?,?,?,?)
    `).run(
  name.trim(),
  email.toLowerCase().trim(),
  hash,
  course,
  department,
  year,
  campus,
  role
);
    const user = publicUser(result.lastInsertRowid);
    res.status(201).json({ token: tokenFor(user), user });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ message: "An account with this email already exists." });
    res.status(500).json({ message: "Registration failed." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email=?").get((email || "").toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  res.json({ token: tokenFor(user), user: publicUser(user.id) });
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user.id) }));

app.get("/api/announcements", (req, res) => {
  const q = `%${req.query.search || ""}%`;
  const rows = db.prepare(`
    SELECT * FROM announcements
    WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
    ORDER BY datetime(published_at) DESC
  `).all(q, q, q);
  res.json(rows);
});

app.get("/api/items", (req, res) => {
  const { search="", category="", condition="", exchangeType="", location="" } = req.query;
  let sql = `
    SELECT items.*, users.name AS owner_name
    FROM items JOIN users ON users.id=items.user_id
    WHERE (items.name LIKE ? OR items.description LIKE ?)
  `;
  const params = [`%${search}%`, `%${search}%`];

  if (category) { sql += " AND items.category=?"; params.push(category); }
  if (condition) { sql += " AND items.condition=?"; params.push(condition); }
  if (exchangeType) { sql += " AND items.exchange_type=?"; params.push(exchangeType); }
  if (location) { sql += " AND items.location LIKE ?"; params.push(`%${location}%`); }

  sql += " ORDER BY datetime(items.created_at) DESC";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/items", auth, (req, res) => {
  const { name, description="", category, condition, exchangeType, location, image="", preferredExchange="", phone="" } = req.body;
  if (!name || !category || !condition || !exchangeType || !location) {
    return res.status(400).json({ message: "Please fill all required item fields." });
  } 
  const result = db.prepare(`
    INSERT INTO items(user_id,name,description,category,condition,exchange_type,location,image,preferred_exchange,phone)
VALUES(?,?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, name, description, category, condition, exchangeType, location, image, preferredExchange, phone); 

  db.prepare("INSERT INTO notifications(user_id,message) VALUES(?,?)")
    .run(req.user.id, `Your item "${name}" was posted successfully.`);

  res.status(201).json(db.prepare(`
    SELECT items.*, users.name AS owner_name FROM items
    JOIN users ON users.id=items.user_id WHERE items.id=?
  `).get(result.lastInsertRowid));
});
app.put("/api/items/:id", auth, (req, res) => {
  const { name, description="", category, condition, exchangeType, location, preferredExchange="", phone="" } = req.body;

  if (!name || !category || !condition || !exchangeType || !location) {
    return res.status(400).json({ message: "Please fill all required item fields." });
  }

  const item = db.prepare(
    "SELECT * FROM items WHERE id=? AND user_id=?"
  ).get(req.params.id, req.user.id);

  if (!item) {
    return res.status(404).json({ message: "Item not found or you are not the owner." });
  }

  db.prepare(`
    UPDATE items
    SET name=?, description=?, category=?, condition=?,
        exchange_type=?, location=?, preferred_exchange=?, phone=?
    WHERE id=? AND user_id=?
  `).run(
    name,
    description,
    category,
    condition,
    exchangeType,
    location,
    preferredExchange,
    phone,
    req.params.id,
    req.user.id
  );

  res.json(
    db.prepare(`
      SELECT items.*, users.name AS owner_name
      FROM items
      JOIN users ON users.id=items.user_id
      WHERE items.id=?
    `).get(req.params.id)
  );
});
app.post("/api/items/:id/save", auth, (req, res) => {
  const exists = db.prepare("SELECT 1 FROM saved_items WHERE user_id=? AND item_id=?").get(req.user.id, req.params.id);
  if (exists) {
    db.prepare("DELETE FROM saved_items WHERE user_id=? AND item_id=?").run(req.user.id, req.params.id);
    return res.json({ saved: false });
  }
  db.prepare("INSERT INTO saved_items(user_id,item_id) VALUES(?,?)").run(req.user.id, req.params.id);
  res.json({ saved: true });
});

app.get("/api/clubs", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT clubs.*,
      EXISTS(SELECT 1 FROM club_members cm WHERE cm.club_id=clubs.id AND cm.user_id=?) AS joined
    FROM clubs ORDER BY name
  `).all(req.user.id);
  res.json(rows);
});

app.post("/api/clubs/:id/join", auth, (req, res) => {
  const club = db.prepare("SELECT * FROM clubs WHERE id=?").get(req.params.id);
  if (!club) return res.status(404).json({ message: "Club not found." });

  const joined = db.prepare("SELECT 1 FROM club_members WHERE user_id=? AND club_id=?").get(req.user.id, club.id);
  if (joined) {
    db.prepare("DELETE FROM club_members WHERE user_id=? AND club_id=?").run(req.user.id, club.id);
    db.prepare("UPDATE clubs SET members=MAX(0,members-1) WHERE id=?").run(club.id);
    return res.json({ joined: false });
  }

  db.prepare("INSERT INTO club_members(user_id,club_id) VALUES(?,?)").run(req.user.id, club.id);
  db.prepare("UPDATE clubs SET members=members+1 WHERE id=?").run(club.id);
  db.prepare("INSERT INTO notifications(user_id,message) VALUES(?,?)").run(req.user.id, `You joined ${club.name}.`);
  res.json({ joined: true });
});

app.get("/api/events", (req, res) => {
  const q = `%${req.query.search || ""}%`;
  res.json(db.prepare(`
    SELECT * FROM events
    WHERE name LIKE ? OR description LIKE ? OR category LIKE ? OR venue LIKE ?
    ORDER BY datetime(event_date)
  `).all(q, q, q, q));
});

app.post("/api/events/:id/register", auth, (req, res) => {
  const event = db.prepare("SELECT * FROM events WHERE id=?").get(req.params.id);
  if (!event) return res.status(404).json({ message: "Event not found." });

  const already = db.prepare("SELECT 1 FROM event_registrations WHERE user_id=? AND event_id=?").get(req.user.id, event.id);
  if (already) return res.status(409).json({ message: "You are already registered." });

  db.prepare("INSERT INTO event_registrations(user_id,event_id) VALUES(?,?)").run(req.user.id, event.id);
  db.prepare("UPDATE events SET participants=participants+1 WHERE id=?").run(event.id);
  db.prepare("INSERT INTO notifications(user_id,message) VALUES(?,?)").run(req.user.id, `Registered for ${event.name}.`);
  res.json({ registered: true });
});

app.get("/api/lost-found", (req, res) => {
  const { search="", type="", category="", location="" } = req.query;
  let sql = `
    SELECT lost_found.*, users.name AS poster_name
    FROM lost_found JOIN users ON users.id=lost_found.user_id
    WHERE (lost_found.name LIKE ? OR lost_found.description LIKE ?)
  `;
  const params = [`%${search}%`, `%${search}%`];
  if (type) { sql += " AND type=?"; params.push(type); }
  if (category) { sql += " AND category=?"; params.push(category); }
  if (location) { sql += " AND location LIKE ?"; params.push(`%${location}%`); }
  sql += " ORDER BY datetime(created_at) DESC";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/lost-found", auth, (req, res) => {
  const { type, name, description, category, location, image="" } = req.body;
  if (!type || !name || !description || !category || !location) {
    return res.status(400).json({ message: "Please complete all required fields." });
  }
  const result = db.prepare(`
    INSERT INTO lost_found(user_id,type,name,description,category,location,image)
    VALUES(?,?,?,?,?,?,?)
  `).run(req.user.id, type, name, description, category, location, image);
  res.status(201).json(db.prepare(`
    SELECT lost_found.*, users.name AS poster_name
    FROM lost_found JOIN users ON users.id=lost_found.user_id WHERE lost_found.id=?
  `).get(result.lastInsertRowid));
});

app.patch("/api/lost-found/:id/recover", auth, (req, res) => {
  const post = db.prepare("SELECT * FROM lost_found WHERE id=?").get(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found." });
  if (post.user_id !== req.user.id) return res.status(403).json({ message: "Only the poster can mark this recovered." });
  db.prepare("UPDATE lost_found SET status='Recovered' WHERE id=?").run(post.id);
  res.json({ status: "Recovered" });
});
function adminOnly(req, res, next) {
  const user = publicUser(req.user.id);

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
}

app.get("/api/admin/users", auth, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, course, department, year, campus, role, created_at
    FROM users
    ORDER BY id DESC
  `).all();

  res.json(users);
});
app.patch("/api/admin/users/:id/status", auth, adminOnly, (req, res) => {
  const { status } = req.body;

  if (!["active", "blocked"].includes(status)) {
    return res.status(400).json({ message: "Invalid status." });
  }

  const user = db.prepare("SELECT id, role FROM users WHERE id=?").get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.id === req.user.id) {
    return res.status(400).json({ message: "You cannot change your own account status." });
  }

  db.prepare("UPDATE users SET status=? WHERE id=?").run(status, req.params.id);

  res.json({ message: `User ${status}.`, status });
});
app.patch("/api/admin/users/:id/role", auth, adminOnly, (req, res) => {
  const { role } = req.body;

  if (!["student", "admin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  const user = db.prepare("SELECT id FROM users WHERE id=?").get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.id === req.user.id && role !== "admin") {
    return res.status(400).json({ message: "You cannot remove your own admin role." });
  }

  db.prepare("UPDATE users SET role=? WHERE id=?").run(role, req.params.id);

  res.json({ message: "User role updated.", role });
});
app.delete("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const user = db.prepare("SELECT id FROM users WHERE id=?").get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (user.id === req.user.id) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);

  res.json({ message: "User deleted successfully." });
});

app.get("/api/dashboard", auth, (req, res) => {
  const user = publicUser(req.user.id);
  const myItems = db.prepare("SELECT * FROM items WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  const saved = db.prepare(`
    SELECT items.* FROM items JOIN saved_items ON saved_items.item_id=items.id
    WHERE saved_items.user_id=? ORDER BY items.id DESC
  `).all(req.user.id);
  const clubs = db.prepare(`
    SELECT clubs.* FROM clubs JOIN club_members cm ON cm.club_id=clubs.id WHERE cm.user_id=?
  `).all(req.user.id);
  const events = db.prepare(`
    SELECT events.* FROM events JOIN event_registrations er ON er.event_id=events.id
    WHERE er.user_id=? ORDER BY datetime(events.event_date)
  `).all(req.user.id);
  const lostFound = db.prepare("SELECT * FROM lost_found WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  const notifications = db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 10").all(req.user.id);
  res.json({ user, myItems, saved, clubs, events, lostFound, notifications });
});

app.get("/api/stats", (_, res) => {
  res.json({
    itemsReused: db.prepare("SELECT COUNT(*) c FROM items").get().c + 124,
    studentsConnected: db.prepare("SELECT COUNT(*) c FROM users").get().c + 842,
    eventsHosted: db.prepare("SELECT COUNT(*) c FROM events").get().c + 37,
    recoveredItems: db.prepare("SELECT COUNT(*) c FROM lost_found WHERE status='Recovered'").get().c + 28
  });
});

const clientDist = path.join(__dirname, "..", "client", "dist");
if (require("fs").existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/{*splat}", (_, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`CampusConnect API running at http://localhost:${PORT}`);
});
