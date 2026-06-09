const USER = "user";
const ASSISTANT = "assistant";

let chatHistory = [];
let aiConversationMode = false;

const aiModels = [
    "openrouter/auto",
    "meta-llama/llama-3-8b-instruct",
    "mistralai/mistral-7b-instruct"
];

const aiMessageLimit = 7;
const CHAT_EXPIRY_DAYS = 7;

// DOM elements
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const modelSelector = document.getElementById("modelSelector");
const themeSelector = document.getElementById("themeSelector");

// ======================
// LOCAL STORAGE SYSTEM
// ======================

function getStorageKey(model){
    return `chat_history_${model.replace(/[\/:]/g, "_")}`;
}

function saveCurrentChat(){
    try{
        const data = {
            lastUsed: Date.now(),
            messages: chatHistory
        };

        localStorage.setItem(
            getStorageKey(modelSelector.value),
            JSON.stringify(data)
        );
    }catch(err){
        console.warn("Failed to save chat:", err);
    }
}

function clearMessagesUI(){
    messagesDiv.innerHTML = "";
}

function loadChat(model){
    clearMessagesUI();

    const raw = localStorage.getItem(
        getStorageKey(model)
    );

    if(!raw){
        chatHistory = [];
        return;
    }

    try{
        const data = JSON.parse(raw);

        const maxAge =
            CHAT_EXPIRY_DAYS *
            24 *
            60 *
            60 *
            1000;

        if(
            !data.lastUsed ||
            Date.now() - data.lastUsed > maxAge
        ){
            localStorage.removeItem(
                getStorageKey(model)
            );

            chatHistory = [];
            return;
        }

        chatHistory = data.messages || [];

        chatHistory.forEach(msg=>{
            addMessage(
                msg.content,
                msg.role === USER ? "user" : "ai",
                false
            );
        });

    }catch(err){
        console.error(err);

        localStorage.removeItem(
            getStorageKey(model)
        );

        chatHistory = [];
    }
}

function cleanupOldChats(){
    const maxAge =
        CHAT_EXPIRY_DAYS *
        24 *
        60 *
        60 *
        1000;

    Object.keys(localStorage).forEach(key=>{

        if(!key.startsWith("chat_history_"))
            return;

        try{
            const data = JSON.parse(
                localStorage.getItem(key)
            );

            if(
                !data.lastUsed ||
                Date.now() - data.lastUsed > maxAge
            ){
                localStorage.removeItem(key);
            }

        }catch{
            localStorage.removeItem(key);
        }
    });
}

// ======================
// AI MODE TOGGLE
// ======================

const aiModeToggle = document.createElement("label");

aiModeToggle.innerHTML = `
<input type="checkbox" id="aiModeToggleCheckbox">
AI Conversation Mode
`;

document
    .querySelector(".selectors")
    .appendChild(aiModeToggle);

const aiModeCheckbox =
    document.getElementById(
        "aiModeToggleCheckbox"
    );

aiModeCheckbox.addEventListener(
    "change",
    ()=> aiConversationMode =
        aiModeCheckbox.checked
);

// ======================
// API REQUEST
// ======================

async function requestAssistantResponse(
    messages,
    model
){
    const response = await fetch(
        "https://catalyst-backend-kgch.onrender.com/ask",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                messages,
                model
            })
        }
    );

    const data = await response.json();

    return data.message;
}

// ======================
// MESSAGE DISPLAY
// ======================

function addMessage(
    text,
    role,
    save=true
){
    const div =
        document.createElement("div");

    div.className =
        `message ${
            role === "user"
            ? "user"
            : "ai"
        }`;

    if(role === "ai"){

        div.innerHTML =
            marked.parse(text);

        div
        .querySelectorAll(
            "pre, code"
        )
        .forEach(block=>{

            block.style.cursor =
                "pointer";

            block.addEventListener(
                "click",
                ()=>{
                    navigator.clipboard
                    .writeText(
                        block.innerText
                    );
                }
            );
        });

    }else{

        div.textContent = text;

    }

    messagesDiv.appendChild(div);

    messagesDiv.scrollTop =
        messagesDiv.scrollHeight;

    if(save){
        saveCurrentChat();
    }
}

// ======================
// SEND MESSAGE
// ======================

async function sendMessage(){

    const text =
        input.value.trim();

    if(!text) return;

    input.value = "";

    addMessage(text,"user");

    chatHistory.push({
        role: USER,
        content: text
    });

    saveCurrentChat();

    const typing =
        document.createElement("div");

    typing.className =
        "message ai";

    typing.textContent =
        "Typing...";

    messagesDiv.appendChild(
        typing
    );

    messagesDiv.scrollTop =
        messagesDiv.scrollHeight;

    try{

        if(!aiConversationMode){

            const aiMsg =
                await requestAssistantResponse(
                    chatHistory,
                    modelSelector.value
                );

            typing.remove();

            addMessage(
                aiMsg,
                "ai"
            );

            chatHistory.push({
                role: ASSISTANT,
                content: aiMsg
            });

            saveCurrentChat();

        }else{

            typing.textContent =
                "AI conversation starting...";

            await new Promise(
                r=>setTimeout(r,500)
            );

            typing.remove();

            await runAiConversation();

        }

    }catch(err){

        typing.remove();

        addMessage(
            "Error contacting AI.",
            "ai"
        );

        console.error(err);

    }
}

// ======================
// AI CONVERSATION MODE
// ======================

async function runAiConversation(){

    const aiCounts = {};

    aiModels.forEach(
        m => aiCounts[m] = 0
    );

    let currentIndex = 0;

    while(
        Math.max(
            ...Object.values(
                aiCounts
            )
        ) < aiMessageLimit
    ){

        const currentAI =
            aiModels[currentIndex];

        const context =
            chatHistory.slice(-12);

        try{

            const aiMsg =
                await requestAssistantResponse(
                    context,
                    currentAI
                );

            addMessage(
                `(${currentAI.split("/")[0]}) ${aiMsg}`,
                "ai"
            );

            chatHistory.push({
                role: ASSISTANT,
                content: aiMsg
            });

            saveCurrentChat();

            aiCounts[currentAI]++;

        }catch(err){

            console.error(
                currentAI,
                err
            );

        }

        currentIndex =
            (currentIndex + 1)
            % aiModels.length;

        await new Promise(
            r=>setTimeout(r,600)
        );
    }
}

// ======================
// MODEL SWITCHING
// ======================

modelSelector.addEventListener(
    "change",
    ()=>{

        saveCurrentChat();

        loadChat(
            modelSelector.value
        );

    }
);

// ======================
// NEW CHAT BUTTON
// ======================

const newChatButton =
    document.getElementById(
        "newChat"
    );

if(newChatButton){

    newChatButton.addEventListener(
        "click",
        ()=>{

            chatHistory = [];

            localStorage.removeItem(
                getStorageKey(
                    modelSelector.value
                )
            );

            clearMessagesUI();

        }
    );
}

// ======================
// EVENTS
// ======================

sendBtn.onclick = sendMessage;

input.addEventListener(
    "keydown",
    e=>{

        if(
            e.key === "Enter" &&
            !e.shiftKey
        ){
            e.preventDefault();
            sendMessage();
        }

    }
);

// ======================
// THEMES
// ======================

themeSelector.addEventListener(
    "change",
    ()=>{

        document.body.className =
            "theme-" +
            themeSelector.value;

    }
);

// ======================
// STARTUP
// ======================

cleanupOldChats();

loadChat(
    modelSelector.value
);

// Update activity timestamp
window.addEventListener(
    "beforeunload",
    saveCurrentChat
);
