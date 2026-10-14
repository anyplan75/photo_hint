import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const forIos = process.env.CAPACITOR === '1';

export default defineConfig({
  base: forIos ? './' : '/photo_hint/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
