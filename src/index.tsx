import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Wait for the DOM to be fully loaded before trying to mount the React app.
// This is a safeguard against potential timing issues where the script might
// execute before the #root element is available in the DOM.
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
