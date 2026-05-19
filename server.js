require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const dbUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "chatone";
let messagesCollection;

async function initializeDatabase() {
    try {
        const client = new MongoClient(dbUri);
        await client.connect();
        const db = client.db(dbName);
        messagesCollection = db.collection("messages");
        await messagesCollection.createIndex({ timestamp: 1 });
        console.log("Connected to MongoDB database");
        console.log("Messages collection initialized");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    }
}

// Save message to database
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

// Retrieve previous messages
async function getMessages(limit = 50) {
    try {
        const rows = await messagesCollection
            .find({}, { projection: { username: 1, message: 1, timestamp: 1 } })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        return rows
            .reverse()
            .map((row) => ({
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

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("new-user", async (username) => {
        socket.username = username;

        // Send previous messages to the new user
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

    socket.on("send-chat-message", async (msg) => {
        if (socket.username && msg.trim()) {
            // Save to database and emit to all users
            const savedMessage = await saveMessage(socket.username, msg);
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

initializeDatabase().then(() => {
    server.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}).catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});
