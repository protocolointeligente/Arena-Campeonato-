import { fmtDateBR } from './format.js';

let jsPDFCache = null;

export async function getJsPDF() {
  if (jsPDFCache) {return jsPDFCache;}
  const { jsPDF } = await import('jspdf');
  jsPDFCache = jsPDF;
  return jsPDF;
}

export function resolveCategories(state) {
  return state.categories || [{ 
    id: state.activeCategoryId || 'default', 
    nome: 'Categoria', 
    teams: state.teams || [], 
    matches: state.matches || [], 
    grupos: state.grupos || [], 
    phases: state.phases || [], 
    activePhaseId: state.activePhaseId, 
    cfg: state.cfg, 
    formato: state.formato 
  }];
}

export function resolveCategoryData(category, state, key) {
  return category[key] || state[key] || [];
}

export function resolveTeams(category, state) {
  return category.teams || state.teams || [];
}

export function resolveMatches(category, state) {
  return category.matches || state.matches || [];
}

export function resolveGroups(category, state) {
  return category.grupos || state.grupos || [];
}

export function resolveConfig(category, state) {
  const phase = (category.phases || []).find(p => p.id === category.activePhaseId);
  return phase?.cfg || category.cfg || state.cfg || {};
}

export function resolveFormat(category, state) {
  return category.formato || state.formato || 'liga';
}

export function makeReportName(state, suffix, categoryName) {
  return `${(`${state.nome || 'campeonato'  }_${  categoryName || 'categoria'  }_${  suffix}`).replace(/[^\w-]+/g, '_')  }.pdf`;
}

export const DEFAULT_TABLE_OPT = {
  theme: 'grid',
  styles: { fontSize: 9, cellPadding: 4 },
  headStyles: { fillColor: [26, 163, 83], textColor: 255 },
  margin: { left: 40, right: 40 },
  columnStyles: { 1: { halign: 'left' } },
};

export async function createBaseDocument(title, subtitle, state, categoryName, phaseName) {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 60, 40); doc.text(state.nome || 'Campeonato', 40, 44);
  doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(title, 40, 66);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); 
  doc.text([state.modalidade, state.modelo || state.formato, categoryName, phaseName, subtitle].filter(Boolean).join(' · '), 40, 82);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(170); doc.text('ARENA', W - 40, 44, { align: 'right' });
  return { doc, y: 102, opt: { ...DEFAULT_TABLE_OPT, startY: 102 } };
}

export async function createReportDoc(state, title, subtitle, categoryName, phaseName) {
  const jsPDF = await getJsPDF();
  if (typeof jsPDF !== 'function') {return null;}
  return createBaseDocument(title, subtitle, state, categoryName, phaseName);
}

export async function standardReportLoop(state, renderFn, { title, subtitle, filenameSuffix } = {}) {
  const categories = resolveCategories(state);
  let reportDoc = null;
  for (const cat of categories) {
    reportDoc = await createReportDoc(state, title, subtitle || '', cat.nome);
    if (!reportDoc) {return;}
    await renderFn(reportDoc, cat, state);
    if (categories.length > 1) {
      reportDoc.doc.addPage();
    }
  }
  reportDoc.doc.save(makeReportName(state, filenameSuffix || title.toLowerCase(), categories[0]?.nome));
}

export function autoTable(doc, head, body, options = {}) {
  return doc.autoTable({ ...DEFAULT_TABLE_OPT, head: [head], body, ...options });
}

export function sectionTitle(doc, y, text, need = 60) {
  const pageGuard = (need) => { if (y > 800 - (need || 40)) { doc.addPage(); y = 46; } };
  pageGuard(need);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(text, 40, y);
  return y + 4;
}

export function getTeamName(teams, id) {
  if (!id) {return '—';}
  const i = teams.findIndex(t => t.id === id);
  return i >= 0 ? teams[i].nome : '—';
}

export function formatMatchScore(hg, ag) {
  return (hg != null && ag != null) ? `${hg} x ${ag}` : '– x –';
}

export function formatStandingsHead(cfg, scoreType = '') {
  const disc = cfg?.criterios?.includes('DISC');
  const sets = scoreType === 'sets' || cfg?.scoreType === 'sets';
  return ['#', 'Equipe', 'P', 'J', 'V', 'E', 'D', sets ? 'SP' : 'GP', sets ? 'SC' : 'GC', sets ? 'SS' : 'SG'].concat(disc ? ['DISC'] : []);
}

export function formatStandingsRows(teams, standings, cfg) {
  const disc = cfg?.criterios?.includes('DISC');
  return standings.map((s, i) => [
    i + 1, 
    teams[s.team]?.nome || '—', 
    s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, s.SG
  ].concat(disc ? [s.DISC ?? 0] : []));
}

export function formatMatchRow(teams, match, includeDate = false) {
  const meta = match.meta || {};
  const home = teams[match.home]?.nome || '—';
  const away = teams[match.away]?.nome || '—';
  const score = formatMatchScore(match.hg, match.ag);
  const row = [match.rodada || '—', home, score, away];
  if (includeDate) {
    row.push(fmtDateBR(meta.date) || '—');
  }
  return row;
}

