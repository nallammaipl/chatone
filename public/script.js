const socket = io();

// DOM Elements
const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const currentUserSpan = document.getElementById("current-user");
const messagesContainer = document.getElementById("messages");
const sendForm = document.getElementById("send-form");
const messageInput = document.getElementById("message-input");
const logoutBtn = document.getElementById("logout-btn");

let currentUsername = "";

// Handle login
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    currentUsername = usernameInput.value.trim();
    if (currentUsername) {
        socket.emit("new-user", currentUsername);
        currentUserSpan.textContent = currentUsername;
        loginScreen.classList.add("hidden");
        chatScreen.classList.remove("hidden");
        messageInput.focus();
    }
});

// Handle logout
logoutBtn.addEventListener("click", () => {
    socket.disconnect();
    location.reload();
});

// Handle message submission
sendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (msg) {
        socket.emit("send-chat-message", msg);
        messageInput.value = "";
        messageInput.focus();
    }
});

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

// Add message to UI
function addMessage(data) {
    const messageEl = document.createElement("div");
    messageEl.className = "message";

    if (data.isSystem) {
        messageEl.classList.add("system");
        messageEl.innerHTML = `
            <div class="message-content">${data.message}</div>
        `;
    } else {
        // Determine if message is from current user
        if (data.username === currentUsername) {
            messageEl.classList.add("own");
        } else {
            messageEl.classList.add("other");
        }

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-username">${data.username}</span>
                <span class="message-time">${formatTime(data.timestamp)}</span>
            </div>
            <div class="message-content">${escapeHtml(data.message)}</div>
        `;
    }

    messagesContainer.appendChild(messageEl);
    // Auto scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Load previous messages
socket.on("load-messages", (messages) => {
    messages.forEach((msg) => {
        addMessage({
            id: msg.id,
            username: msg.username,
            message: msg.message,
            timestamp: msg.timestamp,
            isSystem: false
        });
    });
});

// Receive chat messages
socket.on("chat-message", (data) => {
    addMessage(data);
});

// Handle disconnect
socket.on("disconnect", () => {
    console.log("Disconnected from server");
});
