const socket = io();

const messages = document.getElementById("messages");
const form = document.getElementById("send-form");
const input = document.getElementById("message-input");

const username = prompt("Enter your name:");
socket.emit("new-user", username);

socket.on("chat-message", (data) => {
    const msgEl = document.createElement("div");
    msgEl.innerText = data;
    messages.appendChild(msgEl);
    messages.scrollTop = messages.scrollHeight;
});

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value;
    if (msg.trim()) {
        socket.emit("send-chat-message", msg);
        input.value = "";
    }
});
