
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { Product, User, UsageLog } from "./types";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading data:", e);
  }
  return { products: [], usageLogs: [] };
}

function saveData(products: Product[], usageLogs: UsageLog[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ products, usageLogs }, null, 2));
  } catch (e) {
    console.error("Error saving data:", e);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Server state (Source of Truth)
  const initialData = loadData();
  let products: Product[] = initialData.products;
  let activeUsers: User[] = [];
  let usageLogs: UsageLog[] = initialData.usageLogs;

  // WebSocket logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Send initial state to the new client
    socket.emit("init", { products, activeUsers, usageLogs });

    // Handle user login/presence
    socket.on("user:join", (user: User) => {
      // Add user to active list if not already there
      if (!activeUsers.find(u => u.id === user.id)) {
        activeUsers.push(user);
        io.emit("user:list", activeUsers);
      }
      // Store user info on socket for cleanup
      (socket as any).userId = user.id;
    });

    // Handle inventory updates
    socket.on("inventory:update", (updatedProducts: Product[]) => {
      products = updatedProducts;
      saveData(products, usageLogs);
      socket.broadcast.emit("inventory:sync", products);
    });

    // Handle usage logs
    socket.on("log:add", (log: UsageLog) => {
      usageLogs = [log, ...usageLogs].slice(0, 100); // Keep last 100
      saveData(products, usageLogs);
      io.emit("log:sync", usageLogs);
    });

    socket.on("system:reset", () => {
      products = [];
      usageLogs = [];
      saveData(products, usageLogs);
      io.emit("inventory:sync", products);
      io.emit("log:sync", usageLogs);
    });

    socket.on("disconnect", () => {
      const userId = (socket as any).userId;
      if (userId) {
        activeUsers = activeUsers.filter(u => u.id !== userId);
        io.emit("user:list", activeUsers);
      }
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
