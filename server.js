require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const Database = require("better-sqlite3");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize SQLite database
const dbPath = process.env.DB_FILE || "messages.db";
const db = new Database(path.join(__dirname, dbPath));

console.log("Connected to SQLite database");
initializeDatabase();

// Initialize database schema
function initializeDatabase() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Messages table initialized");
    } catch (err) {
        console.error("Error creating table:", err);
    }
}

// Save message to database
function saveMessage(username, message) {
    try {
        const stmt = db.prepare(
            `INSERT INTO messages (username, message, timestamp) VALUES (?, ?, datetime('now'))`
        );
        const result = stmt.run(username, message);
        return {
            id: result.lastInsertRowid,
            username,
            message,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error("Error saving message:", err);
        return null;
    }
}

// Retrieve previous messages
function getMessages(limit = 50) {
    try {
        const stmt = db.prepare(
            `SELECT id, username, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?`
        );
        const rows = stmt.all(limit);
        return rows.reverse();
    } catch (err) {
        console.error("Error retrieving messages:", err);
        return [];
    }
}

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("new-user", (username) => {
        socket.username = username;
        
        // Send previous messages to the new user
        const messages = getMessages(50);
        socket.emit("load-messages", messages);
        
        // Notify others
        socket.broadcast.emit("chat-message", {
            username: "System",
            message: `${username} joined the chat`,
            timestamp: new Date().toISOString(),
            isSystem: true
        });
    });

    socket.on("send-chat-message", (msg) => {
        if (socket.username && msg.trim()) {
            // Save to database and emit to all users
            const savedMessage = saveMessage(socket.username, msg);
            if (savedMessage) {
                io.emit("chat-message", {
                    id: savedMessage.id,
                    username: socket.username,
                    message: msg,
                    timestamp: savedMessage.timestamp,
                    isSystem: false
                });
            }
        }
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            io.emit("chat-message", {
                username: "System",
                message: `${socket.username} left the chat`,
                timestamp: new Date().toISOString(),
                isSystem: true
            });
        }
    });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
