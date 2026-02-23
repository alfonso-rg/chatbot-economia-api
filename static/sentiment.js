const analyzeTextButton = document.getElementById('analyze-text');
const textInput = document.getElementById('sentiment-text');
const textResult = document.getElementById('text-result');

const analyzeCsvButton = document.getElementById('analyze-csv');
const csvInput = document.getElementById('csv-file');
const csvResult = document.getElementById('csv-result');

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

analyzeTextButton.addEventListener('click', async () => {
  const text = textInput.value.trim();
  if (!text) {
    textResult.textContent = 'Introduce un texto para analizar.';
    return;
  }

  textResult.textContent = 'Analizando...';

  const res = await fetch('/api/sentiment/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    textResult.textContent = data.error || 'No se pudo analizar el texto.';
    return;
  }

  textResult.innerHTML = `
    <strong>Sentimiento:</strong> ${data.sentimiento}<br>
    <strong>Confianza:</strong> ${data.confianza}%<br>
    <strong>Explicación:</strong> ${data.explicacion}
  `;
});

analyzeCsvButton.addEventListener('click', async () => {
  if (!csvInput.files.length) {
    csvResult.textContent = 'Selecciona un archivo CSV.';
    return;
  }

  const formData = new FormData();
  formData.append('file', csvInput.files[0]);

  csvResult.textContent = 'Procesando CSV...';

  const res = await fetch('/api/sentiment/csv', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await parseJsonSafe(res);
    csvResult.textContent = err.error || 'No se pudo procesar el archivo.';
    return;
  }

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = 'analisis_sentimientos.csv';
  link.click();

  csvResult.textContent = 'Análisis completado. Se descargó el CSV con resultados.';
});
