export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

export function badge(status) {
  const s = String(status || '').toLowerCase().trim();
  let type = 'neutral';
  if (['activa', 'activo', 'aprobada', 'aprobado', 'completada', 'completado', 'saludable', 'puntual', 'conciliada', 'conciliado'].includes(s)) {
    type = 'success';
  } else if (['inactiva', 'inactivo', 'revertida', 'revertido', 'cancelado', 'cancelada', 'rechazada', 'rechazado', 'agotado', 'agotada', 'desvinculado', 'desvinculada', 'crítico', 'critico'].includes(s)) {
    type = 'danger';
  } else if (['pendiente', 'bajo', 'suspendido', 'suspendida', 'tardanza', 'alerta', 'reponer'].includes(s)) {
    type = 'warning';
  } else if (['licencia', 'permiso'].includes(s)) {
    type = 'purple';
  } else if (['vacaciones', 'info', 'entrada'].includes(s)) {
    type = 'info';
  }
  return `<span class="badge-pill ${type}"><span class="badge-pill-dot"></span>${escapeHtml(status || 'N/A')}</span>`;
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
