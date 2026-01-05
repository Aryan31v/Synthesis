import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Service Worker Logic
if ('serviceWorker' in navigator) {
  // In development, unregister service workers to prevent caching issues
  // Fix: Safely access import.meta.env
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
    // Production registration
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

const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e) {
    console.error("Application Crash:", e);
    rootElement.innerHTML = `<div style="color:white; padding: 20px;">
      <h1>Application Failed to Start</h1>
      <pre>${e instanceof Error ? e.message : String(e)}</pre>
      <p>Check console for more details.</p>
    </div>`;
  }
}