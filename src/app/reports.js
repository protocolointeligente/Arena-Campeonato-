import { computeStandings, scorerRanking, cardRanking, suspensionInfo } from './standings.js';
import { matchMeta } from './matches.js';
import { venueById, officialById } from './ops.js';
import { teamById } from './roster.js';
import { activeCategory } from './categories.js';
import { activePhaseOf } from './phases.js';
import { fmtDateBR } from './format.js';
import { esc } from './utils.ts';
import { 
  getJsPDF, 
  resolveCategories, 
  resolveTeams, 
  resolveMatches, 
  resolveGroups, 
  resolveConfig, 
  resolveFormat,
  makeReportName,
  DEFAULT_TABLE_OPT,
  createReportDoc,
  formatStandingsHead,
  formatStandingsRows,
} from './pdf-utils.js';

export async function reportBase(state, title, subtitle, categoryName, phaseName) {
  const b = await createReportDoc(state, title, subtitle, categoryName, phaseName);
  return b;
}

export function reportName(state, suffix, categoryName) {
  return makeReportName(state, suffix, categoryName);
}

export function reportStandingsBlocks(state, category) {
  const blocks = [];
  const phase = activePhaseOf(category);
  const cfg = phase?.cfg || category.cfg || state.cfg || {};
  const formato = resolveFormat(category, state);
  const teams = resolveTeams(category, state);
  const matches = resolveMatches(category, state);
  
  if (formato === 'liga') {
    const idxs = teams.map((_, i) => i);
    blocks.push({ title: 'Classificação', st: computeStandings(teams, idxs, matches, cfg) });
  } else if (formato === 'grupos' || formato === 'gxg') {
    const grupos = resolveGroups(category, state);
    grupos.forEach((g, gi) => {
      const idxs = g.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const ms = matches.filter((m) => (m.grupo || 0) === gi);
      blocks.push({ title: `Grupo ${  String.fromCharCode(65 + gi)}`, st: computeStandings(teams, idxs, ms, cfg) });
    });
  }
  return blocks;
}

export async function exportTeamsReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Relação de equipes', '', cat.nome);
    if (!b) {return;}
    const teams = resolveTeams(cat, state);
    const rows = teams.map((t, i) => [i + 1, t.nome, (t.roster || []).length, (t.staff && t.staff.tecnico) || '—']);
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['#', 'Equipe', 'Atletas', 'Técnico']], body: rows, columnStyles: { 1: { halign: 'left' }, 3: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'equipes', cat.nome));
  }
}

export async function exportRosterReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Relação nominal de atletas', '', cat.nome);
    if (!b) {return;}
    let y = b.y;
    const teams = resolveTeams(cat, state);
    teams.forEach((t) => {
      if (y > 720) { b.doc.addPage(); y = 50; }
      b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(11); b.doc.setTextColor(40); b.doc.text(t.nome, 40, y);
      const rows = (t.roster || []).map((a, i) => [i + 1, a.nome, a.numero || '—', a.dob || '—']);
      b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 6, head: [['#', 'Atleta', 'Nº', 'Nascimento']], body: rows.length ? rows : [['—', 'Nenhum atleta cadastrado', '—', '—']], columnStyles: { 1: { halign: 'left' } } });
      y = b.doc.lastAutoTable.finalY + 18;
    });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'atletas', cat.nome));
  }
}

export async function exportScheduleReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Tabela oficial de jogos', '', cat.nome);
    if (!b) {return;}
    const matches = resolveMatches(cat, state);
    const teams = resolveTeams(cat, state);
    const rows = matches.slice().sort((a, c) => {
      const A = matchMeta(a), C = matchMeta(c);
      return ((A.date || '9999') + (A.time || '99')).localeCompare((C.date || '9999') + (C.time || '99'));
    }).map((m) => {
      const x = matchMeta(m), v = venueById(state, x.venueId), r = officialById(state, x.refereeId);
      return [m.rodada || '—', fmtDateBR(x.date) || '—', x.time || '—', teams[m.home]?.nome || '—', teams[m.away]?.nome || '—', v?.name || '—', r?.name || '—'];
    });
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['Rod.', 'Data', 'Hora', 'Mandante', 'Visitante', 'Local', 'Árbitro']], body: rows, columnStyles: { 3: { halign: 'left' }, 4: { halign: 'left' }, 5: { halign: 'left' }, 6: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'tabela_jogos', cat.nome));
  }
}

export async function exportStandingsReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Classificação oficial', '', cat.nome);
    if (!b) {return;}
    let y = b.y;
    const cfg = resolveConfig(cat, state);
    const teams = resolveTeams(cat, state);
    
    reportStandingsBlocks(state, cat).forEach((bl) => {
      b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(11); b.doc.setTextColor(40); b.doc.text(bl.title, 40, y);
      const head = formatStandingsHead(cfg, state.scoreType);
      const rows = formatStandingsRows(teams, bl.st, cfg);
      b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 6, head: [head], body: rows, columnStyles: { 1: { halign: 'left' } } });
      y = b.doc.lastAutoTable.finalY + 18;
    });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'classificacao', cat.nome));
  }
}

export async function exportScorersReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Artilharia', '', cat.nome);
    if (!b) {return;}
    const teams = resolveTeams(cat, state);
    const rows = scorerRanking(state).filter(r => r.teamId && teams.find(t => t.id === r.teamId)).map((r, i) => [i + 1, r.name, r.teamId ? (teamById(state, r.teamId)?.nome || '—') : '—', r.goals]);
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['#', 'Atleta', 'Equipe', 'Gols']], body: rows, columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'artilharia', cat.nome));
  }
}

export async function exportDisciplineReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Disciplina e suspensões', `Amarelo −${  cat.cfg?.discYellow ?? state.cfg?.discYellow ?? 1  } · Vermelho −${  cat.cfg?.discRed ?? state.cfg?.discRed ?? 2}`, cat.nome);
    if (!b) {return;}
    const rows = [];
    const teams = resolveTeams(cat, state);
    teams.forEach((t) => (t.roster || []).forEach((a) => {
      const si = suspensionInfo(state, a.id), cr = cardRanking(state).find((x) => x.athleteId === a.id);
      if (cr || si.suspended) {rows.push([a.nome, t.nome, cr?.y || 0, cr?.r || 0, -((cr?.y || 0) * (cat.cfg?.discYellow ?? state.cfg?.discYellow ?? 1) + (cr?.r || 0) * (cat.cfg?.discRed ?? state.cfg?.discRed ?? 2)), si.suspended ? 'SUSPENSO' : 'Liberado']);}
    }));
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['Atleta', 'Equipe', 'A', 'V', 'Disc.', 'Situação']], body: rows, columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'disciplina', cat.nome));
  }
}

export async function exportOfficialsReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Escala de arbitragem', '', cat.nome);
    if (!b) {return;}
    const teams = resolveTeams(cat, state);
    const matches = resolveMatches(cat, state);
    const rows = matches.map((m) => {
      const x = matchMeta(m), r = officialById(state, x.refereeId), t = officialById(state, x.tableOfficialId), v = venueById(state, x.venueId);
      return [fmtDateBR(x.date) || '—', x.time || '—', `${teams[m.home]?.nome || '—'  } x ${  teams[m.away]?.nome || '—'}`, r?.name || '—', t?.name || '—', v?.name || '—'];
    });
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['Data', 'Hora', 'Partida', 'Árbitro', 'Mesário', 'Local']], body: rows, columnStyles: { 2: { halign: 'left' }, 3: { halign: 'left' }, 4: { halign: 'left' }, 5: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'arbitragem', cat.nome));
  }
}

export async function exportResultsReport(state) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Resultados', '', cat.nome);
    if (!b) {return;}
    const teams = resolveTeams(cat, state);
    const matches = resolveMatches(cat, state);
    const rows = matches.filter((m) => m.hg != null && m.ag != null).map((m) => {
      const x = matchMeta(m);
      return [m.rodada || '—', fmtDateBR(x.date) || '—', teams[m.home]?.nome || '—', `${m.hg  } x ${  m.ag}`, teams[m.away]?.nome || '—'];
    });
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y, head: [['Rod.', 'Data', 'Mandante', 'Placar', 'Visitante']], body: rows, columnStyles: { 2: { halign: 'right' }, 4: { halign: 'left' } } });
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, 'resultados', cat.nome));
  }
}

export async function exportRoundBulletin(state, roundNumber) {
  const categories = resolveCategories(state);
  for (const cat of categories) {
    const b = await reportBase(state, 'Boletim da rodada', '', cat.nome);
    if (!b) {return;}
    const matches = resolveMatches(cat, state);
    const rounds = [...new Set(matches.map((m) => m.rodada).filter(Boolean))].sort((a, c) => a - c);
    const rd = +roundNumber || rounds[rounds.length - 1] || 1;
    const ms = matches.filter((m) => m.rodada === rd);
    b.doc.setFont('helvetica', 'bold'); b.doc.setFontSize(12); b.doc.setTextColor(40); b.doc.text(`${rd  }ª rodada`, 40, b.y);
    const teams = resolveTeams(cat, state);
    const rows = ms.map((m) => {
      const x = matchMeta(m);
      return [fmtDateBR(x.date) || '—', teams[m.home]?.nome || '—', `${m.hg != null ? m.hg : '–'  } x ${  m.ag != null ? m.ag : '–'}`, teams[m.away]?.nome || '—'];
    });
    b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: b.y + 8, head: [['Data', 'Mandante', 'Placar', 'Visitante']], body: rows, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'left' } } });
    const y = b.doc.lastAutoTable.finalY + 18;
    const scor = scorerRanking(state).filter(r => r.teamId && (resolveTeams(cat, state)).find(t => t.id === r.teamId)).slice(0, 10);
    if (scor.length) {
      b.doc.setFont('helvetica', 'bold'); b.doc.text('Artilharia', 40, y);
      b.doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 6, head: [['#', 'Atleta', 'Gols']], body: scor.map((r, i) => [i + 1, r.name, r.goals]) });
    }
    if (categories.length > 1) {b.doc.addPage();}
    b.doc.save(makeReportName(state, `boletim_rodada_${  rd}`, cat.nome));
  }
}

export async function exportPDF(state) {
  const jsPDF = await getJsPDF();
  const categories = resolveCategories(state);
  
  for (const cat of categories) {
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 46;
    const opt = { ...DEFAULT_TABLE_OPT };
    const pageGuard = (need) => { if (y > 800 - (need || 40)) { doc.addPage(); y = 46; } };
    const sectTitle = (txt) => { pageGuard(60); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(txt, 40, y); y += 4; };
    
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 60, 40); doc.text(state.nome || 'Campeonato', 40, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120); doc.text(`${state.formato || 'liga'  }  ·  ${  new Date().toLocaleDateString('pt-BR')}`, 40, y + 16);
    doc.setTextColor(170); doc.setFont('helvetica', 'bold'); doc.text('ARENA', W - 40, y, { align: 'right' }); y += 40;
    
    const cat = resolveCategories(state).find(c => c.id === state.activeCategoryId) || resolveCategories(state)[0];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(cat.nome || 'Categoria', 40, y); y += 18;
    
    const blocks = [];
    const teams = resolveTeams(cat, state);
    const matches = resolveMatches(cat, state);
    const grupos = resolveGroups(cat, state);
    const cfg = resolveConfig(cat, state);
    const formato = resolveFormat(cat, state);
    const usesSets = state.scoreType === 'sets' || cfg.scoreType === 'sets';
    const head = [['#', 'Equipe', 'P', 'J', 'V', 'E', 'D', usesSets ? 'SP' : 'GP', usesSets ? 'SC' : 'GC', usesSets ? 'SS' : 'SG', '%']];
    
    if (formato === 'liga') {blocks.push({ title: null, st: computeStandings(teams, teams.map((_, i) => i), matches, cfg) });}
    else if (formato === 'grupos') {grupos.forEach((g, gi) => { const idxs = g.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0); blocks.push({ title: `Grupo ${  String.fromCharCode(65 + gi)}`, st: computeStandings(teams, idxs, matches.filter((m) => (m.grupo || 0) === gi), cfg) }); });}
    else if (formato === 'gxg') {grupos.forEach((g, gi) => { const idxs = g.map((id) => teams.findIndex((t) => t.id === id)).filter((i) => i >= 0); blocks.push({ title: `Grupo ${  String.fromCharCode(65 + gi)}`, st: computeStandings(teams, idxs, matches, cfg) }); });}
    
    if (blocks.length) { 
      const sectTitle = (txt) => { if (y > 760) { doc.addPage(); y = 46; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(txt, 40, y); y += 4; };
      sectTitle('Classificação'); y += 6; 
      blocks.forEach((b) => { 
        if (b.title) { if (y > 760) { doc.addPage(); y = 46; } doc.setFontSize(11); doc.setTextColor(40); doc.text(b.title, 40, y); y += 4; } 
        const rows = b.st.map((s, i) => [i + 1, teams[s.team]?.nome || '—', s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, (s.SG > 0 ? '+' : '') + s.SG, s.pct.toFixed(1)]); 
        doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 4, head, body: rows }); 
        y = doc.lastAutoTable.finalY + 18; 
      }); 
    }
    
    const tn = (id) => { const i = teams.findIndex((x) => x.id === id); return i >= 0 ? teams[i].nome : '—'; };
    
    if (matches && matches.length) {
      const sectTitle = (txt) => { if (y > 760) { doc.addPage(); y = 46; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text(txt, 40, y); y += 4; };
      sectTitle('Tabela de jogos');
      let games;
      if (formato === 'grupos') {games = grupos.map((_, gi) => ({ label: `Grupo ${  String.fromCharCode(65 + gi)}`, ms: matches.filter((m) => (m.grupo || 0) === gi) }));}
      else if (formato === 'gxg') {games = [{ label: 'Interzonas A × B', ms: matches }];}
      else {games = [{ label: null, ms: matches }];}
      
      games.forEach((g) => { 
        if (g.label) { y += 14; if (y > 760) { doc.addPage(); y = 46; } doc.setFontSize(11); doc.setTextColor(40); doc.text(g.label, 40, y); } 
        const body = g.ms.slice().sort((a, b) => a.rodada - b.rodada).map((m) => { 
          const sc = (m.hg != null && m.ag != null) ? `${m.hg} x ${m.ag}` : '– x –'; 
          return [`${m.rodada  }ª`, tn(m.home), sc, tn(m.away), m.info || '']; 
        }); 
        doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 8, head: [['Rod.', 'Mandante', 'Placar', 'Visitante', 'Data/Local']], body, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'left' }, 4: { halign: 'left', fontSize: 8 } } }); 
        y = doc.lastAutoTable.finalY + 14; 
      });
    }
    
    if (cat.bracket || state.bracket) {
      const bracket = cat.bracket || state.bracket;
      if (y > 700) { doc.addPage(); y = 46; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text('Chaveamento', 40, y); y += 18;
      const single = cfg?.maoUnica;
      const body = [];
      const rowFor = (t, fase) => { if (t.a == null && t.b == null) {return;} const sc = single ? `${t.ag1 ?? '-'} x ${t.bg1 ?? '-'}` : `${(t.ag1 == null && t.ag2 == null) ? '-' : ((t.ag1 || 0) + (t.ag2 || 0))} x ${(t.bg1 == null && t.bg2 == null) ? '-' : ((t.bg1 || 0) + (t.bg2 || 0))}`; const pen = (t.apen != null && t.bpen != null) ? ` (pên ${t.apen}x${t.bpen})` : ''; body.push([fase, `${tn(t.a)  } x ${  tn(t.b)}`, sc + pen, t.winner ? tn(t.winner) : '']); };
      (bracket.rounds || []).forEach((rd, idx) => { const size = rd.length * 2; rd.forEach((t) => rowFor(t, `${size  }-avos`)); });
      if (bracket.third) {rowFor(bracket.third, '3º lugar');}
      doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 8, head: [['Fase', 'Confronto', 'Placar', 'Classificado']], body, columnStyles: { 1: { halign: 'left' }, 3: { halign: 'left' } } }); y = doc.lastAutoTable.finalY + 16;
    }
    
    const sc = scorerRanking(state).filter(r => r.teamId && teams.find(t => t.id === r.teamId));
    if (sc.length) { if (y > 700) { doc.addPage(); y = 46; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text('Artilharia', 40, y); y += 18; doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 8, head: [['#', 'Atleta', 'Equipe', 'Gols']], body: sc.map((r, i) => [i + 1, r.name, r.teamId ? tn(r.teamId) : '—', r.goals]), columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } }); y = doc.lastAutoTable.finalY + 16; }
    
    const cr = cardRanking(state).filter(r => r.teamId && teams.find(t => t.id === r.teamId));
    if (cr.length) { if (y > 700) { doc.addPage(); y = 46; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(26, 120, 70); doc.text('Disciplina (cartões)', 40, y); y += 18; doc.autoTable({ ...DEFAULT_TABLE_OPT, startY: y + 8, head: [['#', 'Atleta', 'Equipe', 'Amarelos', 'Vermelhos']], body: cr.map((r, i) => [i + 1, r.name, r.teamId ? tn(r.teamId) : '—', r.y, r.r]), columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } } }); y = doc.lastAutoTable.finalY + 16; }
    
    if (resolveCategories(state).length > 1) {
      doc.addPage();
    }
    doc.save(`${(state.nome || 'campeonato').replace(/[^\w-]+/g, '_')  }.pdf`);
  }
}
function matchContext(state, kind, id) {
  if (kind === 'match') {
    const m = (state.matches || []).find((x) => x.id === id);
    if (!m) {return null;}
    let fase = 'Fase de classificação'; const rod = `${m.rodada  }ª rodada`;
    if (state.formato === 'grupos') {fase = `Grupo ${  String.fromCharCode(65 + (m.grupo || 0))}`;}
    else if (state.formato === 'gxg') {fase = 'Interzonas (A × B)';}
    else if (state.modelo === 'swiss') {fase = 'Sistema suíço';}
    else if (state.formato === 'liga') {fase = 'Pontos corridos';}
    const mx = matchMeta(m), vv = venueById(state, mx.venueId), rr = officialById(state, mx.refereeId), tt = officialById(state, mx.tableOfficialId);
    return { home: teamById(state, state.teams[m.home]?.id), away: teamById(state, state.teams[m.away]?.id), fase, rodada: rod, info: (m.info || ''), venue: vv, referee: rr, tableOfficial: tt };
  } else {
    const t = (state.bracket?.rounds || []).flat().find((x) => x.id === id) || (state.bracket?.third?.id === id ? state.bracket.third : null);
    if (!t) {return null;}
    let fase = 'Mata-mata';
    for (const rd of (state.bracket?.rounds || [])) { if (rd.includes(t)) { fase = `${rd.length * 2  }-avos`; break; } }
    if (state.bracket?.third?.id === id) {fase = 'Disputa de 3º lugar';}
    return { home: t.a ? teamById(state, t.a) : null, away: t.b ? teamById(state, t.b) : null, fase, rodada: '', info: [t.info1, t.info2].filter(Boolean).join('  |  ') };
  }
}

function splitInfo(info) {
  if (!info) {return { data: '', hora: '', local: '' };}
  const parts = info.split(/[·|]/).map((s) => s.trim());
  return { data: parts[0] || '', hora: parts[1] || '', local: parts.slice(2).join(' · ') || '' };
}

export async function printSumula(state, kind, id) {
  const { jsPDF } = await import('jspdf');
  const ctx = matchContext(state, kind, id);
  if (!ctx) {return;}
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
  if (ctx.referee || ctx.tableOfficial) { field('Árbitro', ctx.referee ? ctx.referee.name : '', M, cw * 0.5 - 8); field('Mesário / auxiliar', ctx.tableOfficial ? ctx.tableOfficial.name : '', M + cw * 0.5, cw * 0.5); y += 34; } else {y += 4;}
  doc.save(`${(state.nome || 'campeonato').replace(/[^\w-]+/g, '_')  }_sumula.pdf`);
}

export async function exportAthleteCards(state, categoryId) {
  const { jsPDF } = await import('jspdf');
  const cat = (state.categories || []).find((c) => c.id === categoryId) || activeCategory(state);
  if (!cat) {return;}
  const athletes = [];
  (cat.teams || []).forEach((t) => (t.roster || []).forEach((a) => athletes.push({ a, t })));
  if (!athletes.length) {return;}
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, m = 10, g = 5, cw = (W - 2 * m - g) / 2, ch = 58;
  let idx = 0;
  for (const it of athletes) {
    if (idx && idx % 8 === 0) {doc.addPage();}
    const slot = idx % 8, col = slot % 2, row = Math.floor(slot / 2), x = m + col * (cw + g), y = m + row * (ch + g);
    doc.setDrawColor(70); doc.roundedRect(x, y, cw, ch, 3, 3); doc.setFillColor(26, 163, 83); doc.roundedRect(x, y, cw, 12, 3, 3, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('ARENA  •  CREDENCIAL', x + 4, y + 7.5);
    doc.setTextColor(30); doc.setFontSize(12); doc.text((it.a.nome || 'Atleta').slice(0, 30), x + 4, y + 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Equipe: ${  (it.t.nome || '—').slice(0, 28)}`, x + 4, y + 27); doc.text(`Categoria: ${  (cat.nome || '—').slice(0, 25)}`, x + 4, y + 33); doc.text(`Nº: ${  it.a.numero || '—'  }   Nasc.: ${  it.a.dob || '—'}`, x + 4, y + 39);
    doc.setFontSize(7); doc.setTextColor(110); doc.text(`ID ${  it.a.id.slice(0, 12)}`, x + 4, y + 51);
    idx++;
  }
  doc.save(`${(`${state.nome || 'campeonato'  }_${  cat.nome || 'categoria'  }_carteirinhas`).replace(/[^\w-]+/g, '_')  }.pdf`);
}

export function viewRelatoriosHTML(state) {
  const rounds = [...new Set((state.matches || []).map((m) => m.rodada).filter(Boolean))].sort((a, c) => a - c);
  const card = (ic, title, desc, fn) => `<div class="card pad"><div style="font-size:26px">${ic}</div><h3 style="font-size:18px;margin-top:7px">${title}</h3><p class="muted" style="min-height:42px">${desc}</p><button class="btn ghost sm" data-export="${fn}">Gerar PDF</button></div>`;
  return `<div class="card pad"><h2 style="font-size:25px">📄 Central de documentos</h2><p class="muted">Gere documentos operacionais separados para a categoria e fase atualmente selecionadas.</p><div class="banner"><b>${esc(activeCategory(state)?.nome || '')}</b><span class="muted">›</span>${esc(activePhaseOf(activeCategory(state))?.nome || '')}<span style="margin-left:auto" class="tag">PDF</span></div></div><div class="report-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px">${card('🛡️', 'Equipes', 'Relação de equipes, quantidade de atletas e técnico.', 'teams')}${card('👥', 'Atletas', 'Relação nominal de atletas por equipe.', 'roster')}${card('📅', 'Tabela oficial', 'Agenda com datas, horários, locais e arbitragem.', 'schedule')}${card('🏆', 'Classificação', 'Classificação oficial com critérios da competição.', 'standings')}${card('⚽', 'Artilharia', 'Ranking de goleadores da competição.', 'scorers')}${card('🟨', 'Disciplina', 'Cartões, pontuação disciplinar negativa e suspensões.', 'discipline')}${card('🧑‍⚖️', 'Arbitragem', 'Escala de árbitros, mesários e locais.', 'officials')}${card('✅', 'Resultados', 'Resultados oficiais das partidas encerradas.', 'results')}<div class="card pad"><div style="font-size:26px">📰</div><h3 style="font-size:18px;margin-top:7px">Boletim da rodada</h3><p class="muted">Resultados da rodada e resumo da artilharia.</p><select data-report-round>${rounds.map((r) => `<option value="${r}">${r}ª rodada</option>`).join('') || '<option value="1">1ª rodada</option>'}</select><button class="btn ghost sm" data-export="round">Gerar PDF</button></div><div class="card pad"><div style="font-size:26px">📋</div><h3 style="font-size:18px;margin-top:7px">Súmula completa</h3><p class="muted">PDF completo com classificação, jogos, chaveamento, artilharia e disciplina.</p><button class="btn ghost sm" data-export="pdf">Gerar PDF</button></div><div class="card pad"><div style="font-size:26px">🪪</div><h3 style="font-size:18px;margin-top:7px">Carteirinhas de atletas</h3><p class="muted">Gera credenciais individuais para cada atleta.</p><button class="btn ghost sm" data-export="cards">Gerar PDF</button></div>`;
}


