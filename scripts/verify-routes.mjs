import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_DEFINITIONS } from '../src/app/routes.js';

const expected = [
  '/', '/login', '/register', '/tutorial', '/demo', '/campeonatos/novo',
  '/campeonatos', '/planos', '/superadmin', '/publicacao',
  '/superadmin/auditoria', '/superadmin/seguranca', '/superadmin/privacidade',
  '/superadmin/beta', '/superadmin/planos', '/publicacao/:id', '/inscrever/:id',
  '/publico/:id', '/c/:slug', '/embed/:id', '/equipe/:id/:teamId',
  '/campeonatos/:id', '/placar/:id/:matchId', '/sorteio/:id',
  '/inscrever/:championshipId/status/:registrationId',
  '/termos', '/privacidade',
];

const actual = ROUTE_DEFINITIONS.map(({ pattern }) => pattern);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Tabela de rotas divergente. Esperadas ${expected.length}, encontradas ${actual.length}`);
}
console.log(`OK: ${actual.length} rotas verificadas`);

// Todo link/navegação interna do código precisa apontar pra uma rota existente, e todo
// arquivo estático referenciado precisa existir em public/. Nada de href="#" morto.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeRegexes = ROUTE_DEFINITIONS.map(({ pattern }) => new RegExp(`^${pattern.replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`));
const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) {walk(full);} else if (/\.(js|ts|html)$/.test(entry.name) && !/\.test\./.test(entry.name)) {files.push(full);}
});
walk(path.join(root, 'src'));
files.push(path.join(root, 'index.html'));
const linkPatterns = [
  /navigate\(\s*(['"`])(\/[^'"`]*)\1/g,
  /href=\\?(["'])(\/[^"'\\]*)\\?\1/g,
  /window\.open\(\s*(['"`])(\/[^'"`]*)\1/g,
  /data-(?:nav|go|route|link)=\\?(["'])(\/[^"'\\]*)\\?\1/g,
  /(?:src|href)=\\?(["'])(\/[^"'\\$]+\.(?:png|svg|jpe?g|webp|ico|webmanifest))\\?\1/g,
];
const problems = [];
let checked = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const where = (index) => `${path.relative(root, file)}:${source.slice(0, index).split('\n').length}`;
  for (const match of source.matchAll(/href=\\?["']#\\?["']/g)) {problems.push(`link morto href="#" em ${where(match.index)}`);}
  for (const re of linkPatterns) {
    for (const match of source.matchAll(re)) {
      const raw = match[2].split(/[?#]/)[0].replace(/\$\{[^}]*\}/g, 'X');
      if (!raw || raw.startsWith('//')) {continue;}
      checked++;
      if (/\.[a-z0-9]+$/i.test(raw)) {
        if (!fs.existsSync(path.join(root, 'public', raw))) {problems.push(`arquivo inexistente ${raw} em ${where(match.index)}`);}
        continue;
      }
      const clean = raw.length > 1 ? raw.replace(/\/$/, '') : raw;
      if (!routeRegexes.some((routeRe) => routeRe.test(clean))) {problems.push(`rota inexistente ${clean} em ${where(match.index)}`);}
    }
  }
}
if (problems.length) {throw new Error(`Links quebrados:\n${problems.join('\n')}`);}
console.log(`OK: ${checked} links internos apontam para rotas/arquivos existentes`);
