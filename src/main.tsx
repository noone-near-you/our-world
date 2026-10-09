import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';
createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.DEV) import('./state/store').then(m => ((window as any).__game = m));
if (import.meta.env.DEV) import('./story/engine').then(m => ((window as any).__engine = m));
