import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

// Parse GEMINI_API_KEY directly from .env.local
function loadApiKey(): string {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  }
  return process.env.GEMINI_API_KEY || '';
}

const apiKey = loadApiKey();

if (apiKey) {
  console.log(`[vite] Gemini API key loaded ✅ (${apiKey.slice(0, 8)}...)`);
} else {
  console.warn('[vite] ⚠️  No GEMINI_API_KEY found — fallback mode');
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/gemini': {
        target: `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`,
        changeOrigin: true,
        rewrite: () => '',
      },
    },
  },
});
