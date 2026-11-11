import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Platy tokens are keyed on data-theme; follow the OS setting live.
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => { document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'; };
applyTheme();
media.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
