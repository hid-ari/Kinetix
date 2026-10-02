export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function badge(status) {
  return `<span class="badge ${status === 'Activa' ? 'active' : 'inactive'}">${escapeHtml(status)}</span>`;
}

export function toast(message) {
  const toastRegion = document.querySelector('#toast-region');
  if (!toastRegion) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  toastRegion.append(node);
  setTimeout(() => node.remove(), 3200);
}

export function initials(name) {
  return name.split(' ').map(part => part[0]).slice(0, 2).join('');
}

export function displayDate(value) {
  return value ? new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(value)) : 'Nunca';
}
