import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// --- Global Error Handlers (Catch errors outside React) ---
const showErrorOverlay = (title: string, error: any) => {
  const root = document.getElementById('root') || document.body;
  
  // Prevent multiple overlays
  if (document.getElementById('global-error-overlay')) return;

  const errorContent = `
    <div id="global-error-overlay" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-color: #0f172a;
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
      padding: 2rem;
      text-align: center;
      z-index: 9999;
    ">
      <div style="
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.5);
        padding: 2rem;
        border-radius: 1.5rem;
        max-width: 40rem;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
      ">
        <h1 style="font-size: 1.875rem; font-weight: bold; margin-bottom: 1rem; color: #fca5a5;">${title}</h1>
        <p style="margin-bottom: 1.5rem; color: #cbd5e1;">A critical error stopped the app from loading.</p>
        <pre style="
          background: rgba(0, 0, 0, 0.5);
          padding: 1rem;
          border-radius: 0.75rem;
          text-align: left;
          overflow: auto;
          max-height: 300px;
          font-family: monospace;
          font-size: 0.875rem;
          color: #fca5a5;
          margin-bottom: 1.5rem;
          white-space: pre-wrap;
          word-break: break-all;
        ">${error instanceof Error ? (error.stack || error.message) : String(error)}</pre>
        <button onclick="window.location.reload()" style="
          background-color: #4f46e5;
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          border: none;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
          box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
          transition: background-color 0.2s;
        ">Reload Page</button>
      </div>
    </div>
  `;
  
  // Use innerHTML on body to wipe mostly blank screen
  document.body.innerHTML = errorContent;
};

// Catch syntax errors, import errors, etc.
window.addEventListener('error', (event) => {
  showErrorOverlay('Runtime Error', event.error || event.message);
});

// Catch async errors (like dynamic imports failing)
window.addEventListener('unhandledrejection', (event) => {
  showErrorOverlay('Unhandled Promise Rejection', event.reason);
});

// --- Service Worker Logic ---
if ('serviceWorker' in navigator) {
  const meta = import.meta as any;
  const isDev = meta.env && meta.env.DEV;

  if (isDev) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
        console.log("Dev Mode: Service Worker unregistered to clear cache.");
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// --- React Mount ---
const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e) {
    showErrorOverlay('Failed to Mount React', e);
  }
}