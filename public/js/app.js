import { state } from './core/state.js';
import { loadData } from './core/api.js';
import { render } from './core/router.js';

window.__loadDataAndRender = async () => {
  await loadData();
  render();
};

async function bootstrap() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('token') && urlParams.has('email')) {
    state.resetToken = urlParams.get('token');
    state.resetEmail = urlParams.get('email');
    state.view = 'reset-password';
    state.loggedIn = false;
    render();
    return;
  }
  try {
    const response = await fetch('/api/profile', { credentials: 'include' });
    if (!response.ok) throw new Error('No active session');
    state.currentUser = await response.json();
    await loadData();
    state.loggedIn = true;
  } catch (_error) {
    state.loggedIn = false;
  }
  render();
}

bootstrap();
