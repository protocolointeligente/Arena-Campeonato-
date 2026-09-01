import { esc } from '../app/utils.ts';

export function Card({ title, subtitle, children, className = '', headerActions, footer, padded = true }) {
  const card = document.createElement('div');
  card.className = `card ${className}`.trim();
  
  let html = '';
  
  if (title || subtitle || headerActions) {
    html += '<div class="card-header">';
    if (title) {html += `<h3 class="card-title">${esc(title)}</h3>`;}
    if (subtitle) {html += `<p class="card-subtitle muted">${esc(subtitle)}</p>`;}
    if (headerActions) {html += `<div class="card-header-actions">${headerActions}</div>`;}
    html += '</div>';
  }
  
  html += `<div class="card-body${padded ? ' card-padded' : ''}">${children}</div>`;
  
  if (footer) {
    html += `<div class="card-footer">${footer}</div>`;
  }
  
  card.innerHTML = html;
  return card;
}

export function CardGrid({ columns = 3, gap = 'md', children, className = '' }) {
  const grid = document.createElement('div');
  grid.className = `card-grid ${className}`.trim();
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(${columns}, 1fr);
    gap: var(--space-${gap});
  `;
  
  if (typeof children === 'function') {
    grid.appendChild(children());
  } else if (Array.isArray(children)) {
    children.forEach(child => grid.appendChild(child));
  } else {
    grid.appendChild(children);
  }
  
  return grid;
}

