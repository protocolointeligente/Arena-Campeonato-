export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
