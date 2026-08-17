import { test, expect } from 'vitest';
import { checkPhaseStatus } from '../../scripts/cutover-check.mjs';

test('passes when phases 1-6 are all Done', () => {
  const table = `
| # | Phase | Scope | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | x | ✅ Done | a | b |
| 2a | Categories | x | ✅ Done | a | b |
| 6 | Administration | x | ✅ Done | a | b |
| 7 | Build cutover | x | Not started | — | — |
`;
  expect(() => checkPhaseStatus(table)).not.toThrow();
});

test('throws listing incomplete phases', () => {
  const table = `
| # | Phase | Scope | Status | Plan | Merge commit |
|---|---|---|---|---|---|
| 1 | Shared foundations | x | ✅ Done | a | b |
| 4 | Reports & exports | x | Not started | — | — |
| 5 | Public portal & registration | x | Not started | — | — |
| 6 | Administration | x | Not started | — | — |
| 7 | Build cutover | x | Not started | — | — |
`;
  expect(() => checkPhaseStatus(table)).toThrow(/4 \(Reports & exports\), 5 \(Public portal & registration\), 6 \(Administration\)/);
});