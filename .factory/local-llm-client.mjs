import fs from 'node:fs';

const [adapter, promptPath, outputPath] = process.argv.slice(2);
if (!adapter || !promptPath || !outputPath) {
  console.error('Usage: node .factory/local-llm-client.mjs <ollama|generic-http> <prompt-file> <output-file>');
  process.exit(2);
}

const model = String(process.env.LOCAL_LLM_MODEL || '').trim();
if (!model) {
  console.error('LOCAL_LLM_MODEL is required.');
  process.exit(1);
}

const prompt = fs.readFileSync(promptPath, 'utf8');

async function callOllama() {
  const base = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const response = await fetch(base + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0 }
    })
  });
  if (!response.ok) {
    throw new Error('Ollama returned HTTP ' + response.status + ': ' + (await response.text()).slice(0, 1000));
  }
  const data = await response.json();
  const text = data?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Ollama returned no text.');
  return text;
}

async function callGenericHttp() {
  const url = String(process.env.LOCAL_LLM_HTTP_URL || '').trim();
  if (!url) throw new Error('LOCAL_LLM_HTTP_URL is required for generic-http.');
  const headers = { 'Content-Type': 'application/json' };
  const token = String(process.env.LOCAL_LLM_HTTP_TOKEN || '').trim();
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, prompt })
  });
  if (!response.ok) {
    throw new Error('Local HTTP agent returned HTTP ' + response.status + ': ' + (await response.text()).slice(0, 1000));
  }
  const data = await response.json();
  const text = data?.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Generic local HTTP adapter requires a JSON response shaped as {"text":"..."}');
  }
  return text;
}

let text;
try {
  if (adapter === 'ollama') text = await callOllama();
  else if (adapter === 'generic-http') text = await callGenericHttp();
  else throw new Error('Unsupported local LLM adapter: ' + adapter);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

fs.writeFileSync(outputPath, text.trim() + '\n');
