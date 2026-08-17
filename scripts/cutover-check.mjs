import { readFile } from 'node:fs/promises';

const PROGRESS_PATH = 'docs/superpowers/plans/MIGRATION-PROGRESS.md';

export function checkPhaseStatus(tableMarkdown) {
  const rows = tableMarkdown
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('| # |'));

  const incomplete = [];
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    const num = cells[1];
    const name = cells[2];
    const status = cells[4];
    if (num === '7') continue;
    if (!status || !status.startsWith('✅')) {
      incomplete.push(`${num} (${name})`);
    }
  }

  if (incomplete.length > 0) {
    throw new Error(`Cutover blocked — incomplete phases: ${incomplete.join(', ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const full = await readFile(PROGRESS_PATH, 'utf8');
  const tableStart = full.indexOf('## Phase status');
  const tableSection = full.slice(tableStart, full.indexOf('\n## ', tableStart + 1));
  try {
    checkPhaseStatus(tableSection);
    console.log('OK: phases 1-6 all done, cutover is safe to run');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}