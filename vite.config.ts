import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Works on GitHub Pages: username.github.io/REPOSITORY/
});
