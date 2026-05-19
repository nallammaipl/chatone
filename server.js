require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// ===============================
// MongoDB Configuration
// ===============================

const dbUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "chatone";

let messagesCollection;

async function initializeDatabase() {
    try {
        const client = new MongoClient(dbUri);

        await client.connect();

        console.log("Connected to MongoDB");

        const db = client.db(dbName);

        messagesCollection = db.collection("messages");

        await messagesCollection.createIndex({ timestamp: 1 });

        console.log("Messages collection initialized");

    } catch (err) {
        console.error("MongoDB Connection Error:");
        console.error(err.stack);

        process.exit(1);
    }
}

// ===============================
// Save Message
// ===============================

async function saveMessage(username, message) {
    try {
        const doc = {
            username,
            message,
            timestamp: new Date()
        };

        const result = await messagesCollection.insertOne(doc);

        return {
            id: result.insertedId.toString(),
            username,
            message,
            timestamp: doc.timestamp.toISOString()
        };

    } catch (err) {
        console.error("Error saving message:", err);

        return null;
    }
}

// ===============================
// Load Previous Messages
// ===============================

async function getMessages(limit = 50) {
    try {
        const rows = await messagesCollection
            .find({}, {
                projection: {
                    username: 1,
                    message: 1,
                    timestamp: 1
                }
            })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        return rows.reverse().map((row) => ({
            id: row._id.toString(),
            username: row.username,
            message: row.message,
            timestamp: row.timestamp.toISOString()
        }));

    } catch (err) {
        console.error("Error retrieving messages:", err);

        return [];
    }
}

// ===============================
// Middleware
// ===============================

app.use(express.static(path.join(__dirname, "public")));

// Root Route
app.get("/", (req, res) => {
    res.send("Chat server running successfully 🚀");
});

// ===============================
// Socket.IO
// ===============================

io.on("connection", (socket) => {

    console.log("User connected");

    // New User
    socket.on("new-user", async (username) => {

        socket.username = username;

        // Send old messages
        const messages = await getMessages(50);

        socket.emit("load-messages", messages);

        // Notify others
        socket.broadcast.emit("chat-message", {
            username: "System",
            message: `${username} joined the chat`,
            timestamp: new Date().toISOString(),
            isSystem: true
        });
    });

    // Chat Message
    socket.on("send-chat-message", async (msg) => {

        if (socket.username && msg.trim()) {

            const savedMessage = await saveMessage(
                socket.username,
                msg
            );

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

    // Disconnect
    socket.on("disconnect", () => {

        if (socket.username) {

            io.emit("chat-message", {
                username: "System",
                message: `${socket.username} left the chat`,
                timestamp: new Date().toISOString(),
                isSystem: true
            });
        }

        console.log("User disconnected");
    });
});

// ===============================
// Start Server
// ===============================

const PORT = process.env.PORT || 3000;

initializeDatabase()
    .then(() => {

        server.listen(PORT, () => {

            console.log(`Server running on port ${PORT}`);
        });

    })
    .catch((err) => {

        console.error("Failed to initialize database:");
        console.error(err.stack);

        process.exit(1);
    });