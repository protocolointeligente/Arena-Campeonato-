import { defineConfig } from 'vitest/config';

// Scope test discovery to this project's own test files. Without this,
// Vitest's default include glob (**/*.test.js) also picks up stray,
// untracked local directories at the repo root (e.g. .chrome-cdp/, a
// side-loaded Chrome extension left by an earlier debugging session) that
// ship their own Jest-based *.spec.js files — those aren't part of this
// project and fail under Vitest with "jest is not defined".
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
  },
});
