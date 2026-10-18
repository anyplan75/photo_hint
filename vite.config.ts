import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** 아이폰·맥 앱은 주소가 파일 폴더라서, 웹처럼 /photo_hint/ 가 아니라 같은 폴더를 기준으로 묶습니다. */
const embedded = process.env.CAPACITOR === '1' || process.env.MACOS === '1';

export default defineConfig({
  base: embedded ? './' : '/photo_hint/',
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
