import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Frontend will live here
    proxy: {
      '/api': 'http://localhost:5000' // Requests go to backend here
    }
  }
});