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

async function parseJsonSafe(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return { error: `Respuesta inesperada del servidor (${response.status}). ${text.slice(0, 120)}` };
  }

  try {
    return await response.json();
  } catch (_) {
    return { error: 'La respuesta del servidor no es JSON válido.' };
  }
}

async function fetchHistory() {
  const res = await fetch('/api/chat/history');
  const data = await parseJsonSafe(res);

  if (!res.ok) {
    chatWindow.innerHTML = `<div class="result">${data.error || 'No se pudo cargar el historial.'}</div>`;
    return;
  }

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

  const data = await parseJsonSafe(res);
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
