import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/' is needed for clean URLs (/tasks, /learning/tech/123). public/_redirects sends every URL to index.html on Netlify.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'] } }
    }
  },
  server: { port: 5173, open: true }
});
