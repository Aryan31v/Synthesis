import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevent libraries from crashing when accessing process.env.NODE_ENV or similar
      'process.env': JSON.stringify(process.env) 
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