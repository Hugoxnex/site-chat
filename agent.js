const socket = io();
let currentChatId = null;
let agentId = null;

// Verificar autenticação ao carregar
checkAuth();

// Elementos do DOM
const statusIndicator = document.getElementById('status-indicator');
const toggleStatusBtn = document.getElementById('toggle-status');
const queueCount = document.getElementById('queue-count');
const activeChatsArea = document.getElementById('active-chats');
const chatWindow = document.getElementById('chat-window');
const agentMessages = document.getElementById('agent-chat-messages');
const logoutBtn = document.getElementById('logout-btn');
const agentNameElement = document.getElementById('agent-name');

// Status do analista
let isAvailable = true;

// Verificar autenticação
async function checkAuth() {
    try {
        const response = await fetch('/analista.html', { credentials: 'include' });
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        // Obter informações do analista
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            agentId = payload.id;
            agentNameElement.textContent = payload.name;
            
            // Conectar ao Socket.io como analista
            socket.emit('agent_online', { agentId: payload.id });
        }
    } catch (err) {
        window.location.href = '/login.html';
    }
}

// Alternar status disponível/ocupado
toggleStatusBtn.addEventListener('click', () => {
    isAvailable = !isAvailable;
    
    if(isAvailable) {
        statusIndicator.textContent = 'Disponível';
        statusIndicator.className = 'status available';
        toggleStatusBtn.className = 'btn-status available';
        socket.emit('agent_status', { status: 'available' });
    } else {
        statusIndicator.textContent = 'Ocupado';
        statusIndicator.className = 'status busy';
        toggleStatusBtn.className = 'btn-status busy';
        socket.emit('agent_status', { status: 'busy' });
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/logout', { 
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login.html';
    } catch (err) {
        console.error('Erro ao fazer logout:', err);
    }
});

// Aceitar chat
function acceptChat(chatId) {
    currentChatId = chatId;
    chatWindow.classList.remove('hidden');
    document.querySelector('.no-chats').classList.add('hidden');
    
    // Carregar histórico de mensagens
    fetch(`/messages?chatId=${chatId}`)
        .then(response => response.json())
        .then(messages => {
            messages.forEach(msg => {
                addAgentMessage(msg.text, msg.sender === 'agent');
            });
        });
}

// Enviar mensagem como analista
document.getElementById('agent-send-button').addEventListener('click', sendAgentMessage);

function sendAgentMessage() {
    const messageInput = document.getElementById('agent-message-input');
    const message = messageInput.value.trim();
    
    if(message && currentChatId) {
        socket.emit('agent_message', {
            chatId: currentChatId,
            text: message
        });
        
        addAgentMessage(message, true);
        messageInput.value = '';
    }
}

function addAgentMessage(text, isAgent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isAgent ? 'message agent-message' : 'message user-message';
    messageDiv.innerHTML = `
        <p>${text}</p>
        <div class="timestamp">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    agentMessages.appendChild(messageDiv);
    agentMessages.scrollTop = agentMessages.scrollHeight;
}

// Ouvir por novos chats
socket.on('assign_chat', (data) => {
    if (isAvailable) {
        acceptChat(data.chatId);
    }
});

// Receber mensagens do usuário
socket.on('server_message', (data) => {
    if(data.chatId === currentChatId) {
        addAgentMessage(data.text, false);
    }
});
// Carregar histórico de chats
function loadChatHistory() {
    fetch('/chats')
        .then(response => response.json())
        .then(chats => {
            const historyContainer = document.getElementById('chat-history');
            historyContainer.innerHTML = '';

            chats.forEach(chat => {
                const chatElement = document.createElement('div');
                chatElement.className = 'history-chat';
                chatElement.innerHTML = `
                    <span>Chat ${chat.chat_id.slice(0, 6)}</span>
                    <small>${new Date(chat.last_activity).toLocaleString()}</small>
                `;
                chatElement.addEventListener('click', () => viewChatHistory(chat.chat_id));
                historyContainer.appendChild(chatElement);
            });
        });
}

// Visualizar chat histórico
function viewChatHistory(chatId) {
    currentChatId = chatId;
    chatWindow.classList.remove('hidden');
    document.querySelector('.no-chats').classList.add('hidden');
    agentMessages.innerHTML = '';

    fetch(`/messages?chatId=${chatId}`)
        .then(response => response.json())
        .then(messages => {
            messages.forEach(msg => {
                addAgentMessage(msg.text, msg.sender === 'agent');
            });
        });
}

// Chame esta função quando o analista logar
loadChatHistory();
const socket = io();
let currentChatId = null;

// Conexão do analista
socket.emit('agent_connected', 'ID_DO_ANALISTA'); // Substitua pelo ID real

// Recebe novas mensagens
socket.on('new_message', (data) => {
  console.log('Nova mensagem recebida:', data);
  
  // Verifica se é do chat atual
  if (!currentChatId || data.chatId === currentChatId) {
    addMessageToChat(data.text, data.sender);
  }
});

// Atribuição de novo chat
socket.on('chat_assigned', (data) => {
  console.log('Novo chat atribuído:', data.chatId);
  currentChatId = data.chatId;
  loadChatHistory(data.chatId);
});

// Função para adicionar mensagem ao chat
function addMessageToChat(text, sender) {
  const chatMessages = document.getElementById('chat-messages');
  const messageElement = document.createElement('div');
  
  messageElement.className = `message ${sender}-message`;
  messageElement.innerHTML = `
    <p>${text}</p>
    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
  `;
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Função para carregar histórico do chat
function loadChatHistory(chatId) {
  fetch(`/api/messages?chatId=${chatId}`)
    .then(response => response.json())
    .then(messages => {
      const chatMessages = document.getElementById('chat-messages');
      chatMessages.innerHTML = '';
      
      messages.forEach(msg => {
        addMessageToChat(msg.text, msg.sender);
      });
    });
}

// Enviar mensagem como analista
document.getElementById('send-button').addEventListener('click', () => {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (message && currentChatId) {
    socket.emit('agent_message', {
      chatId: currentChatId,
      text: message
    });
    
    addMessageToChat(message, 'agent');
    input.value = '';
  }
});