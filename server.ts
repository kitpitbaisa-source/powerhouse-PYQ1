import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(process.cwd(), "users_db.json");

interface User {
  email: string;
  status: "subscribed" | "not_subscribed" | "admin";
}

// Initial default users
const defaultUsers: Record<string, User> = {
  "admin@example.com": { email: "admin@example.com", status: "subscribed" },
  "user@example.com": { email: "user@example.com", status: "not_subscribed" },
  "kitpitbaisa@gmail.com": { email: "kitpitbaisa@gmail.com", status: "subscribed" },
};

// Load users from file or use defaults
function loadUsers(): Record<string, User> {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
  return { ...defaultUsers };
}

function saveUsers(users: Record<string, User>) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error("Error saving users:", error);
  }
}

let users = loadUsers();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to check subscription
  app.get("/api/user-status", (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const userEmail = email.toLowerCase().trim();
    const user = users[userEmail];
    
    if (user) {
      res.json({ email: user.email, status: user.status });
    } else {
      res.json({ email: userEmail, status: "not_subscribed" });
    }
  });

  // API to update status
  app.post("/api/admin/update-status", (req, res) => {
    const { email, status } = req.body;
    if (!email || !status) {
      return res.status(400).json({ error: "Email and status are required" });
    }
    
    const userEmail = email.toLowerCase().trim();
    users[userEmail] = { email: userEmail, status };
    saveUsers(users);
    
    res.json({ message: "Success", user: users[userEmail] });
  });

  // API to delete user
  app.delete("/api/admin/users/:email", (req, res) => {
    const email = req.params.email.toLowerCase().trim();
    if (users[email]) {
      delete users[email];
      saveUsers(users);
      res.json({ message: "User deleted" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // API to get all users
  app.get("/api/admin/users", (req, res) => {
    res.json(Object.values(users));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
