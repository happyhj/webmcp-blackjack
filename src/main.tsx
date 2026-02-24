import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LangProvider } from './i18n/LangContext'
import { isGeminiAvailable } from './agents/gemini-flash'
import { initGA } from './analytics'
import App from './App'

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
