import { esc } from '../app/utils.ts';

export function Input({ label, type = 'text', name, id, value = '', placeholder, required = false, disabled = false, error, hint, className = '', onChange, onBlur, 'aria-describedby': ariaDescribedBy, ...props }) {
  const inputId = id || name || `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${inputId}-error` : null;
  const hintId = hint ? `${inputId}-hint` : null;
  const describedBy = [errorId, hintId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;
  
  const wrapper = document.createElement('div');
  wrapper.className = `form-field ${className}`.trim();
  
  let html = '';
  
  if (label) {
    html += `<label class="form-label" for="${esc(inputId)}">${esc(label)}${required ? ' <span class="required" aria-hidden="true">*</span>' : ''}</label>`;
  }
  
  html += `
    <input
      type="${esc(type)}"
      id="${esc(inputId)}"
      name="${esc(name || '')}"
      value="${esc(value)}"
      placeholder="${esc(placeholder || '')}"
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
      ${error ? 'aria-invalid="true"' : ''}
      ${describedBy ? `aria-describedby="${esc(describedBy)}"` : ''}
      class="form-input ${error ? 'form-input-error' : ''}"
    />
  `;
  
  if (error) {
    html += `<span id="${esc(errorId)}" class="form-error" role="alert">${esc(error)}</span>`;
  }
  
  if (hint) {
    html += `<span id="${esc(hintId)}" class="form-hint">${esc(hint)}</span>`;
  }
  
  wrapper.innerHTML = html;
  
  const input = wrapper.querySelector('input');
  
  if (onChange) {input.addEventListener('input', (e) => onChange(e.target.value, e));}
  if (onBlur) {input.addEventListener('blur', onBlur);}
  
  Object.entries(props).forEach(([key, val]) => {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      input.setAttribute(key, val);
    }
  });
  
  return wrapper;
}

export function Textarea({ label, name, id, value = '', placeholder, required = false, disabled = false, error, hint, rows = 4, className = '', onChange, onBlur, ...props }) {
  const inputId = id || name || `textarea-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${inputId}-error` : null;
  const hintId = hint ? `${inputId}-hint` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  
  const wrapper = document.createElement('div');
  wrapper.className = `form-field ${className}`.trim();
  
  let html = '';
  
  if (label) {
    html += `<label class="form-label" for="${esc(inputId)}">${esc(label)}${required ? ' <span class="required" aria-hidden="true">*</span>' : ''}</label>`;
  }
  
  html += `
    <textarea
      id="${esc(inputId)}"
      name="${esc(name || '')}"
      placeholder="${esc(placeholder || '')}"
      rows="${rows}"
      ${required ? 'required' : ''}
      ${disabled ? 'disabled' : ''}
      ${error ? 'aria-invalid="true"' : ''}
      ${describedBy ? `aria-describedby="${esc(describedBy)}"` : ''}
      class="form-textarea ${error ? 'form-input-error' : ''}"
    >${esc(value)}</textarea>
  `;
  
  if (error) {
    html += `<span id="${esc(errorId)}" class="form-error" role="alert">${esc(error)}</span>`;
  }
  
  if (hint) {
    html += `<span id="${esc(hintId)}" class="form-hint">${esc(hint)}</span>`;
  }
  
  wrapper.innerHTML = html;
  
  const textarea = wrapper.querySelector('textarea');
  
  if (onChange) {textarea.addEventListener('input', (e) => onChange(e.target.value, e));}
  if (onBlur) {textarea.addEventListener('blur', onBlur);}
  
  return wrapper;
}

export function Checkbox({ label, name, id, checked = false, required = false, disabled = false, error, className = '', onChange, ...props }) {
  const inputId = id || name || `checkbox-${Math.random().toString(36).slice(2, 9)}`;
  
  const wrapper = document.createElement('div');
  wrapper.className = `form-field form-checkbox ${className}`.trim();
  
  wrapper.innerHTML = `
    <label class="checkbox-label" for="${esc(inputId)}">
      <input
        type="checkbox"
        id="${esc(inputId)}"
        name="${esc(name || '')}"
        ${checked ? 'checked' : ''}
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        class="checkbox-input"
      />
      <span class="checkbox-checkmark" aria-hidden="true"></span>
      <span class="checkbox-text">${esc(label)}</span>
    </label>
    ${error ? `<span class="form-error" role="alert">${esc(error)}</span>` : ''}
  `;
  
  const input = wrapper.querySelector('input');
  if (onChange) {input.addEventListener('change', (e) => onChange(e.target.checked, e));}
  
  return wrapper;
}

export function RadioGroup({ label, name, options = [], value, required = false, disabled = false, error, className = '', onChange, inline = false, ...props }) {
  const groupId = `radiogroup-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = error ? `${groupId}-error` : null;
  
  const wrapper = document.createElement('div');
  wrapper.className = `form-field form-radiogroup ${inline ? 'inline' : ''} ${className}`.trim();
  
  let html = '';
  
  if (label) {
    html += `<fieldset class="radiogroup-fieldset"><legend class="form-label">${esc(label)}${required ? ' <span class="required" aria-hidden="true">*</span>' : ''}</legend>`;
  }
  
  options.forEach((option, i) => {
    const optionId = `${groupId}-${i}`;
    const checked = option.value === value;
    html += `
      <label class="radio-label ${inline ? 'radio-inline' : ''}" for="${esc(optionId)}">
        <input
          type="radio"
          id="${esc(optionId)}"
          name="${esc(name)}"
          value="${esc(option.value)}"
          ${checked ? 'checked' : ''}
          ${disabled ? 'disabled' : ''}
          ${required ? 'required' : ''}
          class="radio-input"
        />
        <span class="radio-checkmark" aria-hidden="true"></span>
        <span class="radio-text">${esc(option.label)}</span>
      </label>
    `;
  });
  
  if (label) {html += '</fieldset>';}
  if (error) {html += `<span id="${esc(errorId)}" class="form-error" role="alert">${esc(error)}</span>`;}
  
  wrapper.innerHTML = html;
  
  wrapper.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      if (onChange) {onChange(e.target.value, e);}
    });
  });
  
  return wrapper;
}

