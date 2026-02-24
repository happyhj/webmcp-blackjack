import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LangProvider } from './i18n/LangContext'
import { isGeminiAvailable } from './agents/gemini-flash'
import { initGA } from './analytics'
import App from './App'

// 앱 시작 시 Gemini API health check — 결과가 콘솔에 출력됨
isGeminiAvailable();

// GA4 초기화 (VITE_GA_ID 없으면 no-op)
initGA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
)
