import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

// Setup globals
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

vi.stubGlobal('navigator', dom.window.navigator);

describe('Accessibility - Components', () => {
  it('Button should have no critical violations', async () => {
    const { Button } = await import('./components/Button.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Button({ children: 'Test', onClick: () => {} }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('Card should have no critical violations', async () => {
    const { Card } = await import('./components/Card.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Card({ title: 'Title', children: 'Content' }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('Table should have no critical violations', async () => {
    const { Table } = await import('./components/Table.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Table({ 
      headers: [{ key: 'name', label: 'Name' }], 
      rows: [{ name: 'Test' }] 
    }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('Tabs should have no critical violations', async () => {
    const { Tabs } = await import('./components/Tabs.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Tabs({ 
      tabs: [{ key: 'tab1', label: 'Tab 1', content: 'Content' }], 
      activeTab: 'tab1' 
    }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('Select should have no critical violations', async () => {
    const { Select } = await import('./components/Select.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Select({ 
      label: 'Test',
      name: 'test',
      options: [{ value: '1', label: 'Option 1' }] 
    }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });

  it('Input should have no critical violations', async () => {
    const { Input } = await import('./components/Input.js');
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(Input({ label: 'Test', name: 'test' }));
    const results = await axe.run(root);
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});


