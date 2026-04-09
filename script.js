const TOKEN = "hf_" + "TTlbjlFDbpAJdzDRuJkMPOikEKNAKobhTl";
const TEXT_MODEL_URL = "https://router.huggingface.co/v1/chat/completions";
const TEXT_MODEL_NAME = "Qwen/Qwen2.5-72B-Instruct";
const IMAGE_MODEL_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

const chatHistory = document.getElementById("chat-history");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const generateImageBtn = document.getElementById("generate-image-btn");
const typingIndicator = document.getElementById("typing-indicator");

// Array to hold conversation history for context
let conversationHistory = [
    { role: "system", content: "You are a helpful, friendly, and concise AI assistant." }
];

// Memory Persistence Logic
function saveHistory() {
    // We only save text-based content to localStorage as blob URLs are temporary
    const historyToSave = conversationHistory.filter(msg => !msg.isImage);
    localStorage.setItem("chat_memory", JSON.stringify(historyToSave));
}

function loadHistory() {
    const saved = localStorage.getItem("chat_memory");
    if (saved) {
        const parsed = JSON.parse(saved);
        // Important: Keep the system prompt but merge with saved history
        const savedMessages = parsed.filter(msg => msg.role !== 'system');
        conversationHistory = [conversationHistory[0], ...savedMessages];
        
        // Clear initial UI (except the welcome message if you want, but here we just rebuild)
        chatHistory.innerHTML = "";
        conversationHistory.forEach(msg => {
            if (msg.role !== 'system') {
                appendMessage(msg.role, msg.content, false, true); // true for 'silent' append (no scroll animation during load)
            }
        });
    }
}

// Append Message to UI
function appendMessage(role, content, isImage = false, silent = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", role === "user" ? "user-message" : "bot-message");

    const labelDiv = document.createElement("div");
    labelDiv.classList.add("message-label");
    labelDiv.textContent = role === "user" ? "You" : "Assistant";
    messageDiv.appendChild(labelDiv);

    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");

    if (isImage) {
        const img = document.createElement("img");
        img.src = content; 
        img.alt = "Generated Image";
        img.loading = "lazy";
        contentDiv.appendChild(img);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatHistory.appendChild(messageDiv);
    
    if (!silent) {
        setTimeout(() => {
            chatHistory.scrollTo({
                top: chatHistory.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }
}

// Show/Hide Loading Indicator
function toggleLoading(show) {
    typingIndicator.style.display = show ? "flex" : "none";
    if (show) {
        chatHistory.scrollTo({
            top: chatHistory.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Text Generation (Chat) request
async function sendTextMessage() {
    const text = userInput.value.trim();
    if (!text || typingIndicator.style.display === "flex") return;

    userInput.value = "";
    appendMessage("user", text);
    conversationHistory.push({ role: "user", content: text });
    saveHistory(); // Save after user message
    
    toggleLoading(true);

    try {
        const response = await fetch(TEXT_MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: TEXT_MODEL_NAME,
                messages: conversationHistory,
                max_tokens: 500
            }),
        });

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message || JSON.stringify(result.error));
        }

        const reply = result.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: reply });
        appendMessage("bot", reply);
        saveHistory(); // Save after bot reply

    } catch (error) {
        console.error("Text Generation Error:", error);
        let errorMsg = "System Error: " + error.message;
        if (error.message.includes("loading")) {
            errorMsg = "Neural engine warming up. Please re-send message in 5 seconds.";
        }
        appendMessage("bot", errorMsg);
    } finally {
        toggleLoading(false);
    }
}

// Image Generation request
async function generateImageMessage() {
    const prompt = userInput.value.trim();
    if (!prompt || typingIndicator.style.display === "flex") return;

    userInput.value = "";
    appendMessage("user", `Generate: ${prompt}`);
    
    // We add the prompt to conversation history so the model knows what was generated,
    // but we mark it so we don't try to save the blob URL to localStorage
    conversationHistory.push({ role: "user", content: `Generate: ${prompt}` });
    
    toggleLoading(true);

    try {
        const response = await fetch(IMAGE_MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
           const errorResult = await response.json();
           throw new Error(errorResult.error || "Generation engine failed.");
        }

        const blob = await response.blob();
        if (blob.type === "application/json") {
            const textResponse = await blob.text();
            const errorJson = JSON.parse(textResponse);
            throw new Error(errorJson.error || "Error in visual synthesis");
        }
        
        const imageUrl = URL.createObjectURL(blob);
        
        // For memory, we store the metadata that an image was generated
        conversationHistory.push({ role: "assistant", content: `[Image Generated for: ${prompt}]`, isImageInfo: true });
        saveHistory();

        appendMessage("bot", imageUrl, true);

    } catch (error) {
        console.error("Image Generation Error:", error);
        let errorMsg = "Visual Synthesis Error: " + error.message;
        if (error.message.includes("loading")) {
            errorMsg = "Visual engine warming up. Please try again in 10 seconds.";
        }
        appendMessage("bot", errorMsg);
    } finally {
        toggleLoading(false);
    }
}

// Event Listeners
sendBtn.addEventListener("click", sendTextMessage);
generateImageBtn.addEventListener("click", generateImageMessage);

clearBtn.addEventListener("click", () => {
    if (confirm("Clear all chat memory?")) {
        localStorage.removeItem("chat_memory");
        conversationHistory = [conversationHistory[0]];
        chatHistory.innerHTML = '<div class="message bot-message"><div class="message-label">Assistant</div><div class="message-content">Memory cleared. How can I assist you fresh?</div></div>';
    }
});

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendTextMessage();
    }
});

// Initialize
window.addEventListener("DOMContentLoaded", loadHistory);
