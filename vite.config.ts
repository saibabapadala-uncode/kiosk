// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode !== 'development';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },

    server: {
      port: 3000,
      host: true,
      warmup: {
        // Pre-transform critical entry-point modules
        clientFiles: ['./src/main.tsx', './src/App.tsx'],
      },
    },

    build: {
      target: 'es2020',
      // Don't minify in staging so error stacks are readable
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor chunks — keeps main bundle lean
            if (id.includes('@ionic/')) return 'ionic';
            if (id.includes('@tanstack/react-virtual')) return 'virtual';
            if (id.includes('@tanstack/')) return 'query';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (id.includes('@capacitor/')) return 'capacitor';
            if (id.includes('axios')) return 'axios';
            if (id.includes('node_modules')) return 'vendor';
          },
          // Deterministic filenames for CDN cache busting
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },

    // Inline small assets into the bundle instead of emitting separate files
    assetsInlineLimit: 4096,

    // Suppress noisy "use client" directive warnings from Ionic
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        '@tanstack/react-query',
        'i18next',
        'react-i18next',
      ],
    },
  };
});
