import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', function(event) {
  document.body.innerHTML += `<div style="z-index:9999;position:absolute;top:0;left:0;color:red;background:black;padding:20px;">Window Error: ${event.message}</div>`;
});

const debugDiv = document.getElementById('debug-text');
if (debugDiv) debugDiv.style.display = 'none';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
