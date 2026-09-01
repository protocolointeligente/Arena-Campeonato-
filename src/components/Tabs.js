import { esc } from '../app/utils.ts';

export function Tabs({ tabs = [], activeTab, onChange, className = '', variant = 'line', orientation = 'horizontal' }) {
  const tablist = document.createElement('div');
  tablist.className = `tabs tabs-${variant} ${orientation === 'vertical' ? 'tabs-vertical' : ''} ${className}`.trim();
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-orientation', orientation);
  
  tabs.forEach((tab, index) => {
    const isActive = tab.key === activeTab;
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.className = `tab-btn ${isActive ? 'active' : ''}`;
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', isActive);
    tabBtn.setAttribute('aria-controls', `tabpanel-${tab.key}`);
    tabBtn.setAttribute('id', `tab-${tab.key}`);
    tabBtn.tabIndex = isActive ? 0 : -1;
    
    let content = '';
    if (tab.icon) {content += `<span class="tab-icon" aria-hidden="true">${tab.icon}</span>`;}
    content += `<span class="tab-label">${esc(tab.label)}</span>`;
    if (tab.badge !== undefined) {content += `<span class="tab-badge">${esc(tab.badge)}</span>`;}
    
    tabBtn.innerHTML = content;
    
    tabBtn.addEventListener('click', () => {
      if (onChange && !isActive) {onChange(tab.key);}
    });
    
    // Keyboard navigation
    tabBtn.addEventListener('keydown', (e) => {
      let newIndex = index;
      if (orientation === 'horizontal') {
        if (e.key === 'ArrowRight') {newIndex = (index + 1) % tabs.length;}
        else if (e.key === 'ArrowLeft') {newIndex = (index - 1 + tabs.length) % tabs.length;}
      } else {
        if (e.key === 'ArrowDown') {newIndex = (index + 1) % tabs.length;}
        else if (e.key === 'ArrowUp') {newIndex = (index - 1 + tabs.length) % tabs.length;}
      }
      if (newIndex !== index && onChange) {
        e.preventDefault();
        onChange(tabs[newIndex].key);
        tabs[newIndex].element?.focus();
      }
    });
    
    tab.element = tabBtn;
    tablist.appendChild(tabBtn);
  });
  
  // Tab panels container
  const panels = document.createElement('div');
  panels.className = 'tab-panels';
  
  tabs.forEach((tab) => {
    const panel = document.createElement('div');
    panel.className = `tab-panel ${tab.key === activeTab ? 'active' : ''}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${tab.key}`);
    panel.setAttribute('id', `tabpanel-${tab.key}`);
    panel.hidden = tab.key !== activeTab;
    
    if (typeof tab.content === 'function') {
      panel.appendChild(tab.content());
    } else if (tab.content instanceof Node) {
      panel.appendChild(tab.content);
    } else {
      panel.innerHTML = tab.content;
    }
    
    panels.appendChild(panel);
  });
  
  const container = document.createElement('div');
  container.className = 'tabs-container';
  container.appendChild(tablist);
  container.appendChild(panels);
  
  return container;
}

// Simple tabs without panels (just buttons)
export function TabBar({ tabs = [], activeTab, onChange, className = '', scrollable = true }) {
  const bar = document.createElement('div');
  bar.className = `tab-bar ${scrollable ? 'scrollable' : ''} ${className}`.trim();
  bar.setAttribute('role', 'tablist');
  
  tabs.forEach((tab) => {
    const isActive = tab.key === activeTab;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-bar-btn ${isActive ? 'active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive);
    btn.tabIndex = isActive ? 0 : -1;
    
    let content = '';
    if (tab.icon) {content += `<span class="tab-icon" aria-hidden="true">${tab.icon}</span>`;}
    content += `<span class="tab-label">${esc(tab.label)}</span>`;
    if (tab.badge !== undefined) {content += `<span class="tab-badge">${esc(tab.badge)}</span>`;}
    
    btn.innerHTML = content;
    btn.addEventListener('click', () => { if (onChange && !isActive) {onChange(tab.key);} });
    bar.appendChild(btn);
  });
  
  return bar;
}

