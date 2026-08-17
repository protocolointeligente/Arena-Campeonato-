import { jsPDF } from 'jspdf';
import { computeStandings, scorerRanking, cardRanking, suspensionInfo } from './standings.js';
import { allMatchObjs, matchMeta } from './matches.js';
import { venueById, officialById } from './ops.js';
import { teamById, athName } from './roster.js';
import { phaseParticipants, activePhaseOf } from './phases.js';
import { activeCategory } from './categories.js';
import { fmtDateBR } from './format.js';
import { esc } from './utils.js';

export function reportBase(state, title, subtitle) {
  if (typeof jsPDF !== 'function') { return null; }
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const cat = activeCategory(state);
  const phase = activePhaseOf(cat);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 60, 40); doc.text(state.nome || 'Campeonato', 40, 44);
  doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(title, 40, 66);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text([cat?.nome, phase?.nome, subtitle].filter(Boolean).join(' · '), 40, 82);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(170); doc.text('ARENA', W - 40, 44, { align: 'right' });
  return { doc, y: 102, opt: { theme: 'grid', styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [26, 163, 83], textColor: 255 }, margin: { left: 40, right: 40 } } };
}

export function reportName(state, suffix) {
  const cat = activeCategory(state);
  return ((state.nome || 'campeonato') + '_' + (cat?.nome || 'categoria') + '_' + suffix).replace(/[^\w\-]+/g, '_') + '.pdf';
}

export function reportStandingsBlocks(state) {
  const blocks = [];
  const cat = activeCategory(state);
  const phase = activePhaseOf(cat);
  const cfg = phase?.cfg || state.cfg || {};
  const formato = state.formato || 'liga';
  if (formato === 'liga') {
    const idxs = state.teams.map((_, i) => i);
    blocks.push({ title: 'Classificação', st: computeStandings(state.teams, idxs, state.matches || [], cfg) });
  } else if (formato === 'grupos' || formato === 'gxg') {
    (state.grupos || []).forEach((g, gi) => {
      const idxs = g.map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const ms = (state.matches || []).filter((m) => (m.grupo || 0) === gi);
      blocks.push({ title: 'Grupo ' + String.fromCharCode(65 + gi), st: computeStandings(state.teams, idxs, ms, cfg) });
    });
  }
  return blocks;
}

export function exportTeamsReport(state) {
  const b = reportBase(state, 'Relação de equipes');
  if (!b) return;
  const rows = state.teams.map((t, i) => [i + 1, t.nome, (t.roster || []).length, (t.staff && t.staff.tecnico) || '—']);
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['#', 'Equipe', 'Atletas', 'Técnico']], body: rows, columnStyles: { 1: { halign: 'left' }, 3: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'equipes'));
}

export function exportRosterReport(state) {
  const b = reportBase(state, 'Relação nominal de atletas');
  if (!b) return;
  let y = b.y;
  state.teams.forEach((t) => {
    if (y > 720) { b.doc.addPage(); y = 50; }
    b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(11); b.doc.setTextColor(40); b.doc.text(t.nome, 40, y);
    const rows = (t.roster || []).map((a, i) => [i + 1, a.nome, a.numero || '—', a.dob || '—']);
    b.doc.autoTable(Object.assign({}, b.opt, { startY: y + 6, head: [['#', 'Atleta', 'Nº', 'Nascimento']], body: rows.length ? rows : [['—', 'Nenhum atleta cadastrado', '—', '—']], columnStyles: { 1: { halign: 'left' } } }));
    y = b.doc.lastAutoTable.finalY + 18;
  });
  b.doc.save(reportName(state, 'atletas'));
}

export function exportScheduleReport(state) {
  const b = reportBase(state, 'Tabela oficial de jogos');
  if (!b) return;
  const rows = (state.matches || []).slice().sort((a, c) => {
    const A = matchMeta(a), C = matchMeta(c);
    return ((A.date || '9999') + (A.time || '99')).localeCompare((C.date || '9999') + (C.time || '99'));
  }).map((m) => {
    const x = matchMeta(m), v = venueById(state, x.venueId), r = officialById(state, x.refereeId);
    return [m.rodada || '—', fmtDateBR(x.date) || '—', x.time || '—', state.teams[m.home]?.nome || '—', state.teams[m.away]?.nome || '—', v?.name || '—', r?.name || '—'];
  });
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['Rod.', 'Data', 'Hora', 'Mandante', 'Visitante', 'Local', 'Árbitro']], body: rows, columnStyles: { 3: { halign: 'left' }, 4: { halign: 'left' }, 5: { halign: 'left' }, 6: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'tabela_jogos'));
}

export function exportStandingsReport(state) {
  const b = reportBase(state, 'Classificação oficial');
  if (!b) return;
  let y = b.y;
  const disc = (state.cfg?.criterios || []).includes('DISC');
  reportStandingsBlocks(state).forEach((bl) => {
    b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(11); b.doc.setTextColor(40); b.doc.text(bl.title, 40, y);
    const head = ['#', 'Equipe', 'P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].concat(disc ? ['DISC'] : []);
    const rows = bl.st.map((x, i) => [i + 1, state.teams[x.team]?.nome || '—', x.P, x.J, x.V, x.E, x.D, x.GP, x.GC, x.SG].concat(disc ? [x.DISC ?? 0] : []));
    b.doc.autoTable(Object.assign({}, b.opt, { startY: y + 6, head: [head], body: rows, columnStyles: { 1: { halign: 'left' } } }));
    y = b.doc.lastAutoTable.finalY + 18;
  });
  b.doc.save(reportName(state, 'classificacao'));
}

export function exportScorersReport(state) {
  const b = reportBase(state, 'Artilharia');
  if (!b) return;
  const rows = scorerRanking(state).map((r, i) => [i + 1, r.name, r.teamId ? (teamById(state, r.teamId)?.nome || '—') : '—', r.goals]);
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['#', 'Atleta', 'Equipe', 'Gols']], body: rows, columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'artilharia'));
}

export function exportDisciplineReport(state) {
  const b = reportBase(state, 'Disciplina e suspensões', 'Amarelo −' + (state.cfg?.discYellow ?? 1) + ' · Vermelho −' + (state.cfg?.discRed ?? 5));
  if (!b) return;
  const rows = [];
  state.teams.forEach((t) => (t.roster || []).forEach((a) => {
    const si = suspensionInfo(state, a.id), cr = cardRanking(state).find((x) => x.athleteId === a.id);
    if (cr || si.suspended) rows.push([a.nome, t.nome, cr?.y || 0, cr?.r || 0, -((cr?.y || 0) * (state.cfg?.discYellow ?? 1) + (cr?.r || 0) * (state.cfg?.discRed ?? 5)), si.suspended ? 'SUSPENSO' : 'Liberado']);
  }));
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['Atleta', 'Equipe', 'A', 'V', 'Disc.', 'Situação']], body: rows, columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'disciplina'));
}

export function exportOfficialsReport(state) {
  const b = reportBase(state, 'Escala de arbitragem');
  if (!b) return;
  const rows = (state.matches || []).map((m) => {
    const x = matchMeta(m), r = officialById(state, x.refereeId), t = officialById(state, x.tableOfficialId), v = venueById(state, x.venueId);
    return [fmtDateBR(x.date) || '—', x.time || '—', (state.teams[m.home]?.nome || '—') + ' x ' + (state.teams[m.away]?.nome || '—'), r?.name || '—', t?.name || '—', v?.name || '—'];
  });
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['Data', 'Hora', 'Partida', 'Árbitro', 'Mesário', 'Local']], body: rows, columnStyles: { 2: { halign: 'left' }, 3: { halign: 'left' }, 4: { halign: 'left' }, 5: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'arbitragem'));
}

export function exportResultsReport(state) {
  const b = reportBase(state, 'Resultados');
  if (!b) return;
  const rows = (state.matches || []).filter((m) => m.hg != null && m.ag != null).map((m) => {
    const x = matchMeta(m);
    return [m.rodada || '—', fmtDateBR(x.date) || '—', state.teams[m.home]?.nome || '—', m.hg + ' x ' + m.ag, state.teams[m.away]?.nome || '—'];
  });
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y, head: [['Rod.', 'Data', 'Mandante', 'Placar', 'Visitante']], body: rows, columnStyles: { 2: { halign: 'right' }, 4: { halign: 'left' } } }));
  b.doc.save(reportName(state, 'resultados'));
}

export function exportRoundBulletin(state, roundNumber) {
  const b = reportBase(state, 'Boletim da rodada');
  if (!b) return;
  const rounds = [...new Set((state.matches || []).map((m) => m.rodada).filter(Boolean))].sort((a, c) => a - c);
  const rd = +roundNumber || rounds[rounds.length - 1] || 1;
  const ms = (state.matches || []).filter((m) => m.rodada === rd);
  b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(12); b.doc.setTextColor(40); b.doc.text(rd + 'ª rodada', 40, b.y);
  const rows = ms.map((m) => {
    const x = matchMeta(m);
    return [fmtDateBR(x.date) || '—', state.teams[m.home]?.nome || '—', (m.hg != null ? m.hg : '–') + ' x ' + (m.ag != null ? m.ag : '–'), state.teams[m.away]?.nome || '—'];
  });
  b.doc.autoTable(Object.assign({}, b.opt, { startY: b.y + 8, head: [['Data', 'Mandante', 'Placar', 'Visitante']], body: rows, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'left' } } }));
  let y = b.doc.lastAutoTable.finalY + 18;
  const scor = scorerRanking(state).slice(0, 10);
  if (scor.length) {
    b.doc.setFont('helvetica', 'bold'); b.doc.text('Artilharia', 40, y);
    b.doc.autoTable(Object.assign({}, b.opt, { startY: y + 6, head: [['#', 'Atleta', 'Gols']], body: scor.map((r, i) => [i + 1, r.name, r.goals]) }));
  }
  b.doc.save(reportName(state, 'boletim_rodada_' + rd));
}

export function exportPDF(state) {
  if (typeof jsPDF !== 'function') return;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 46;
  const opt = { theme: 'grid', styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [26, 163, 83], textColor: 255 }, columnStyles: { 1: { halign: 'left' } }, margin: { left: 40, right: 40 } };
  const pageGuard = (need) => { if (y > 800 - (need || 40)) { doc.addPage(); y = 46; } };
  const sectionTitle = (txt) => { pageGuard(60); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(txt, 40, y); y += 4; };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 60, 40); doc.text(state.nome || 'Campeonato', 40, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120); doc.text((state.formato || 'liga') + '  ·  ' + new Date().toLocaleDateString('pt-BR'), 40, y + 16);
  doc.setTextColor(170); doc.setFont('helvetica', 'bold'); doc.text('ARENA', W - 40, y, { align: 'right' }); y += 40;
  const head = [['#', 'Equipe', 'P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', '%']];
  const blocks = [];
  if (state.formato === 'liga') blocks.push({ title: null, st: computeStandings(state.teams, state.teams.map((_, i) => i), state.matches || [], state.cfg || {}) });
  else if (state.formato === 'grupos') (state.grupos || []).forEach((g, gi) => { const idxs = g.map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0); blocks.push({ title: 'Grupo ' + String.fromCharCode(65 + gi), st: computeStandings(state.teams, idxs, (state.matches || []).filter((m) => (m.grupo || 0) === gi), state.cfg || {}) }); });
  else if (state.formato === 'gxg') (state.grupos || []).forEach((g, gi) => { const idxs = g.map((id) => state.teams.findIndex((t) => t.id === id)).filter((i) => i >= 0); blocks.push({ title: 'Grupo ' + String.fromCharCode(65 + gi), st: computeStandings(state.teams, idxs, state.matches || [], state.cfg || {}) }); });
  if (blocks.length) { sectionTitle('Classificação'); y += 6; blocks.forEach((b) => { if (b.title) { pageGuard(50); doc.setFontSize(11); doc.setTextColor(40); doc.text(b.title, 40, y); y += 4; } const rows = b.st.map((s, i) => [i + 1, state.teams[s.team]?.nome || '—', s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, (s.SG > 0 ? '+' : '') + s.SG, s.pct.toFixed(1)]); doc.autoTable(Object.assign({}, opt, { startY: y + 4, head, body: rows })); y = doc.lastAutoTable.finalY + 18; }); }
  const tn = (id) => { const i = state.teams.findIndex((x) => x.id === id); return i >= 0 ? state.teams[i].nome : '—'; };
  if (state.matches && state.matches.length) {
    sectionTitle('Tabela de jogos');
    let games;
    if (state.formato === 'grupos') games = (state.grupos || []).map((_, gi) => ({ label: 'Grupo ' + String.fromCharCode(65 + gi), ms: (state.matches || []).filter((m) => (m.grupo || 0) === gi) }));
    else if (state.formato === 'gxg') games = [{ label: 'Interzonas A × B', ms: state.matches || [] }];
    else games = [{ label: null, ms: state.matches || [] }];
    games.forEach((g) => { if (g.label) { y += 14; pageGuard(40); doc.setFontSize(11); doc.setTextColor(40); doc.text(g.label, 40, y); } const body = g.ms.slice().sort((a, b) => a.rodada - b.rodada).map((m) => { const sc = (m.hg != null && m.ag != null) ? `${m.hg} x ${m.ag}` : '– x –'; return [m.rodada + 'ª', tn(m.home), sc, tn(m.away), m.info || '']; }); doc.autoTable(Object.assign({}, opt, { startY: y + 8, head: [['Rod.', 'Mandante', 'Placar', 'Visitante', 'Data/Local']], body, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'left' }, 4: { halign: 'left', fontSize: 8 } } })); y = doc.lastAutoTable.finalY + 14; });
  }
  if (state.bracket) {
    sectionTitle('Chaveamento');
    const single = state.cfg?.maoUnica;
    const body = [];
    const rowFor = (t, fase) => { if (t.a == null && t.b == null) return; const sc = single ? `${t.ag1 ?? '-'} x ${t.bg1 ?? '-'}` : `${(t.ag1 == null && t.ag2 == null) ? '-' : ((t.ag1 || 0) + (t.ag2 || 0))} x ${(t.bg1 == null && t.bg2 == null) ? '-' : ((t.bg1 || 0) + (t.bg2 || 0))}`; const pen = (t.apen != null && t.bpen != null) ? ` (pên ${t.apen}x${t.bpen})` : ''; body.push([fase, tn(t.a) + ' x ' + tn(t.b), sc + pen, t.winner ? tn(t.winner) : '']); };
    (state.bracket.rounds || []).forEach((rd, idx) => { const size = rd.length * 2; rd.forEach((t) => rowFor(t, size + '-avos')); });
    if (state.bracket.third) rowFor(state.bracket.third, '3º lugar');
    doc.autoTable(Object.assign({}, opt, { startY: y + 8, head: [['Fase', 'Confronto', 'Placar', 'Classificado']], body, columnStyles: { 1: { halign: 'left' }, 3: { halign: 'left' } } })); y = doc.lastAutoTable.finalY + 16;
  }
  const sc = scorerRanking(state);
  if (sc.length) { sectionTitle('Artilharia'); doc.autoTable(Object.assign({}, opt, { startY: y + 8, head: [['#', 'Atleta', 'Equipe', 'Gols']], body: sc.map((r, i) => [i + 1, r.name, r.teamId ? tn(r.teamId) : '—', r.goals]), columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } })); y = doc.lastAutoTable.finalY + 16; }
  const cr = cardRanking(state);
  if (cr.length) { sectionTitle('Disciplina (cartões)'); doc.autoTable(Object.assign({}, opt, { startY: y + 8, head: [['#', 'Atleta', 'Equipe', 'Amarelos', 'Vermelhos']], body: cr.map((r, i) => [i + 1, r.name, r.teamId ? tn(r.teamId) : '—', r.y, r.r]), columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } })); y = doc.lastAutoTable.finalY + 16; }
  doc.save((state.nome || 'campeonato').replace(/[^\w\-]+/g, '_') + '.pdf');
}

function matchContext(state, kind, id) {
  if (kind === 'match') {
    const m = (state.matches || []).find((x) => x.id === id);
    if (!m) return null;
    let fase = 'Fase de classificação', rod = m.rodada + 'ª rodada';
    if (state.formato === 'grupos') fase = 'Grupo ' + String.fromCharCode(65 + (m.grupo || 0));
    else if (state.formato === 'gxg') fase = 'Interzonas (A × B)';
    else if (state.formato === 'liga') fase = 'Pontos corridos';
    const mx = matchMeta(m), vv = venueById(state, mx.venueId), rr = officialById(state, mx.refereeId), tt = officialById(state, mx.tableOfficialId);
    return { home: teamById(state, state.teams[m.home]?.id), away: teamById(state, state.teams[m.away]?.id), fase, rodada: rod, info: (m.info || ''), venue: vv, referee: rr, tableOfficial: tt };
  } else {
    const t = (state.bracket?.rounds || []).flat().find((x) => x.id === id) || (state.bracket?.third?.id === id ? state.bracket.third : null);
    if (!t) return null;
    let fase = 'Mata-mata';
    for (const rd of (state.bracket?.rounds || [])) { if (rd.includes(t)) { fase = (rd.length * 2) + '-avos'; break; } }
    if (state.bracket?.third?.id === id) fase = 'Disputa de 3º lugar';
    return { home: t.a ? teamById(state, t.a) : null, away: t.b ? teamById(state, t.b) : null, fase, rodada: '', info: [t.info1, t.info2].filter(Boolean).join('  |  ') };
  }
}

function splitInfo(info) {
  if (!info) return { data: '', hora: '', local: '' };
  const parts = info.split(/[·|]/).map((s) => s.trim());
  return { data: parts[0] || '', hora: parts[1] || '', local: parts.slice(2).join(' · ') || '' };
}

export function printSumula(state, kind, id) {
  if (typeof jsPDF !== 'function') return;
  const ctx = matchContext(state, kind, id);
  if (!ctx) return;
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), M = 38; let y = 40;
  const GREEN = [26, 163, 83], DARK = [20, 40, 30], GREY = [120, 120, 120], LINE = [200, 200, 200];
  doc.setFillColor(...GREEN); doc.rect(M, y, 26, 26, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('A', M + 8, y + 18);
  doc.setTextColor(...DARK); doc.setFontSize(16); doc.text('SÚMULA DE JOGO', M + 34, y + 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text('ARENA Campeonatos', M + 34, y + 24);
  doc.setFontSize(8); doc.text('Documento gerado pela ARENA — não substitui a súmula oficial.', W - M, y + 8, { align: 'right' });
  y += 40; doc.setDrawColor(...GREEN); doc.setLineWidth(1.4); doc.line(M, y, W - M, y); y += 16;
  const info = splitInfo(ctx.info);
  doc.setFontSize(10); doc.setTextColor(...DARK);
  const field = (label, val, x, w) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GREY); doc.text(label.toUpperCase(), x, y); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(x, y + 15, x + w, y + 15); if (val) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK); doc.text(String(val), x + 2, y + 12); } };
  const cw = (W - 2 * M);
  field('Campeonato', state.nome || '', M, cw * 0.62 - 8); field('Modalidade', 'Futebol', M + cw * 0.62, cw * 0.38); y += 30;
  field('Fase', ctx.fase || '', M, cw * 0.34 - 8); field('Rodada/Jogo', ctx.rodada || '', M + cw * 0.34, cw * 0.30 - 8); field('Data', info.data || '', M + cw * 0.64, cw * 0.18 - 6); field('Horário', info.hora || '', M + cw * 0.82, cw * 0.18); y += 30;
  field('Local', (ctx.venue && ctx.venue.name) || info.local || '', M, cw); y += 30;
  if (ctx.referee || ctx.tableOfficial) { field('Árbitro', ctx.referee ? ctx.referee.name : '', M, cw * 0.5 - 8); field('Mesário / auxiliar', ctx.tableOfficial ? ctx.tableOfficial.name : '', M + cw * 0.5, cw * 0.5); y += 34; } else y += 4;
  doc.save((state.nome || 'campeonato').replace(/[^\w\-]+/g, '_') + '_sumula.pdf');
}

export async function exportAthleteCards(state, categoryId) {
  if (typeof jsPDF !== 'function') return;
  const cat = (state.categories || []).find((c) => c.id === categoryId) || activeCategory(state);
  if (!cat) return;
  const athletes = [];
  (cat.teams || []).forEach((t) => (t.roster || []).forEach((a) => athletes.push({ a, t })));
  if (!athletes.length) return;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, m = 10, g = 5, cw = (W - 2 * m - g) / 2, ch = 58;
  let idx = 0;
  const qrDataURL = null;
  for (const it of athletes) {
    if (idx && idx % 8 === 0) doc.addPage();
    const slot = idx % 8, col = slot % 2, row = Math.floor(slot / 2), x = m + col * (cw + g), y = m + row * (ch + g);
    doc.setDrawColor(70); doc.roundedRect(x, y, cw, ch, 3, 3); doc.setFillColor(26, 163, 83); doc.roundedRect(x, y, cw, 12, 3, 3, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('ARENA  •  CREDENCIAL', x + 4, y + 7.5);
    doc.setTextColor(30); doc.setFontSize(12); doc.text((it.a.nome || 'Atleta').slice(0, 30), x + 4, y + 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Equipe: ' + (it.t.nome || '—').slice(0, 28), x + 4, y + 27); doc.text('Categoria: ' + (cat.nome || '—').slice(0, 25), x + 4, y + 33); doc.text('Nº: ' + (it.a.numero || '—') + '   Nasc.: ' + (it.a.dob || '—'), x + 4, y + 39);
    const token = [state.id, cat.id, it.t.id, it.a.id].join(':');
    const qr = qrDataURL;
    if (qr) doc.addImage(qr, 'PNG', x + cw - 24, y + 27, 19, 19);
    doc.setFontSize(7); doc.setTextColor(110); doc.text('ID ' + it.a.id.slice(0, 12), x + 4, y + 51);
    idx++;
  }
  doc.save(((state.nome || 'campeonato') + '_' + (cat.nome || 'categoria') + '_carteirinhas').replace(/[^\w\-]+/g, '_') + '.pdf');
}

export function viewRelatoriosHTML(state) {
  const rounds = [...new Set((state.matches || []).map((m) => m.rodada).filter(Boolean))].sort((a, b) => a - b);
  const card = (ic, title, desc, fn) => `<div class="card pad"><div style="font-size:26px">${ic}</div><h3 style="font-size:18px;margin-top:7px">${title}</h3><p class="muted" style="min-height:42px">${desc}</p><button class="btn ghost sm" data-export="${fn}">Gerar PDF</button></div>`;
  return `<div class="card pad"><h2 style="font-size:25px">📄 Central de documentos</h2><p class="muted">Gere documentos operacionais separados para a categoria e fase atualmente selecionadas.</p><div class="banner"><b>${esc(activeCategory(state)?.nome || '')}</b><span class="muted">›</span>${esc(activePhaseOf(activeCategory(state))?.nome || '')}<span style="margin-left:auto" class="tag">PDF</span></div></div><div class="report-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px">${card('🛡️', 'Equipes', 'Relação de equipes, quantidade de atletas e técnico.', 'teams')}${card('👥', 'Atletas', 'Relação nominal de atletas por equipe.', 'roster')}${card('📅', 'Tabela oficial', 'Agenda com datas, horários, locais e arbitragem.', 'schedule')}${card('🏆', 'Classificação', 'Classificação oficial com critérios da competição.', 'standings')}${card('⚽', 'Artilharia', 'Ranking de goleadores da competição.', 'scorers')}${card('🟨', 'Disciplina', 'Cartões, pontuação disciplinar negativa e suspensões.', 'discipline')}${card('🧑‍⚖️', 'Arbitragem', 'Escala de árbitros, mesários e locais.', 'officials')}${card('✅', 'Resultados', 'Resultados oficiais das partidas encerradas.', 'results')}<div class="card pad"><div style="font-size:26px">📰</div><h3 style="font-size:18px;margin-top:7px">Boletim da rodada</h3><p class="muted">Resultados da rodada e resumo da artilharia.</p><select data-report-round>${rounds.map((r) => `<option value="${r}">${r}ª rodada</option>`).join('') || '<option value="1">1ª rodada</option>'}</select><button class="btn ghost sm" data-export="round">Gerar PDF</button></div><div class="card pad"><div style="font-size:26px">📋</div><h3 style="font-size:18px;margin-top:7px">Súmula completa</h3><p class="muted">PDF completo com classificação, jogos, chaveamento, artilharia e disciplina.</p><button class="btn ghost sm" data-export="pdf">Gerar PDF</button></div><div class="card pad"><div style="font-size:26px">🪪</div><h3 style="font-size:18px;margin-top:7px">Carteirinhas</h3><p class="muted">Credenciais de atletas da categoria ativa.</p><button class="btn ghost sm" data-export="cards">Gerar PDF</button></div></div>`;
}
