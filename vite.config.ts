import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Use an empty object fallback for process.env to prevent crashes in libraries that check for it
      // but do NOT leak the entire system environment
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
      target: 'esnext' // Critical for libraries using Top-Level Await
    },
    server: {
      port: 3000
    }
  };
});