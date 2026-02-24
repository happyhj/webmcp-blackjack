import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeWebMCPPolyfill } from '@mcp-b/webmcp-polyfill'
import { LangProvider } from './i18n/LangContext'
import { isGeminiAvailable } from './agents/gemini-flash'
import { initGA } from './analytics'
import App from './App'

// Use native WebMCP API if available (Chrome 146+), otherwise polyfill
if (!navigator.modelContext) {
  initializeWebMCPPolyfill({ installTestingShim: 'if-missing' });
  console.log('[WebMCP] Using polyfill');
} else {
  console.log('[WebMCP] Native API detected:', navigator.modelContext.constructor.name);
}

// Gemini API health check on startup — result logged to console
isGeminiAvailable();

// GA4 init (no-op if VITE_GA_ID is not set)
initGA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
)
