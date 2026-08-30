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
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function publicUser(id) {
  return db.oneOrNone(`
    SELECT id,name,email,course,department,year,campus,avatar,role,status,created_at
    FROM users
    WHERE id=$1
  `, [id]);
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true, app: "CampusConnect API" });
});

app.post("/api/auth/register", async (req, res) => {
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

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Name, email and password are required."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters."
    });
  }

  if (!["student", "admin"].includes(role)) {
    return res.status(400).json({
      message: "Invalid account type."
    });
  }

  if (
    role === "admin" &&
    adminCode !== process.env.ADMIN_REGISTRATION_CODE
  ) {
    return res.status(403).json({
      message: "Invalid admin registration code."
    });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);

    const user = await db.one(`
      INSERT INTO users(
        name,email,password_hash,course,department,year,campus,role
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [
      name.trim(),
      email.toLowerCase().trim(),
      hash,
      course,
      department,
      year,
      campus,
      role
    ]);

    const createdUser = await publicUser(user.id);

    res.status(201).json({
      token: tokenFor(createdUser),
      user: createdUser
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    console.error(e);
    res.status(500).json({
      message: "Registration failed."
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.oneOrNone(
      "SELECT * FROM users WHERE email=$1",
      [(email || "").toLowerCase().trim()]
    );

    if (
      !user ||
      !bcrypt.compareSync(password || "", user.password_hash)
    ) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account has been blocked."
      });
    }

    res.json({
      token: tokenFor(user),
      user: await publicUser(user.id)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Login failed."
    });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    res.json({
      user: await publicUser(req.user.id)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Unable to load user."
    });
  }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const q = `%${req.query.search || ""}%`;

    const rows = await db.any(`
      SELECT *
      FROM announcements
      WHERE title ILIKE $1
         OR description ILIKE $1
         OR category ILIKE $1
      ORDER BY published_at DESC
    `, [q]);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load announcements."
    });
  }
});

app.get("/api/items", async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      condition = "",
      exchangeType = "",
      location = ""
    } = req.query;

    let sql = `
      SELECT items.*, users.name AS owner_name
      FROM items
      JOIN users ON users.id=items.user_id
      WHERE (items.name ILIKE $1 OR items.description ILIKE $1)
    `;

    const params = [`%${search}%`];
    let n = 2;

    if (category) {
      sql += ` AND items.category=$${n++}`;
      params.push(category);
    }

    if (condition) {
      sql += ` AND items.condition=$${n++}`;
      params.push(condition);
    }

    if (exchangeType) {
      sql += ` AND items.exchange_type=$${n++}`;
      params.push(exchangeType);
    }

    if (location) {
      sql += ` AND items.location ILIKE $${n++}`;
      params.push(`%${location}%`);
    }

    sql += " ORDER BY items.created_at DESC";

    res.json(await db.any(sql, params));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load items."
    });
  }
});

app.post("/api/items", auth, async (req, res) => {
  try {
    const {
      name,
      description = "",
      category,
      condition,
      exchangeType,
      location,
      image = "",
      preferredExchange = "",
      phone = ""
    } = req.body;

    if (!name || !category || !condition || !exchangeType || !location) {
      return res.status(400).json({
        message: "Please fill all required item fields."
      });
    }

    const result = await db.one(`
      INSERT INTO items(
        user_id,name,description,category,condition,
        exchange_type,location,image,preferred_exchange,phone
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `, [
      req.user.id,
      name,
      description,
      category,
      condition,
      exchangeType,
      location,
      image,
      preferredExchange,
      phone
    ]);

    await db.none(`
  INSERT INTO notifications(user_id, message)
  SELECT id, $1
  FROM users
  WHERE id <> $2
`, [
  `New item posted: "${name}"`,
  req.user.id
]);
    const item = await db.one(`
      SELECT items.*, users.name AS owner_name
      FROM items
      JOIN users ON users.id=items.user_id
      WHERE items.id=$1
    `, [result.id]);

    res.status(201).json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to create item."
    });
  }
});

app.put("/api/items/:id", auth, async (req, res) => {
  try {
    const {
      name,
      description = "",
      category,
      condition,
      exchangeType,
      location,
      preferredExchange = "",
      phone = ""
    } = req.body;

    if (!name || !category || !condition || !exchangeType || !location) {
      return res.status(400).json({
        message: "Please fill all required item fields."
      });
    }

    const item = await db.oneOrNone(
      "SELECT * FROM items WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );

    if (!item) {
      return res.status(404).json({
        message: "Item not found or you are not the owner."
      });
    }

    await db.none(`
      UPDATE items
      SET name=$1,
          description=$2,
          category=$3,
          condition=$4,
          exchange_type=$5,
          location=$6,
          preferred_exchange=$7,
          phone=$8
      WHERE id=$9 AND user_id=$10
    `, [
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
    ]);

    res.json(await db.one(`
      SELECT items.*, users.name AS owner_name
      FROM items
      JOIN users ON users.id=items.user_id
      WHERE items.id=$1
    `, [req.params.id]));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to update item."
    });
  }
});

app.post("/api/items/:id/save", auth, async (req, res) => {
  try {
    const exists = await db.oneOrNone(
      "SELECT 1 FROM saved_items WHERE user_id=$1 AND item_id=$2",
      [req.user.id, req.params.id]
    );

    if (exists) {
      await db.none(
        "DELETE FROM saved_items WHERE user_id=$1 AND item_id=$2",
        [req.user.id, req.params.id]
      );

      return res.json({ saved: false });
    }

    await db.none(
      "INSERT INTO saved_items(user_id,item_id) VALUES($1,$2)",
      [req.user.id, req.params.id]
    );

    res.json({ saved: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Unable to save item."
    });
  }
});

app.get("/api/clubs", auth, async (req, res) => {
  try {
    const rows = await db.any(`
      SELECT clubs.*,
        EXISTS(
          SELECT 1
          FROM club_members cm
          WHERE cm.club_id=clubs.id
          AND cm.user_id=$1
        ) AS joined
      FROM clubs
      ORDER BY name
    `, [req.user.id]);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load clubs."
    });
  }
});

app.post("/api/clubs/:id/join", auth, async (req, res) => {
  try {
    const club = await db.oneOrNone(
      "SELECT * FROM clubs WHERE id=$1",
      [req.params.id]
    );

    if (!club) {
      return res.status(404).json({
        message: "Club not found."
      });
    }

    const joined = await db.oneOrNone(
      "SELECT 1 FROM club_members WHERE user_id=$1 AND club_id=$2",
      [req.user.id, club.id]
    );

    if (joined) {
      await db.none(
        "DELETE FROM club_members WHERE user_id=$1 AND club_id=$2",
        [req.user.id, club.id]
      );

      await db.none(
        "UPDATE clubs SET members=GREATEST(0,members-1) WHERE id=$1",
        [club.id]
      );

      return res.json({ joined: false });
    }

    await db.none(
      "INSERT INTO club_members(user_id,club_id) VALUES($1,$2)",
      [req.user.id, club.id]
    );

    await db.none(
      "UPDATE clubs SET members=members+1 WHERE id=$1",
      [club.id]
    );

    await db.none(
      "INSERT INTO notifications(user_id,message) VALUES($1,$2)",
      [req.user.id, `You joined ${club.name}.`]
    );

    res.json({ joined: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Unable to join club."
    });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const q = `%${req.query.search || ""}%`;

    res.json(await db.any(`
      SELECT *
      FROM events
      WHERE name ILIKE $1
         OR description ILIKE $1
         OR category ILIKE $1
         OR venue ILIKE $1
      ORDER BY event_date
    `, [q]));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load events."
    });
  }
});

app.post("/api/events/:id/register", auth, async (req, res) => {
  try {
    const event = await db.oneOrNone(
      "SELECT * FROM events WHERE id=$1",
      [req.params.id]
    );

    if (!event) {
      return res.status(404).json({
        message: "Event not found."
      });
    }

    const already = await db.oneOrNone(
      "SELECT 1 FROM event_registrations WHERE user_id=$1 AND event_id=$2",
      [req.user.id, event.id]
    );

    if (already) {
      return res.status(409).json({
        message: "You are already registered."
      });
    }

    await db.none(
      "INSERT INTO event_registrations(user_id,event_id) VALUES($1,$2)",
      [req.user.id, event.id]
    );

    await db.none(
      "UPDATE events SET participants=participants+1 WHERE id=$1",
      [event.id]
    );

    await db.none(
      "INSERT INTO notifications(user_id,message) VALUES($1,$2)",
      [req.user.id, `Registered for ${event.name}.`]
    );

    res.json({ registered: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Unable to register for event."
    });
  }
});

app.get("/api/lost-found", async (req, res) => {
  try {
    const {
      search = "",
      type = "",
      category = "",
      location = ""
    } = req.query;

    let sql = `
      SELECT lost_found.*, users.name AS poster_name
      FROM lost_found
      JOIN users ON users.id=lost_found.user_id
      WHERE (
        lost_found.name ILIKE $1
        OR lost_found.description ILIKE $1
      )
    `;

    const params = [`%${search}%`];
    let n = 2;

    if (type) {
      sql += ` AND type=$${n++}`;
      params.push(type);
    }

    if (category) {
      sql += ` AND category=$${n++}`;
      params.push(category);
    }

    if (location) {
      sql += ` AND location ILIKE $${n++}`;
      params.push(`%${location}%`);
    }

    sql += " ORDER BY created_at DESC";

    res.json(await db.any(sql, params));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load lost and found posts."
    });
  }
});

app.post("/api/lost-found", auth, async (req, res) => {
  try {
    const {
      type,
      name,
      description,
      category,
      location,
      image = ""
    } = req.body;

    if (!type || !name || !description || !category || !location) {
      return res.status(400).json({
        message: "Please complete all required fields."
      });
    }

    const result = await db.one(`
      INSERT INTO lost_found(
        user_id,type,name,description,category,location,image
      )
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `, [
      req.user.id,
      type,
      name,
      description,
      category,
      location,
      image
    ]);

    // Notify all other users
    await db.tx(async t => {
  const users = await t.any(
    "SELECT id FROM users WHERE id <> $1",
    [req.user.id]
  );

  for (const user of users) {
    await t.none(
      "INSERT INTO notifications(user_id, message) VALUES($1, $2)",
      [
        user.id,
        `New ${type.toLowerCase()} item posted: "${name}"`
      ]
    );
  }
});

    res.status(201).json(await db.one(`
      SELECT lost_found.*, users.name AS poster_name
      FROM lost_found
      JOIN users ON users.id=lost_found.user_id
      WHERE lost_found.id=$1
    `, [result.id]));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to create post."
    });
  }
});

app.patch("/api/lost-found/:id/recover", auth, async (req, res) => {
  try {
    const post = await db.oneOrNone(
      "SELECT * FROM lost_found WHERE id=$1",
      [req.params.id]
    );

    if (!post) {
      return res.status(404).json({
        message: "Post not found."
      });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({
        message: "Only the poster can mark this recovered."
      });
    }

    await db.none(
      "UPDATE lost_found SET status='Recovered' WHERE id=$1",
      [post.id]
    );

    res.json({ status: "Recovered" });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to recover post."
    });
  }
});

async function adminOnly(req, res, next) {
  try {
    const user = await publicUser(req.user.id);

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required."
      });
    }

    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Unable to verify admin."
    });
  }
}

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const users = await db.any(`
      SELECT id,name,email,course,department,year,campus,role,created_at
      FROM users
      ORDER BY id DESC
    `);

    res.json(users);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load users."
    });
  }
});

app.patch("/api/admin/users/:id/status", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status."
      });
    }

    const user = await db.oneOrNone(
      "SELECT id,role FROM users WHERE id=$1",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        message: "You cannot change your own account status."
      });
    }

    await db.none(
      "UPDATE users SET status=$1 WHERE id=$2",
      [status, req.params.id]
    );

    res.json({
      message: `User ${status}.`,
      status
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to update user status."
    });
  }
});

app.patch("/api/admin/users/:id/role", auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["student", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role."
      });
    }

    const user = await db.oneOrNone(
      "SELECT id FROM users WHERE id=$1",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.id === req.user.id && role !== "admin") {
      return res.status(400).json({
        message: "You cannot remove your own admin role."
      });
    }

    await db.none(
      "UPDATE users SET role=$1 WHERE id=$2",
      [role, req.params.id]
    );

    res.json({
      message: "User role updated.",
      role
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to update user role."
    });
  }
});

app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const user = await db.oneOrNone(
      "SELECT id FROM users WHERE id=$1",
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        message: "You cannot delete your own account."
      });
    }

    await db.none(
      "DELETE FROM users WHERE id=$1",
      [req.params.id]
    );

    res.json({
      message: "User deleted successfully."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to delete user."
    });
  }
});

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const user = await publicUser(req.user.id);

    const myItems = await db.any(
      "SELECT * FROM items WHERE user_id=$1 ORDER BY id DESC",
      [req.user.id]
    );

    const saved = await db.any(`
      SELECT items.*
      FROM items
      JOIN saved_items ON saved_items.item_id=items.id
      WHERE saved_items.user_id=$1
      ORDER BY items.id DESC
    `, [req.user.id]);

    const clubs = await db.any(`
      SELECT clubs.*
      FROM clubs
      JOIN club_members cm ON cm.club_id=clubs.id
      WHERE cm.user_id=$1
    `, [req.user.id]);

    const events = await db.any(`
      SELECT events.*
      FROM events
      JOIN event_registrations er ON er.event_id=events.id
      WHERE er.user_id=$1
      ORDER BY events.event_date
    `, [req.user.id]);

    const lostFound = await db.any(
      "SELECT * FROM lost_found WHERE user_id=$1 ORDER BY id DESC",
      [req.user.id]
    );

    const notifications = await db.any(`
      SELECT *
      FROM notifications
      WHERE user_id=$1
      ORDER BY id DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      user,
      myItems,
      saved,
      clubs,
      events,
      lostFound,
      notifications
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load dashboard."
    });
  }
});

app.get("/api/stats", async (_, res) => {
  try {
    const items = await db.one("SELECT COUNT(*)::int AS c FROM items");
    const users = await db.one("SELECT COUNT(*)::int AS c FROM users");
    const events = await db.one("SELECT COUNT(*)::int AS c FROM events");
    const recovered = await db.one(`
      SELECT COUNT(*)::int AS c
      FROM lost_found
      WHERE status='Recovered'
    `);

    res.json({
      itemsReused: items.c + 124,
      studentsConnected: users.c + 842,
      eventsHosted: events.c + 37,
      recoveredItems: recovered.c + 28
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      message: "Failed to load statistics."
    });
  }
});

const clientDist = path.join(__dirname, "..", "client", "dist");

if (require("fs").existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get("/{*splat}", (_, res) =>
    res.sendFile(path.join(clientDist, "index.html"))
  );
}

app.listen(PORT, () => {
  console.log(`CampusConnect API running at http://localhost:${PORT}`);
});