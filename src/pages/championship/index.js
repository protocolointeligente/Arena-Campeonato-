import { navigate } from '../../app/router-v2.js';
import { getChampionship, saveChampionship, checkSlugAvailable } from '../../services/championships.js';
import { listRegistrations, updateRegistration } from '../../services/registrations.js';
import { addAudit, listAudit } from '../../services/audit.js';
import { downloadChampionshipPDF } from '../../services/pdf.js';
import { esc, uid } from '../../app/utils.js';
import { slugify } from '../../app/format.js';
import { toast, modal, closeModal } from '../../app/ui.js';
import { auth } from '../../services/firebase.js';
import { isSuperadmin } from '../../services/superadmin.js';
import { uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, uploadAnnouncementPhoto } from '../../services/storage.js';
import { championshipJSON, parseChampionshipImport } from '../../app/exports.js';
import { exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML } from '../../app/reports.js';
import { createChampionshipStore } from '../../app/championship-store.js';
import { isOwner, can, roleLabel, mutationPermission, inviteManager, removeManager, changeManagerRole, ensureCollaborators } from '../../app/collaborators.js';
import { rosterModalHTML } from '../../app/roster-modal.js';
import { findTie } from '../../app/engine.js';
import { matchMeta } from '../../app/matches.js';
import { suspensionInfo, critMove, critRemove, critAdd } from '../../app/standings.js';
import { teamById } from '../../app/roster.js';
import { renderOverview } from './tabs/overview.js';
import { renderCategories } from './tabs/categories.js';
import { renderPhases } from './tabs/phases.js';
import { renderGames } from './tabs/games.js';
import { renderBracket } from './tabs/bracket.js';
import { renderStandings } from './tabs/standings.js';
import { renderTeams } from './tabs/teams.js';
import { renderScorers } from './tabs/scorers.js';
import { renderDiscipline } from './tabs/discipline.js';
import { renderRegistrations, bindRegistrationSearch } from './tabs/registrations.js';
import { renderPublication } from './tabs/publication.js';
import { createQrDataUrl, downloadMatchCard } from '../publication.js';
import { enqueueSync, flushSync, pendingSync } from '../../app/offline-queue.js';
import { renderHistory } from './tabs/history.js';
import { renderManagement } from './tabs/management.js';
import { renderConfig } from './tabs/config.js';
import { renderDocuments } from './tabs/documents.js';
import { renderScoreboardControl } from './tabs/scoreboard-control.js';
import { MODALITIES, COMPETITION_MODELS } from '../../app/templates.js';

const TAB_RENDERERS = {
  overview: renderOverview,
  placar: renderScoreboardControl,
  categorias: renderCategories,
  fases: renderPhases,
  jogos: renderGames,
  chave: renderBracket,
  classif: renderStandings,
  equipes: renderTeams,
  artilharia: renderScorers,
  disciplina: renderDiscipline,
  inscricoes: renderRegistrations,
  publicacao: renderPublication,
  historico: renderHistory,
  gerenciamento: renderManagement,
  config: renderConfig,
  documentos: renderDocuments,
};

export async function renderChampionship(root, id) {
  root.innerHTML = `<div class="shell"><header class="topbar"><a class="logo" href="/" data-link>ARENA</a><button class="btn ghost" data-back>← Meus campeonatos</button></header><main class="section" role="main"><div class="card">Carregando campeonato...</div></main></div>`;
  root.querySelector('[data-back]').onclick = () => navigate('/');
  
  try {
    const championship = await getChampionship(id);
    if (!championship) {throw new Error('Campeonato não encontrado.');}
    await mount(root, championship);
  } catch (error) {
    root.querySelector('main').innerHTML = `<div class="card"><h2>Não foi possível abrir</h2><p class="muted">${esc(error.message || error)}</p><button class="btn ghost" data-back>← Voltar</button></div>`;
    root.querySelector('[data-back]').onclick = () => navigate('/');
  }
}

async function mount(root, initial) {
  const store = createChampionshipStore(initial);
  let tab = 'overview';
  let placarTarget = null;
  let registrations = [];
  let auditRows = [];
  let superadmin = false;
  
  isSuperadmin().then((v) => { superadmin = v; }).catch(() => {});
  
  const accent = initial.branding?.accent || '#2fcf6b';
  
  root.querySelector('main').innerHTML = `
    <div class="championship-shell" style="--championship-accent:${accent}">
      <header class="championship-heading" role="banner">
        <div>
          <button class="btn ghost sm" data-back>← Meus campeonatos</button>
          <small>${esc(MODALITIES[initial.modalidade]?.label || initial.modalidade || 'Futebol')} · ${esc(COMPETITION_MODELS[initial.modelo]?.label || initial.formato || 'Liga')}</small>
          <h1>${esc(initial.nome)}</h1>
          <p class="muted">${esc(initial.subtitulo || 'Organize sua competição em um só lugar.')}</p>
        </div>
        <div class="actions">
          <button class="btn" data-pdf>Baixar relatório</button>
          <span class="tag" data-save>Salvo</span>
          <span class="tag">${esc(roleLabel(initial, auth.currentUser))}</span>
        </div>
      </header>
      <div data-categorybar role="navigation" aria-label="Categorias do campeonato"></div>
      <nav class="championship-tabs" role="tablist" aria-label="Abas do campeonato">
        ${[['overview','Visão geral'],['categorias','Categorias'],['fases','Fases'],['jogos','Jogos'],['chave','Chaveamento'],['classif','Tabela'],['equipes','Equipes'],['artilharia','Artilharia'],['disciplina','Disciplina'],['inscricoes','Inscrições'],['publicacao','Publicação'],['historico','Histórico'],['gerenciamento','Gerenciamento'],['config','Configurações'],['documentos','Documentos']]
          .map(([key,label]) => `<button role="tab" data-tab="${key}" aria-selected="false" tabindex="-1">${label}</button>`).join('')}
      </nav>
      <section role="tabpanel" data-content aria-live="polite"></section>
    </div>
  `;
  
  const shell = root.querySelector('.championship-shell');
  const content = root.querySelector('[data-content]');
  const saveTag = root.querySelector('[data-save]');
  
  root.querySelector('[data-back]').onclick = () => navigate('/');
  
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.onclick = async () => {
      tab = button.dataset.tab;
      if (tab === 'inscricoes') {
        try { registrations = await listRegistrations(store.getState().id); } catch { registrations = []; }
      }
      if (tab === 'historico') {
        try { auditRows = await listAudit(store.getState().id); } catch { auditRows = []; }
      }
      render();
    };
  });
  
  async function persist() {
    if (!superadmin && !can(store.getState(), auth.currentUser, mutationPermission(tab))) {
      toast('Seu perfil não tem permissão para esta ação.');
      return;
    }
    saveTag.textContent = 'Salvando...';
    const state = store.persist();
    state.updated = Date.now();
    try {
      await saveChampionship(state);
      saveTag.textContent = 'Salvo';
    } catch (error) {
      enqueueSync(state);
      saveTag.textContent = 'Erro ao salvar';
      toast(navigator.onLine ? (error.message || 'Não foi possível salvar.') : 'Sem conexão. Alteração guardada para sincronizar.');
    }
  }

  window.addEventListener('online', async () => {
    if (!pendingSync().length) {return;}
    const result = await flushSync(saveChampionship);
    if (result.processed) {toast(`${result.processed} alteração(ões) sincronizada(s).`);}
  }, { once: true });
  
  function render() {
    root.querySelectorAll('[data-tab]').forEach((button) => {
      const isActive = button.dataset.tab === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive);
      button.tabIndex = isActive ? 0 : -1;
    });
    root.querySelector('[data-categorybar]').innerHTML = renderCategoryBar(store.getState());
    content.innerHTML = TAB_RENDERERS[tab] ? TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators, placarTarget }) : '';
    content.setAttribute('aria-label', tab);
  bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, setPlacarTarget: (id, kind) => { placarTarget = { id, kind }; }, render, registrations, auditRows, superadmin });
  bindRegistrationSearch(root);
  }
  
  function renderCategoryBar(state) {
    if (!state.categories || state.categories.length < 2) {return '';}
    return `<div class="catbar" role="tablist" aria-label="Categorias">${state.categories.map((category) => `<button class="catpill ${category.id === state.activeCategoryId ? 'active' : ''}" data-category="${esc(category.id)}" role="tab" aria-selected="${category.id === state.activeCategoryId}" tabindex="${category.id === state.activeCategoryId ? 0 : -1}">${esc(category.nome)}</button>`).join('')}</div>`;
  }
  
  store.subscribe(() => {
    const state = store.getState();
    shell.style.setProperty('--championship-accent', state.branding?.accent || '#2fcf6b');
    root.querySelector('[data-categorybar]').innerHTML = renderCategoryBar(state);
    if (TAB_RENDERERS[tab]) {
      content.innerHTML = TAB_RENDERERS[tab](store, { registrations, auditRows, superadmin, persist, tab, setTab: (t) => { tab = t; }, esc, toast, modal, closeModal, navigate, uid, auth, addAudit, downloadChampionshipPDF, championshipJSON, exportTeamsReport, exportRosterReport, exportScheduleReport, exportStandingsReport, exportScorersReport, exportDisciplineReport, exportOfficialsReport, exportResultsReport, exportRoundBulletin, exportPDF, printSumula, exportAthleteCards, viewRelatoriosHTML, uploadBrandImage, uploadSponsorLogo, deleteImageByUrl, uploadAthletePhoto, uploadTeamLogo, listRegistrations, updateRegistration, listAudit, isSuperadmin, isOwner, can, roleLabel, inviteManager, removeManager, changeManagerRole, ensureCollaborators, placarTarget });
      content.setAttribute('aria-label', tab);
    bindEvents(root, store, { persist, tab, setTab: (t) => { tab = t; }, setPlacarTarget: (id, kind) => { placarTarget = { id, kind }; }, render, registrations, auditRows, superadmin });
    bindRegistrationSearch(root);
  }
    // Update tab ARIA attributes after re-render
    root.querySelectorAll('[data-tab]').forEach((button) => {
      const isActive = button.dataset.tab === tab;
      button.setAttribute('aria-selected', isActive);
      button.tabIndex = isActive ? 0 : -1;
    });
  });
  
  render();
}

function bindEvents(root, store, ctx) {
  const { persist, tab, setTab, setPlacarTarget, render, registrations, auditRows, superadmin } = ctx;

  root.querySelectorAll('[data-approve-registration]').forEach((button) => button.onclick = async () => {
    if (!superadmin && !can(store.getState(), auth.currentUser, 'registrations')) {return toast('Seu perfil não pode analisar inscrições.');}
    button.disabled = true;
    try {
      await updateRegistration(store.getState().id, button.dataset.approveRegistration, { status: 'approved', reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid || null });
      const item = registrations.find((entry) => entry.id === button.dataset.approveRegistration);
      if (item) {item.status = 'approved';}
      await addAudit(store.getState().id, 'registration_approved', `Inscrição aprovada: ${item?.teamName || button.dataset.approveRegistration}`);
      render();
    } catch (error) {button.disabled = false; toast(error.message || 'Não foi possível aprovar a inscrição.');}
  });
  root.querySelectorAll('[data-reject-registration]').forEach((button) => button.onclick = async () => {
    if (!superadmin && !can(store.getState(), auth.currentUser, 'registrations')) {return toast('Seu perfil não pode analisar inscrições.');}
    if (!confirm('Recusar esta inscrição?')) {return;}
    button.disabled = true;
    try {
      await updateRegistration(store.getState().id, button.dataset.rejectRegistration, { status: 'rejected', reviewedAt: Date.now(), reviewedBy: auth.currentUser?.uid || null });
      const item = registrations.find((entry) => entry.id === button.dataset.rejectRegistration);
      if (item) {item.status = 'rejected';}
      await addAudit(store.getState().id, 'registration_rejected', `Inscrição recusada: ${item?.teamName || button.dataset.rejectRegistration}`);
      render();
    } catch (error) {button.disabled = false; toast(error.message || 'Não foi possível recusar a inscrição.');}
  });
  
  root.querySelector('[data-pdf]')?.addEventListener('click', async () => {
    const button = root.querySelector('[data-pdf]');
    button.disabled = true;
    await downloadChampionshipPDF(store.getState());
    button.disabled = false;
  });
  
  root.querySelector('[data-publication]')?.addEventListener('click', () => navigate(`/publicacao/${store.getState().id}`));
  root.querySelectorAll('[data-team-invite-copy]').forEach((button) => button.onclick = async () => {
    try { await navigator.clipboard?.writeText(button.dataset.teamInviteCopy); button.textContent = 'Copiado'; setTimeout(() => { button.textContent = 'Copiar'; }, 1600); } catch { button.textContent = 'Falha'; }
  });
  root.querySelectorAll('[data-team-invite-qr]').forEach((button) => button.onclick = async () => {
    try { const dataUrl = await createQrDataUrl(button.dataset.teamInviteQr); const link = document.createElement('a'); link.href = dataUrl; link.download = `arena-equipe-${button.dataset.teamInviteName || 'portal'}-qr.png`; link.click(); } catch { button.textContent = 'Falha'; }
  });
  root.querySelector('[data-add-announcement]')?.addEventListener('click', async () => {
    const button = root.querySelector('[data-add-announcement]');
    const title = root.querySelector('[data-announcement-title]')?.value;
    const body = root.querySelector('[data-announcement-body]')?.value;
    const photoFile = root.querySelector('[data-announcement-photo]')?.files?.[0];
    const videoUrl = root.querySelector('[data-announcement-video]')?.value?.trim();
    let mediaUrl = '';
    let mediaType = '';
    if (photoFile) {
      button.disabled = true;
      try { mediaUrl = await uploadAnnouncementPhoto(store.getState().id, photoFile); mediaType = 'photo'; }
      catch { button.disabled = false; return toast('Não foi possível enviar a foto.'); }
      button.disabled = false;
    } else if (videoUrl) {
      mediaUrl = videoUrl; mediaType = 'video';
    }
    const result = store.addAnnouncement({ title, body, mediaUrl, mediaType });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'announcement_created', `Comunicado criado: ${title}`);
  });
  root.querySelectorAll('[data-toggle-announcement]').forEach((button) => button.onclick = async () => {
    const item = store.getState().announcements.find((announcement) => announcement.id === button.dataset.toggleAnnouncement);
    if (!item) {return;}
    const result = store.publishAnnouncement(item.id, item.status !== 'published');
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'announcement_status_changed', `Comunicado ${result.announcement.status === 'published' ? 'publicado' : 'retirado'}`);
  });
  root.querySelector('[data-add-poll]')?.addEventListener('click', async () => {
    const question = root.querySelector('[data-poll-question]')?.value;
    const options = root.querySelector('[data-poll-options]')?.value.split('\n');
    const result = store.addPoll({ question, options });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'poll_created', `Enquete criada: ${question}`);
  });
  root.querySelectorAll('[data-toggle-poll]').forEach((button) => button.onclick = async () => {
    const item = store.getState().polls.find((poll) => poll.id === button.dataset.togglePoll);
    if (!item) {return;}
    const result = store.publishPoll(item.id, item.status !== 'published');
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'poll_status_changed', `Enquete ${result.poll.status === 'published' ? 'publicada' : 'encerrada'}`);
  });
  
  root.querySelectorAll('[data-jump]').forEach((button) => button.onclick = () => { setTab(button.dataset.jump); render(); });
  
  root.querySelectorAll('[data-category]').forEach((button) => button.onclick = async () => {
    store.switchCategory(button.dataset.category);
    setTab('overview');
    await persist();
  });
  
  const saveConfig = root.querySelector('[data-save-config]');
  if (saveConfig) {saveConfig.onclick = async () => {
    const statusEl = root.querySelector('[data-status]');
    if (statusEl) {store.updateStatus(statusEl.value);}
    const accentEl = root.querySelector('[data-accent]');
    if (accentEl) {store.setAccent(accentEl.value);}
    const slugEl = root.querySelector('[data-public-slug]');
    if (slugEl) {
      const desired = slugify(slugEl.value);
      if (desired && desired !== store.getState().publicSlug) {
        const available = await checkSlugAvailable(desired, store.getState().id);
        if (!available) {return toast('Essa URL já está em uso por outro campeonato. Escolha outra.');}
      }
      const slugResult = store.setPublicSlug(slugEl.value);
      if (!slugResult.ok) {return;}
    }
    await persist();
    await addAudit(store.getState().id, 'config_updated', 'Configurações atualizadas');
  };}
  
  const clearBtn = root.querySelector('[data-clear-results]');
  if (clearBtn) {clearBtn.onclick = async () => {
    if (!confirm('Zerar todos os placares e o chaveamento desta fase?')) {return;}
    store.clearResults();
    await persist();
    await addAudit(store.getState().id, 'results_cleared', 'Resultados zerados');
  };}
  
  const exportJsonBtn = root.querySelector('[data-export-json]');
  if (exportJsonBtn) {exportJsonBtn.onclick = () => {
    const { filename, content } = championshipJSON(store.getState());
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  };}
  
  const reportFns = {
    teams: () => exportTeamsReport(store.getState()),
    roster: () => exportRosterReport(store.getState()),
    schedule: () => exportScheduleReport(store.getState()),
    standings: () => exportStandingsReport(store.getState()),
    scorers: () => exportScorersReport(store.getState()),
    discipline: () => exportDisciplineReport(store.getState()),
    officials: () => exportOfficialsReport(store.getState()),
    results: () => exportResultsReport(store.getState()),
    round: () => exportRoundBulletin(store.getState(), root.querySelector('[data-report-round]')?.value),
    pdf: () => exportPDF(store.getState()),
    cards: () => exportAthleteCards(store.getState(), store.getState().activeCategoryId)
  };
  root.querySelectorAll('[data-export]').forEach((button) => button.onclick = () => { const fn = reportFns[button.dataset.export]; if (fn) {fn();} });
  root.querySelectorAll('[data-print-sumula]').forEach((button) => button.onclick = () => { const [kind, id] = button.dataset.printSumula.split(':'); printSumula(store.getState(), kind, id); });

  // Categories
  root.querySelectorAll('[data-add-category]').forEach((button) => button.onclick = async () => {
    store.addCategory();
    await persist();
    await addAudit(store.getState().id, 'category_added', 'Categoria criada');
  });
  root.querySelectorAll('[data-category-name]').forEach((input) => input.onchange = async () => {
    store.renameCategory(input.dataset.categoryName, input.value);
    await persist();
    await addAudit(store.getState().id, 'category_renamed', 'Categoria renomeada');
  });
  root.querySelectorAll('[data-remove-category]').forEach((button) => button.onclick = async () => {
    if (!confirm('Excluir esta categoria e suas equipes e jogos?')) {return;}
    const result = store.removeCategory(button.dataset.removeCategory);
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'category_removed', 'Categoria excluída');
  });

  // Phases
  root.querySelectorAll('[data-add-phase]').forEach((button) => button.onclick = async () => {
    store.addPhase();
    setTab('fases');
    await persist();
    await addAudit(store.getState().id, 'phase_added', 'Fase criada');
  });
  root.querySelectorAll('[data-phase-name]').forEach((input) => input.onchange = async () => {
    store.renamePhase(input.dataset.phaseName, input.value);
    await persist();
    await addAudit(store.getState().id, 'phase_renamed', 'Fase renomeada');
  });
  root.querySelectorAll('[data-phase-format]').forEach((select) => select.onchange = async () => {
    store.setPhaseFormat(select.dataset.phaseFormat, select.value);
    await persist();
    await addAudit(store.getState().id, 'phase_format_changed', 'Formato da fase alterado');
  });
  root.querySelectorAll('[data-phase-turnos]').forEach((input) => input.onchange = async () => {
    const value = Math.max(1, Math.min(2, +input.value || 1));
    store.updateScoring({ turnos: value });
    await persist();
  });
  root.querySelectorAll('[data-phase-ngrupos]').forEach((input) => input.onchange = async () => {
    const value = Math.max(1, +input.value || 2);
    store.updateScoring({ nGrupos: value });
    await persist();
  });
  root.querySelectorAll('[data-phase-mao-unica]').forEach((input) => input.onchange = async () => {
    store.updateScoring({ maoUnica: input.checked });
    await persist();
  });
  root.querySelectorAll('[data-phase-terceiro]').forEach((input) => input.onchange = async () => {
    store.updateScoring({ terceiro: input.checked });
    await persist();
  });
  root.querySelectorAll('[data-switch-phase]').forEach((button) => button.onclick = async () => {
    store.switchPhase(button.dataset.switchPhase);
    setTab('overview');
    await persist();
  });
  root.querySelectorAll('[data-remove-phase]').forEach((button) => button.onclick = async () => {
    if (!confirm('Excluir esta fase e todos os jogos vinculados a ela?')) {return;}
    const result = store.removePhase(button.dataset.removePhase);
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'phase_removed', 'Fase excluída');
  });
  root.querySelectorAll('[data-generate-phase]').forEach((button) => button.onclick = async () => {
    const result = store.generateActivePhase();
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'phase_generated', 'Jogos da fase gerados');
  });
  root.querySelectorAll('[data-progress-target]').forEach((select) => select.onchange = async () => {
    store.setProgressTarget(select.dataset.progressTarget, select.value);
    await persist();
  });
  root.querySelectorAll('[data-progress-mode]').forEach((select) => select.onchange = async () => {
    store.setProgressMode(select.dataset.progressMode, select.value);
    await persist();
  });
  root.querySelectorAll('[data-progress-count]').forEach((input) => input.onchange = async () => {
    store.setProgressCount(input.dataset.progressCount, input.value);
    await persist();
  });
  root.querySelectorAll('[data-apply-progress]').forEach((button) => button.onclick = async () => {
    const phaseId = button.dataset.applyProgress;
    let result = store.applyProgression(phaseId);
    if (!result.ok && result.reason === 'incomplete') {
      if (!confirm('A fase ainda possui jogos pendentes. Avançar com a classificação atual?')) {return;}
      result = store.applyProgression(phaseId, true);
    }
    if (!result.ok) {return toast({ 'no-target': 'Configure a fase de destino', 'target-missing': 'Fase de destino não encontrada', 'no-qualifiers': 'Ainda não há classificados definidos' }[result.reason] || 'Não foi possível classificar');}
    setTab('fases');
    await persist();
    await addAudit(store.getState().id, 'phase_progressed', `${result.count} classificado(s) enviados para ${esc(result.targetName)}`);
  });
  root.querySelectorAll('[data-gen-cross]').forEach((button) => button.onclick = async () => {
    store.genCross();
    await persist();
    await addAudit(store.getState().id, 'bracket_generated', 'Mata-mata gerado a partir dos grupos');
  });
  root.querySelectorAll('[data-regen-cross]').forEach((button) => button.onclick = async () => {
    if (!confirm('Regerar o mata-mata? O chaveamento atual será substituído.')) {return;}
    store.genCross();
    await persist();
    await addAudit(store.getState().id, 'bracket_generated', 'Mata-mata regerado');
  });

  // Scoring config
  root.querySelectorAll('[data-crit-move]').forEach((button) => button.onclick = async () => {
    const [i, dir] = button.dataset.critMove.split(':').map(Number);
    const criterios = store.getState().cfg?.criterios || ['P', 'V', 'SG', 'GP'];
    const newCriterios = critMove(criterios, i, dir);
    store.updateScoring({ criterios: newCriterios });
    await persist();
  });
  root.querySelectorAll('[data-crit-remove]').forEach((button) => button.onclick = async () => {
    const criterios = store.getState().cfg?.criterios || ['P', 'V', 'SG', 'GP'];
    const newCriterios = critRemove(criterios, +button.dataset.critRemove);
    store.updateScoring({ criterios: newCriterios });
    await persist();
  });
  root.querySelectorAll('[data-crit-add]').forEach((button) => button.onclick = async () => {
    const select = root.querySelector('[data-crit-add-select]');
    if (!select || !select.value) {return;}
    const criterios = store.getState().cfg?.criterios || ['P', 'V', 'SG', 'GP'];
    const newCriterios = critAdd(criterios, select.value);
    store.updateScoring({ criterios: newCriterios });
    await persist();
  });
  root.querySelectorAll('[data-save-scoring]').forEach((button) => button.onclick = async () => {
    const state = store.getState();
    const cfg = { ...state.cfg };
    cfg.winPts = +root.querySelector('[data-win-pts]').value || 0;
    cfg.drawPts = +root.querySelector('[data-draw-pts]').value || 0;
    cfg.lossPts = +root.querySelector('[data-loss-pts]').value || 0;
    const discYellowInput = root.querySelector('[data-disc-yellow]');
    if (discYellowInput) {cfg.discYellow = Math.min(20, Math.max(0, Math.trunc(+discYellowInput.value || 0)));}
    const discRedInput = root.querySelector('[data-disc-red]');
    if (discRedInput) {cfg.discRed = Math.min(20, Math.max(0, Math.trunc(+discRedInput.value || 0)));}
    cfg.yellowLimit = Math.max(0, +root.querySelector('[data-yellow-limit]').value || 0);
    cfg.maxRoster = Math.min(50, Math.max(1, Math.trunc(+root.querySelector('[data-max-roster]').value || 50)));
    cfg.setsToWin = Math.min(7, Math.max(1, Math.trunc(+root.querySelector('[data-sets-to-win]').value || 1)));
    cfg.periods = Math.min(6, Math.max(1, Math.trunc(+root.querySelector('[data-periods]').value || 1)));
    store.updateScoring(cfg);
    await persist();
    await addAudit(store.getState().id, 'scoring_updated', 'Pontuação e desempate atualizados');
  });

  // Results
  root.querySelectorAll('[data-clear-results]').forEach((button) => button.onclick = async () => {
    if (!confirm('Zerar todos os placares e o chaveamento desta fase?')) {return;}
    store.clearResults();
    await persist();
    await addAudit(store.getState().id, 'results_cleared', 'Resultados zerados');
  });
  root.querySelectorAll('[data-generate]').forEach((button) => button.onclick = async () => {
    const result = store.generateActivePhase();
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'games_generated', 'Jogos gerados');
  });

  // Match scores
  root.querySelectorAll('[data-score]').forEach((input) => input.onchange = async () => {
    const [matchId, field] = input.dataset.score.split(':');
    const result = store.setScore(matchId, field, input.value);
    if (!result.ok) {toast(result.reason || 'Não foi possível atualizar o placar.'); return;}
    const match = store.getState().matches.find((item) => item.id === matchId);
    const home = store.getState().teams?.[match.home]?.nome || '?';
    const away = store.getState().teams?.[match.away]?.nome || '?';
    await persist();
    await addAudit(store.getState().id, 'score_updated', `Placar alterado: ${home} ${result.after.hg ?? '–'} × ${result.after.ag ?? '–'} ${away}`, result.before, result.after);
  });

  // Match ops
  root.querySelectorAll('[data-match-ops]').forEach((button) => button.onclick = () => matchOpsModal(button.dataset.matchOps, store, { persist, addAudit }));

  // Open scoreboard control
  root.querySelectorAll('[data-open-scoreboard]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.openScoreboard.split(':');
    setPlacarTarget(id, kind);
    setTab('placar');
    render();
  });

  // Súmula
  root.querySelectorAll('[data-sumula]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.sumula.split(':');
    sumulaModal(kind, id, store, { persist, addAudit });
  });

  // Result card (per match/tie, only offered once a result exists)
  root.querySelectorAll('[data-result-card]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.resultCard.split(':');
    const state = store.getState();
    let home, away, hg, ag;
    if (kind === 'tie') {
      const tie = store.findTie(id);
      if (!tie) {return;}
      home = teamById(state, tie.a)?.nome || 'A definir';
      away = teamById(state, tie.b)?.nome || 'A definir';
      hg = tie.ag1; ag = tie.bg1;
    } else {
      const match = (state.matches || []).find((item) => item.id === id);
      if (!match) {return;}
      home = state.teams?.[match.home]?.nome || 'A definir';
      away = state.teams?.[match.away]?.nome || 'A definir';
      hg = match.hg; ag = match.ag;
    }
    try { downloadMatchCard(state.nome, home, hg, away, ag); }
    catch { toast('Não foi possível gerar o card.'); }
  });

  // Tie scores
  root.querySelectorAll('[data-tie-score]').forEach((input) => input.onchange = async () => {
    const [tieId, field] = input.dataset.tieScore.split(':');
    const tie = store.findTie(tieId);
    if (!tie) {return;}
    tie[field] = input.value === '' ? null : Number(input.value);
    store.advanceBracket();
    await persist();
    await addAudit(store.getState().id, 'tie_score_updated', 'Placar do chaveamento atualizado');
  });

  // Scoreboard: score +/- (live increments — bounds-only, no final-result validation like
  // setScore/setTieScore have: does not reject tied/in-progress scores, does not touch
  // match.meta.status, does not call advanceBracket. store.adjustScore() calls store.produce()
  // internally, which triggers store.subscribe()'s notify -> re-render — no explicit render()
  // needed here, same as every other scoreboard handler.)
  root.querySelectorAll('[data-scoreboard-score]').forEach((button) => button.onclick = async () => {
    const [kind, id, field, deltaStr] = button.dataset.scoreboardScore.split(':');
    store.adjustScore(id, kind, field, Number(deltaStr));
    await persist();
  });

  // Scoreboard: clock
  root.querySelectorAll('[data-scoreboard-clock]').forEach((button) => button.onclick = async () => {
    const [kind, id, action] = button.dataset.scoreboardClock.split(':');
    if (action === 'toggle') {store.clockToggle(id, kind);} else {store.clockReset(id, kind);}
    await persist();
  });

  // Scoreboard: period
  root.querySelectorAll('[data-scoreboard-period]').forEach((button) => button.onclick = async () => {
    const [kind, id, deltaStr] = button.dataset.scoreboardPeriod.split(':');
    store.setPeriod(id, kind, Number(deltaStr));
    await persist();
  });

  // Scoreboard: fouls
  root.querySelectorAll('[data-scoreboard-foul]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardFoul.split(':');
    store.adjustFoul(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: timeouts
  root.querySelectorAll('[data-scoreboard-timeout]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardTimeout.split(':');
    store.adjustTimeout(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: penalties
  root.querySelectorAll('[data-scoreboard-penalty]').forEach((button) => button.onclick = async () => {
    const [kind, id, side, deltaStr] = button.dataset.scoreboardPenalty.split(':');
    store.adjustPenalty(id, kind, side, Number(deltaStr));
    await persist();
  });

  // Scoreboard: server toggle
  root.querySelectorAll('[data-scoreboard-server]').forEach((button) => button.onclick = async () => {
    const [kind, id] = button.dataset.scoreboardServer.split(':');
    store.toggleServer(id, kind);
    await persist();
  });

  // Scoreboard: open projection window (no store mutation, no re-render needed)
  root.querySelectorAll('[data-scoreboard-open]').forEach((button) => button.onclick = () => {
    const [kind, id] = button.dataset.scoreboardOpen.split(':');
    const query = kind === 'tie' ? '?kind=tie' : '';
    window.open(`/placar/${store.getState().id}/${id}${query}`, '_blank', 'noopener');
  });

  // Venues
  root.querySelectorAll('[data-add-venue]').forEach((button) => button.onclick = async () => {
    const nameInput = root.querySelector('[data-new-venue-name]');
    const addrInput = root.querySelector('[data-new-venue-address]');
    const result = store.addVenue({ name: nameInput.value, address: addrInput.value });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'venue_added', `Local adicionado: ${result.venue.name}`);
  });
  root.querySelectorAll('[data-remove-venue]').forEach((button) => button.onclick = async () => {
    const result = store.removeVenue(button.dataset.removeVenue);
    if (!result.ok) {return toast(result.reason || 'Não foi possível salvar os dados da partida.');}
    await persist();
    await addAudit(store.getState().id, 'venue_removed', 'Local removido');
  });

  // Officials
  root.querySelectorAll('[data-add-official]').forEach((button) => button.onclick = async () => {
    const nameInput = root.querySelector('[data-new-official-name]');
    const roleInput = root.querySelector('[data-new-official-role]');
    const result = store.addOfficial({ name: nameInput.value, role: roleInput.value });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'official_added', `Oficial adicionado: ${result.official.name}`);
  });
  root.querySelectorAll('[data-remove-official]').forEach((button) => button.onclick = async () => {
    const result = store.removeOfficial(button.dataset.removeOfficial);
    if (!result.ok) {return toast(result.reason || 'Não foi possível registrar o lance.');}
    await persist();
    await addAudit(store.getState().id, 'official_removed', 'Oficial removido');
  });

  // Collaborators
  root.querySelectorAll('[data-add-mgr]').forEach((button) => button.onclick = async () => {
    const emailInput = root.querySelector('[data-new-mgr-email]');
    const roleSelect = root.querySelector('[data-new-mgr-role]');
    const result = store.inviteManager(auth.currentUser, { email: emailInput.value, role: roleSelect.value });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'collaborator_invited', `Acesso concedido: ${result.collaborator.email}`);
  });
  root.querySelectorAll('[data-mgr-role]').forEach((select) => select.onchange = async () => {
    const result = store.changeManagerRole(auth.currentUser, select.dataset.mgrRole, select.value);
    if (!result.ok) { toast(result.reason); return; }
    await persist();
    await addAudit(store.getState().id, 'collaborator_role_changed', 'Papel de colaborador alterado');
  });
  root.querySelectorAll('[data-mgr-remove]').forEach((button) => button.onclick = async () => {
    if (!confirm('Remover o acesso deste colaborador?')) {return;}
    const result = store.removeManager(auth.currentUser, button.dataset.mgrRemove);
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'collaborator_removed', 'Acesso de colaborador removido');
  });

  // Branding
  root.querySelectorAll('[data-brand-input]').forEach((input) => input.onchange = async () => {
    const file = input.files[0];
    if (!file) {return;}
    const kind = input.dataset.brandInput;
    const oldUrl = store.getState().branding?.[kind] || '';
    let url;
    try { url = await uploadBrandImage(store.getState().id, kind, file, oldUrl); }
    catch (error) { return toast(error.message || 'Não foi possível enviar a imagem.'); }
    store.setBrandImage(kind, url);
    await persist();
    await addAudit(store.getState().id, 'branding_updated', kind === 'logo' ? 'Logo atualizada' : 'Capa atualizada');
  });
  root.querySelectorAll('[data-clear-brand]').forEach((button) => button.onclick = async () => {
    const kind = button.dataset.clearBrand;
    const oldUrl = store.getState().branding?.[kind] || '';
    if (oldUrl) {await deleteImageByUrl(oldUrl);}
    store.clearBrandImage(kind);
    await persist();
    await addAudit(store.getState().id, 'branding_updated', kind === 'logo' ? 'Logo removida' : 'Capa removida');
  });

  // Sponsors
  root.querySelectorAll('[data-add-sponsor]').forEach((button) => button.onclick = async () => {
    const nameInput = root.querySelector('[data-new-sponsor-name]');
    const urlInput = root.querySelector('[data-new-sponsor-url]');
    const logoInput = root.querySelector('[data-new-sponsor-logo]');
    let logo = '';
    try { const file = logoInput.files[0]; if (file) {logo = await uploadSponsorLogo(store.getState().id, file, '');} }
    catch (error) { return toast(error.message || 'Não foi possível enviar a logo.'); }
    const result = store.addSponsor({ name: nameInput.value, url: urlInput.value, logo });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(store.getState().id, 'sponsor_added', `Patrocinador adicionado: ${result.sponsor.name}`);
  });
  root.querySelectorAll('[data-remove-sponsor]').forEach((button) => button.onclick = async () => {
    const sponsor = store.getState().sponsors?.find(s => s.id === button.dataset.removeSponsor);
    if (sponsor?.logo) {await deleteImageByUrl(sponsor.logo);}
    const result = store.removeSponsor(button.dataset.removeSponsor);
    if (!result.ok) {return toast(result.reason || 'Não foi possível remover o lance.');}
    await persist();
    await addAudit(store.getState().id, 'sponsor_removed', 'Patrocinador removido');
  });

  // Teams
  root.querySelectorAll('[data-add-team]').forEach((button) => button.onclick = () => {
    store.addTeam();
  });
  root.querySelectorAll('[data-remove-team]').forEach((button) => button.onclick = () => {
    store.removeTeam(button.dataset.removeTeam);
  });
  root.querySelectorAll('[data-team]').forEach((input) => input.onchange = async () => {
    const team = store.getState().teams.find((item) => item.id === input.dataset.team);
    if (team) {store.updateTeamName(input.dataset.team, input.value);}
  });
  root.querySelectorAll('[data-save-teams]').forEach((button) => button.onclick = async () => {
    await persist();
    await addAudit(store.getState().id, 'teams_updated', 'Equipes atualizadas');
  });
  root.querySelectorAll('[data-pick-logo]').forEach((el) => el.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) {return;}
      const team = store.getState().teams.find(t => t.id === el.dataset.pickLogo);
      const oldUrl = team?.logo || '';
      let url;
      try { url = await uploadTeamLogo(store.getState().id, file, oldUrl); }
      catch (error) { return toast(error.message || 'Não foi possível enviar a logo.'); }
      store.setTeamLogo(el.dataset.pickLogo, url);
      await persist();
    };
    input.click();
  });
  root.querySelectorAll('[data-roster]').forEach((button) => button.onclick = () => rosterModal(button.dataset.roster, store, { persist, addAudit }));

  // Export JSON
  root.querySelectorAll('[data-export-json]').forEach((button) => button.onclick = () => {
    const { filename, content } = championshipJSON(store.getState());
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado');
  });
  root.querySelector('[data-import-json]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {return;}
    try {
      const imported = parseChampionshipImport(await file.text());
      if (!imported.ok) {throw new Error('Arquivo de backup inválido.');}
      if (!confirm(`Restaurar o backup “${imported.value.nome || 'sem nome'}” como um novo campeonato?`)) {return;}
      await saveChampionship(imported.value);
      await addAudit(store.getState().id, 'backup_restored', `Backup restaurado como ${imported.value.id}`);
      toast('Backup restaurado');
      navigate(`/campeonatos/${imported.value.id}`);
    } catch (error) {toast(error.message || 'Não foi possível restaurar o backup.');}
    event.target.value = '';
  });
}

function matchOpsModal(matchId, store, { persist, addAudit }) {
  const state = store.getState();
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {return;}
  const meta = matchMeta(match);
  const home = state.teams?.[match.home]?.nome || 'A definir';
  const away = state.teams?.[match.away]?.nome || 'A definir';
  modal(`<h3>Dados da partida</h3><p class="muted">${esc(home)} × ${esc(away)}</p><div class="row" style="flex-wrap:wrap;margin-top:12px"><input type="date" data-op-date value="${esc(meta.date || '')}" style="flex:1;min-width:140px"><input type="time" data-op-time value="${esc(meta.time || '')}" style="flex:1;min-width:100px"></div><div class="row" style="flex-wrap:wrap;margin-top:10px"><select data-op-venue style="flex:1;min-width:160px"><option value="">Local — selecionar</option>${(state.venues || []).map((v) => `<option value="${esc(v.id)}" ${meta.venueId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select><select data-op-status style="flex:1;min-width:140px">${[['scheduled', 'Agendada'], ['live', 'Em andamento'], ['finished', 'Encerrada'], ['postponed', 'Adiada'], ['cancelled', 'Cancelada']].map(([key, label]) => `<option value="${key}" ${(meta.status || 'scheduled') === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div><div class="row" style="flex-wrap:wrap;margin-top:10px"><select data-op-referee style="flex:1;min-width:160px"><option value="">Árbitro — selecionar</option>${(state.officials || []).map((o) => `<option value="${esc(o.id)}" ${meta.refereeId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select><select data-op-table style="flex:1;min-width:160px"><option value="">Mesário — selecionar</option>${(state.officials || []).map((o) => `<option value="${esc(o.id)}" ${meta.tableOfficialId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div><textarea data-op-notes placeholder="Observações" style="width:100%;min-height:70px;margin-top:10px;border:1px solid var(--line);background:var(--surface-muted);color:var(--text);border-radius:8px;padding:10px">${esc(meta.notes || '')}</textarea><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-close-modal>Cancelar</button><button class="btn primary" data-save-match-ops="${esc(matchId)}">Salvar</button></div>`);
  const box = document.getElementById('modalBox');
  box.querySelector('[data-close-modal]').onclick = () => closeModal();
  box.querySelector('[data-save-match-ops]').onclick = async () => {
    const result = store.saveMatchOps(matchId, { date: box.querySelector('[data-op-date]').value, time: box.querySelector('[data-op-time]').value, venueId: box.querySelector('[data-op-venue]').value, refereeId: box.querySelector('[data-op-referee]').value, tableOfficialId: box.querySelector('[data-op-table]').value, status: box.querySelector('[data-op-status]').value, notes: box.querySelector('[data-op-notes]').value });
    if (!result.ok) {return toast(result.reason || 'Não foi possível salvar os dados da partida.');}
    await persist();
    await addAudit(store.getState().id, 'match_updated', `Dados da partida alterados: ${home} × ${away}`, result.before, result.after);
    closeModal();
  };
}

function sumulaObj(kind, id, state) {
  return kind === 'match' ? (state.matches || []).find((m) => m.id === id) : findTie(state.bracket, id);
}

function sumulaModal(kind, id, store, { persist, addAudit }) {
  const state = store.getState();
  const obj = sumulaObj(kind, id, state);
  if (!obj) {return;}
  obj.events = obj.events || [];
  const sides = kind === 'match' ? [state.teams?.[obj.home], state.teams?.[obj.away]].filter(Boolean) : [obj.a, obj.b].map((tid) => teamById(state, tid)).filter(Boolean);
  const evHTML = obj.events.length ? obj.events.map((e, i) => { const icon = e.type === 'goal' ? '⚽' : (e.type === 'yellow' ? '🟨' : '🟥'); const name = e.athleteId ? (state.teams?.flatMap(t => t.roster || []).find(a => a.id === e.athleteId)?.nome || '?') : (e.name || '?'); return `<div class="team-row"><span>${icon}</span><span>${esc(name)} <span class="muted">— ${esc(teamById(state, e.teamId)?.nome || '—')}</span></span><span class="muted"></span><button class="btn ghost sm" data-sumula-remove="${i}">✕</button></div>`; }).join('') : '<p class="muted">Nenhum lance registrado.</p>';
  const teamPicker = sides.map((team) => { const roster = team.roster || []; return `<div style="margin-top:12px"><strong>${esc(team.nome)}</strong>${roster.length ? roster.map((athlete) => { const suspension = suspensionInfo(state, athlete.id); return `<div class="team-row"><span>${athlete.numero ? esc(athlete.numero) : ''}</span><span>${esc(athlete.nome)}${suspension.suspended ? ' <span class="tag">Suspenso</span>' : ''}</span><span class="row">${suspension.suspended ? '<span class="muted">Indisponível</span>' : `<button class="btn ghost sm" aria-label="Registrar gol de ${esc(athlete.nome)}" title="Registrar gol" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:goal">⚽</button><button class="btn ghost sm" aria-label="Registrar cartão amarelo para ${esc(athlete.nome)}" title="Cartão amarelo" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:yellow">🟨</button><button class="btn ghost sm" aria-label="Registrar cartão vermelho para ${esc(athlete.nome)}" title="Cartão vermelho" data-sumula-add="${esc(team.id)}:${esc(athlete.id)}:red">🟥</button>`}</span></div>`; }).join('') : '<p class="muted">Sem elenco cadastrado.</p>'}<div class="row" style="margin-top:6px"><button class="btn ghost sm" aria-label="Registrar gol sem atleta" title="Gol sem atleta" data-sumula-anon="${esc(team.id)}:goal">+ ⚽ s/ atleta</button><button class="btn ghost sm" aria-label="Registrar cartão amarelo sem atleta" title="Cartão amarelo" data-sumula-anon="${esc(team.id)}:yellow">+ 🟨</button><button class="btn ghost sm" aria-label="Registrar cartão vermelho sem atleta" title="Cartão vermelho" data-sumula-anon="${esc(team.id)}:red">+ 🟥</button></div></div>`; }).join('');
  modal(`<h3>📋 Súmula</h3><p class="muted">${sides.map((t) => esc(t.nome)).join(' × ')}</p><div style="margin:14px 0">${evHTML}</div><div style="border-top:1px solid var(--line);margin:10px 0"></div>${teamPicker}<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-close-modal>Concluir</button></div>`);
  const box = document.getElementById('modalBox');
  box.querySelector('[data-close-modal]').onclick = () => { closeModal(); };
  box.querySelectorAll('[data-sumula-add]').forEach((button) => button.onclick = async () => { const [teamId, athleteId, type] = button.dataset.sumulaAdd.split(':'); store.addMatchEvent(obj, { type, teamId, athleteId }); await persist(); const icon = type === 'goal' ? '⚽ Gol' : type === 'yellow' ? '🟨 Cartão amarelo' : '🟥 Cartão vermelho'; await addAudit(store.getState().id, 'match_event_added', `${icon}: ${athleteId} (${teamById(state, teamId)?.nome || '—'})`); sumulaModal(kind, id, store, { persist, addAudit }); });
  box.querySelectorAll('[data-sumula-anon]').forEach((button) => button.onclick = async () => { const [teamId, type] = button.dataset.sumulaAnon.split(':'); store.addMatchEvent(obj, { type, teamId, name: '' }); await persist(); const icon = type === 'goal' ? '⚽ Gol' : type === 'yellow' ? '🟨 Cartão amarelo' : '🟥 Cartão vermelho'; await addAudit(store.getState().id, 'match_event_added', `${icon} s/ atleta (${teamById(state, teamId)?.nome || '—'})`); sumulaModal(kind, id, store, { persist, addAudit }); });
  box.querySelectorAll('[data-sumula-remove]').forEach((button) => button.onclick = async () => { store.removeMatchEvent(obj, +button.dataset.sumulaRemove); await persist(); await addAudit(store.getState().id, 'match_event_removed', 'Lance removido da súmula'); sumulaModal(kind, id, store, { persist, addAudit }); });
}

function rosterModal(teamId, store, { persist, addAudit }) {
  const state = store.getState();
  const team = teamById(state, teamId);
  if (!team) {return;}
  modal(rosterModalHTML(team));
  const box = document.getElementById('modalBox');
  box.querySelector('[data-close-modal]').onclick = () => closeModal();
  box.querySelectorAll('[data-athlete-name]').forEach((input) => input.onchange = async () => {
    const result = store.updateAthlete(team, input.dataset.athleteName, { nome: input.value, numero: box.querySelector(`[data-athlete-numero="${input.dataset.athleteName}"]`).value });
    if (!result.ok) {return;}
    await persist();
    await addAudit(state.id, 'athlete_updated', 'Atleta atualizado');
  });
  box.querySelectorAll('[data-athlete-numero]').forEach((input) => input.onchange = async () => {
    const nameInput = box.querySelector(`[data-athlete-name="${input.dataset.athleteNumero}"]`);
    const result = store.updateAthlete(team, input.dataset.athleteNumero, { nome: nameInput?.value, numero: input.value });
    if (!result.ok) {return;}
    await persist();
    await addAudit(state.id, 'athlete_updated', 'Atleta atualizado');
  });
  box.querySelectorAll('[data-athlete-remove]').forEach((button) => button.onclick = async () => {
    const result = store.removeAthlete(team, button.dataset.athleteRemove);
    if (!result.ok) {return;}
    await persist();
    await addAudit(state.id, 'athlete_removed', 'Atleta removido');
    rosterModal(teamId, store, { persist, addAudit });
  });
  box.querySelectorAll('[data-athlete-photo]').forEach((button) => button.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) {return;}
      const athlete = team.roster?.find(a => a.id === button.dataset.athletePhoto);
      const oldUrl = athlete?.foto || '';
      let url;
      try { url = await uploadAthletePhoto(state.id, file, oldUrl); }
      catch (error) { return toast(error.message || 'Não foi possível enviar a foto.'); }
      store.setAthletePhoto(team, button.dataset.athletePhoto, url);
      await persist();
      rosterModal(teamId, store, { persist, addAudit });
    };
    input.click();
  });
  const addButton = box.querySelector('[data-add-athlete]');
  if (addButton) {addButton.onclick = async () => {
    const nameInput = box.querySelector('[data-new-athlete-name]');
    const result = store.addAthlete(team, { nome: nameInput.value });
    if (!result.ok) {return toast(result.reason);}
    await persist();
    await addAudit(state.id, 'athlete_added', `Atleta adicionado: ${result.athlete.nome}`);
    rosterModal(teamId, store, { persist, addAudit });
  };}
  box.querySelectorAll('[data-staff]').forEach((input) => input.onchange = async () => {
    const [staffTeamId, key] = input.dataset.staff.split(':');
    store.setTeamStaff(teamById(state, staffTeamId), key, input.value);
    await persist();
  });
}


