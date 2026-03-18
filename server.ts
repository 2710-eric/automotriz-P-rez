
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { User } from "./types";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Server state (Presence only, data is in Firestore)
  let activeUsers: User[] = [];

  // WebSocket logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Send initial presence state to the new client
    socket.emit("user:list", activeUsers);

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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
