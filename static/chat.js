const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const resetChatButton = document.getElementById('reset-chat');

function renderMessages(history) {
  chatWindow.innerHTML = '';

  if (!history.length) {
    const welcome = document.createElement('div');
    welcome.className = 'result';
    welcome.textContent = 'Inicia la conversación con una pregunta sobre economía española.';
    chatWindow.appendChild(welcome);
    return;
  }

  history.forEach((msg) => {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role === 'user' ? 'user' : 'assistant'}`;
    bubble.textContent = msg.content;
    chatWindow.appendChild(bubble);
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function fetchHistory() {
  const res = await fetch('/api/chat/history');
  const data = await res.json();
  renderMessages(data.history || []);
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  chatInput.value = '';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Error al enviar el mensaje.');
    return;
  }

  renderMessages(data.history || []);
});

resetChatButton.addEventListener('click', async () => {
  await fetch('/api/chat/reset', { method: 'POST' });
  renderMessages([]);
});

fetchHistory();
