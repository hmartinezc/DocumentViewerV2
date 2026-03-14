import path from 'path';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [preact()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'index.tsx'),
        name: 'ShippingDocViewer',
        formats: ['iife'],
        fileName: () => 'shipping-doc-viewer.js'
      },
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  };
});
