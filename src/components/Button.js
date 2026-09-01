import { esc } from '../app/utils.ts';

export function Button({ variant = 'primary', size = 'md', disabled = false, loading = false, children, onClick, type = 'button', className = '', 'aria-label': ariaLabel, ...props }) {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  const sizeClasses = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };
  
  const classes = `${baseClasses} ${variantClasses[variant] || ''} ${sizeClasses[size] || ''} ${className}`.trim();
  
  const content = loading 
    ? `<span class="btn-spinner" aria-hidden="true"></span><span class="btn-loading-text">${esc(children)}</span>`
    : esc(children);
  
  const button = document.createElement('button');
  button.type = type;
  button.className = classes;
  button.disabled = disabled || loading;
  button.innerHTML = content;
  
  if (onClick) {button.addEventListener('click', onClick);}
  if (ariaLabel) {button.setAttribute('aria-label', ariaLabel);}
  
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      button.setAttribute(key, value);
    }
  });
  
  return button;
}

export function IconButton({ icon, 'aria-label': ariaLabel, variant = 'ghost', size = 'md', onClick, className = '' }) {
  const button = Button({
    variant,
    size,
    'aria-label': ariaLabel,
    onClick,
    className: `btn-icon ${className}`,
    children: `<span class="btn-icon-svg" aria-hidden="true">${icon}</span>`,
  });
  return button;
}

