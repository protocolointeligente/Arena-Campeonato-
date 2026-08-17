import { describe, it, expect } from 'vitest';
import { resizeImage } from './images.js';

describe('resizeImage', () => {
  it('resolves to an empty string when no file is given', async () => {
    await expect(resizeImage(null, 500, 500)).resolves.toBe('');
  });

  it('rejects files larger than 8 MB without touching FileReader/Image', async () => {
    const big = { size: 9 * 1024 * 1024 };
    await expect(resizeImage(big, 500, 500)).rejects.toThrow('Imagem maior que 8 MB');
  });
  // Real decode/resize output is NOT unit-tested here: jsdom has no image
  // decoder or 2D canvas renderer, same accepted gap as roster.js's
  // compressPhoto (see docs/superpowers/plans/2026-08-15-migration-phase2b-roster.md).
});
