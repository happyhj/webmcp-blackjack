/**
 * GA4 analytics helper — cookieless mode (no consent banner needed).
 *
 * Events tracked:
 *   game_start        — first round started
 *   round_complete    — { round_number }
 *   lang_change       — { agent, lang }
 *   help_open         — help panel opened
 *   thinking_skip     — user pressed SPACE to skip thinking
 */

// Measurement ID — replace with your own GA4 property
const GA_ID = import.meta.env.VITE_GA_ID || '';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initGA() {
  if (!GA_ID || initialized) return;
  initialized = true;

  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());

  // Cookieless config — no cookies, no user-id storage
  window.gtag('config', GA_ID, {
    storage: 'none',
    client_storage: 'none',
    anonymize_ip: true,
    send_page_view: true,
  });
}

function track(event: string, params?: Record<string, string | number>) {
  if (!initialized || !window.gtag) return;
  window.gtag('event', event, params);
}

// ─── Specific events ───

export function trackGameStart() {
  track('game_start');
}

export function trackRoundComplete(roundNumber: number) {
  track('round_complete', { round_number: roundNumber });
}

export function trackLangChange(agent: 'alex' | 'dealer', lang: string) {
  track('lang_change', { agent, lang });
}

export function trackHelpOpen() {
  track('help_open');
}

export function trackThinkingSkip() {
  track('thinking_skip');
}
