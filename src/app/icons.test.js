import { describe, it, expect } from 'vitest';
import { icon, cardChip } from './icons.js';

describe('icon', () => {
  it('returns a valid inline SVG string for a known name', () => {
    const svg = icon('trophy');
    expect(svg).toMatch(/^<svg[^>]*>.*<\/svg>$/);
    expect(svg).toContain('stroke="currentColor"');
  });

  it('respects the size argument', () => {
    expect(icon('gear', 32)).toContain('width="32" height="32"');
  });

  it('returns an empty string for an unknown name (never throws)', () => {
    expect(icon('not-a-real-icon')).toBe('');
  });
});

describe('cardChip', () => {
  it('renders a solid rect in the given color', () => {
    const svg = cardChip('var(--warning)');
    expect(svg).toContain('fill="var(--warning)"');
    expect(svg).toMatch(/^<svg[^>]*>.*<\/svg>$/);
  });
});
