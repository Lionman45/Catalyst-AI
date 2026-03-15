const USER = "user";
const ASSISTANT = "assistant";

let chatHistory = [];
let aiConversationMode = false;
const aiModels = ["openrouter/auto","meta-llama/llama-3-8b-instruct","mistralai/mistral-7b-instruct"];
const aiMessageLimit = 7;

// DOM elements
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const modelSelector = document.getElementById("modelSelector");
const themeSelector = document.getElementById("themeSelector");

// Checkbox to enable AI conversation mode
const aiModeToggle = document.createElement("label");
aiModeToggle.innerHTML = `
<input type="checkbox" id="aiModeToggleCheckbox"> AI Conversation Mode
`;
document.querySelector(".selectors").appendChild(aiModeToggle);
const aiModeCheckbox = document.getElementById("aiModeToggleCheckbox");
aiModeCheckbox.addEventListener("change",()=>aiConversationMode=aiModeCheckbox.checked);

// Request AI response
async function requestAssistantResponse(messages, model){
    const response = await fetch("https://catalyst-backend-kgch.onrender.com/ask",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ messages, model })
    });
    const data = await response.json();
    return data.message;
}

// Add a message to the chat
function addMessage(text,role){
    const div = document.createElement("div");
    div.className = `message ${role==="user"?"user":"ai"}`;

    if(role==="ai"){
        div.innerHTML = marked.parse(text);
        // Make code blocks copyable
        div.querySelectorAll("pre, code").forEach(block=>{
            block.style.cursor="pointer";
            block.addEventListener("click",()=>{
                navigator.clipboard.writeText(block.innerText);
            });
        });
    } else {
        div.textContent = text;
    }

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Send a single message
async function sendMessage(){
    const text = input.value.trim();
    if(!text) return;
    input.value="";
    addMessage(text,"user");
    chatHistory.push({role:USER,content:text});

    const typing = document.createElement("div");
    typing.className="message ai";
    typing.textContent="Typing...";
    messagesDiv.appendChild(typing);

    try{
        if(!aiConversationMode){
            const aiMsg = await requestAssistantResponse(chatHistory, modelSelector.value);
            typing.remove();
            addMessage(aiMsg,"ai");
            chatHistory.push({role:ASSISTANT,content:aiMsg});
        } else {
            // AI conversation mode: loop through aiModels
            typing.textContent="AI conversation starting...";
            await new Promise(r=>setTimeout(r,500));
            typing.remove();
            await runAiConversation();
        }
    } catch(err){
        typing.remove();
        addMessage("Error contacting AI.","ai");
        console.error(err);
    }
}

// AI conversation loop
async function runAiConversation(){
    // Track messages per AI
    const aiCounts = {};
    aiModels.forEach(m=>aiCounts[m]=0);

    let currentIndex = 0;
    while(Math.max(...Object.values(aiCounts)) < aiMessageLimit){
        const currentAI = aiModels[currentIndex];
        const context = chatHistory.slice(-12);
        const aiMsg = await requestAssistantResponse(context, currentAI);
        addMessage(`(${currentAI.split("/")[0]}) ${aiMsg}`, "ai");
        chatHistory.push({role:ASSISTANT, content: aiMsg});
        aiCounts[currentAI]++;

        // Cycle to next AI
        currentIndex = (currentIndex + 1) % aiModels.length;

        // Small delay between AI messages
        await new Promise(r=>setTimeout(r,600));
    }
}

// Event listeners
sendBtn.onclick = sendMessage;
input.addEventListener("keydown", e => {
    if(e.key==="Enter" && !e.shiftKey) sendMessage();
});

// Theme switching
themeSelector.addEventListener("change",()=>{
    document.body.className = "theme-" + themeSelector.value;
});
