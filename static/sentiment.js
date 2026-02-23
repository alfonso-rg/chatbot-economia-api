const analyzeTextButton = document.getElementById('analyze-text');
const textInput = document.getElementById('sentiment-text');
const textResult = document.getElementById('text-result');

const analyzeCsvButton = document.getElementById('analyze-csv');
const csvInput = document.getElementById('csv-file');
const csvResult = document.getElementById('csv-result');

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

  const data = await res.json();
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
    let message = 'No se pudo procesar el archivo.';
    try {
      const err = await res.json();
      message = err.error || message;
    } catch (_) {
      // Ignorado
    }
    csvResult.textContent = message;
    return;
  }

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = 'analisis_sentimientos.csv';
  link.click();

  csvResult.textContent = 'Análisis completado. Se descargó el CSV con resultados.';
});
