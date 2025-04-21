const socket = io();
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const statusIndicator = document.getElementById('connection-status');

// Status da conexão
socket.on('connect', () => {
    statusIndicator.textContent = 'Online';
    document.querySelector('.status-dot').style.backgroundColor = '#4ade80';
});

socket.on('disconnect', () => {
    statusIndicator.textContent = 'Offline';
    document.querySelector('.status-dot').style.backgroundColor = '#e74c3c';
});

// Enviar mensagem
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('client_message', {
            text: message
        });
        
        // Adiciona a mensagem localmente
        addMessage(message, 'user');
        messageInput.value = '';
    }
}

// Adicionar mensagem ao chat
function addMessage(text, sender) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-container', `${sender}-message-container`);

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`, 'message-sent');
    
    messageElement.innerHTML = `
        <p>${text}</p>
        <div class="timestamp">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    
    messageContainer.appendChild(messageElement);
    chatMessages.appendChild(messageContainer);
    
    // Rolagem automática
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Receber mensagens do analista
socket.on('server_message', (data) => {
    addMessage(data.text, 'agent');
});

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
const socket = io();

// Enviar mensagem
document.getElementById('send-button').addEventListener('click', () => {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (message) {
    socket.emit('client_message', {
      text: message
    });
    
    addMessage(message, 'user');
    input.value = '';
  }
});

// Receber mensagens do analista
socket.on('new_message', (data) => {
  addMessage(data.text, 'agent');
});

function addMessage(text, sender) {
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