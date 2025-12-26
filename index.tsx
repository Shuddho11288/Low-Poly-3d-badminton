import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <>
      <App />
    </>
  );
} catch (e: any) {
  console.error("React Render Error:", e);
  rootElement.innerHTML = `<div style="color: #ef4444; padding: 20px; font-family: monospace;">
    <h3>Failed to load application</h3>
    <p>${e.message}</p>
  </div>`;
}