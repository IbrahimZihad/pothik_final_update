import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function siteUrlPlugin(siteUrl) {
  return {
    name: 'pothik-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || process.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');

  return {
    plugins: [react(), siteUrlPlugin(siteUrl)],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
        '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
  };
});
