import App from './App.svelte';
import './app.css';

const app = new App({
  target: document.getElementById('app')!,
});

// Ensure arrow-key repeat works in inputs/textareas by stopping propagation
// of keyboard events from these elements to parent listeners (e.g. draggable containers).
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    e.stopPropagation();
  }
}, true); // capture phase

export default app;
