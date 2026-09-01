import { esc } from '../app/utils.ts';

export function Select({ label, name, id, options = [], value = '', placeholder, required = false, disabled = false, error, hint, multiple = false, className = '', onChange, onBlur, ...props }) {
  const selectId = id || name || `select-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${selectId}-error` : null;
  const hintId = hint ? `${selectId}-hint` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  
  const wrapper = document.createElement('div');
  wrapper.className = `form-field ${className}`.trim();
  
  let html = '';
  
  if (label) {
    html += `<label class="form-label" for="${esc(selectId)}">${esc(label)}${required ? ' <span class="required" aria-hidden="true">*</span>' : ''}</label>`;
  }
  
  html += `
    <select
      id="${esc(selectId)}"
      name="${esc(name || '')}"
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
      ${multiple ? 'multiple' : ''}
      ${error ? 'aria-invalid="true"' : ''}
      ${describedBy ? `aria-describedby="${esc(describedBy)}"` : ''}
      class="form-select ${error ? 'form-input-error' : ''}"
    >
  `;
  
  if (placeholder) {
    html += `<option value="" disabled ${!value ? 'selected' : ''}>${esc(placeholder)}</option>`;
  }
  
  options.forEach(option => {
    const isSelected = multiple 
      ? (Array.isArray(value) && value.includes(option.value))
      : option.value === value;
    html += `<option value="${esc(option.value)}" ${isSelected ? 'selected' : ''}>${esc(option.label)}</option>`;
  });
  
  html += '</select>';
  
  if (error) {
    html += `<span id="${esc(errorId)}" class="form-error" role="alert">${esc(error)}</span>`;
  }
  
  if (hint) {
    html += `<span id="${esc(hintId)}" class="form-hint">${esc(hint)}</span>`;
  }
  
  wrapper.innerHTML = html;
  
  const select = wrapper.querySelector('select');
  if (onChange) {select.addEventListener('change', (e) => onChange(e.target.value, e));}
  if (onBlur) {select.addEventListener('blur', onBlur);}
  
  return wrapper;
}

export function OptionGroup({ label, options }) {
  return { label, options, isGroup: true };
}

