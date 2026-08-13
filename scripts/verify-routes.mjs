import { readFile } from 'node:fs/promises';
const source = await readFile('src/app/main.js', 'utf8');
const expected = ['/demo', '/planos', '/superadmin', 'renderChampionship', 'renderPublicChampionship', 'renderRegistration', 'renderPublication'];
for (const route of expected) if (!source.includes(route)) throw new Error(`Rota ausente: ${route}`);
console.log(`OK: ${expected.length} grupos de rotas encontrados`);
