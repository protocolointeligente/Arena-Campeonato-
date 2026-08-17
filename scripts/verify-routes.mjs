import { readFile } from 'node:fs/promises';
const source = await readFile('src/app/main.js', 'utf8');
const expected = ['/demo', '/planos', '/superadmin', '/publicacao', 'renderChampionship', 'renderPublicChampionship', 'renderRegistration', 'renderPublication', 'renderSuperadmin', 'renderAuditCenter', 'renderSecurityCenter', 'renderPrivacyCenter', 'renderBetaHardening', 'renderPlansBilling', 'renderPlans', 'renderHome', 'renderLanding', 'renderNewChampionship'];
for (const route of expected) if (!source.includes(route)) throw new Error(`Rota ausente: ${route}`);
console.log(`OK: ${expected.length} grupos de rotas encontrados`);
