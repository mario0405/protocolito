import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';

if (!window.location.hash) {
  window.location.hash = '/';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
