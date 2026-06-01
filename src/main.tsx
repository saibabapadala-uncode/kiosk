// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// i18n — must initialise before any component renders
import './i18n';

// Ionic required CSS
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';

// Design system — Tailwind utilities + brand tokens
import './index.css';

import App from './App';
import { flushOfflineOrderQueue } from './services/order.service';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Flush any orders that failed during a previous session
void flushOfflineOrderQueue();

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found in index.html');

createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
