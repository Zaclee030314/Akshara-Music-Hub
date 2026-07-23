import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Analytics } from '@vercel/analytics/react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <App />
          <Analytics />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);