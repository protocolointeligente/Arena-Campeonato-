import { produce } from 'immer';
import { uid } from './utils.ts';
import { ensureCategories, activeCategory, loadCategoryIntoRoot, saveRootIntoActive, switchCategory, addCategory, renameCategory, removeCategory } from './categories.js';
import { activePhaseOf, loadPhaseIntoRoot, saveRootIntoPhase, saveRootIntoPhaseImmer, addPhase, renamePhase, removePhase, switchPhase, setPhaseFormat, setProgressTarget, setProgressMode, setProgressCount } from './phases.js';
import { setScore, saveMatchOps, clearResults, addMatchEvent, removeMatchEvent } from './matches.js';
import { generateActivePhase, advanceBracket, findTie } from './engine.js';
import { computeStandings, applyProgression, genCross } from './standings.js';
import { addAthlete, updateAthlete, removeAthlete, setAthletePhoto, setTeamLogo } from './roster.js';
import { findScoreboardObj, clockToggle as scoreboardClockToggle, clockReset as scoreboardClockReset, setPeriod as scoreboardSetPeriod, adjustFoul as scoreboardAdjustFoul, adjustTimeout as scoreboardAdjustTimeout, adjustPenalty as scoreboardAdjustPenalty, toggleServer as scoreboardToggleServer, adjustScore as scoreboardAdjustScore } from './scoreboard.js';
import { addVenue, removeVenue, addOfficial, removeOfficial, setTeamStaff, ensureOps } from './ops.js';
import { ensureCollaborators, inviteManager, removeManager, changeManagerRole } from './collaborators.js';
import { ensureBranding, setAccent, setBrandImage, clearBrandImage, addSponsor, removeSponsor } from './branding.js';
import { validate, schemas } from './schemas.js';
import { toastError } from '../components/Toast.js';
import { ensureCommunications, addAnnouncement, publishAnnouncement, addPoll, publishPoll, votePoll, ensureTeamMessages, addTeamMessage } from './communications.js';
import { slugify, isValidSlug } from './format.js';
import { startDraw as startDrawPure, revealNext as revealNextDrawPure, applyDraw as applyDrawPure, cancelDraw as cancelDrawPure } from './draw.js';

// Local validated helper to avoid circular dependency
function validated(schemaKey, data) {
  const [namespace, action] = schemaKey.split('.');
  const schema = schemas[namespace]?.[action];
  if (!schema) {throw new Error(`Schema not found: ${schemaKey}`);}
  const result = validate(schema, data);
  if (!result.ok) {
    const error = new Error(result.errors);
    error.name = 'ValidationError';
    error.fieldErrors = result.fieldErrors;
    throw error;
  }
  return result.data;
}

export class ChampionshipStore {
  constructor(initialState) {
    this.state = produce(initialState, (draft) => {
      ensureCategories(draft);
      ensureOps(draft);
      ensureCommunications(draft);
      ensureTeamMessages(draft);
    });
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  produce(fn) {
    this.state = produce(this.state, fn);
    this.notify();
    return this.state;
  }

  persist() {
    return this.state;
  }

  addAnnouncement(data) {
    let result;
    this.produce((draft) => { result = addAnnouncement(draft, data); });
    return result;
  }

  addTeamMessage(data) {
    let result;
    this.produce((draft) => { result = addTeamMessage(draft, data); });
    return result;
  }

  // Sorteio ao vivo — see src/app/draw.js
  startDraw(opts) {
    let result;
    this.produce((draft) => { result = startDrawPure(draft, opts); });
    return result;
  }

  revealNextDraw() {
    let result;
    this.produce((draft) => { result = revealNextDrawPure(draft); });
    return result;
  }

  applyDraw() {
    let result;
    this.produce((draft) => { result = applyDrawPure(draft); });
    return result;
  }

  cancelDraw() {
    this.produce((draft) => { cancelDrawPure(draft); });
  }

  publishAnnouncement(id, published = true) {
    let result;
    this.produce((draft) => { result = publishAnnouncement(draft, id, published); });
    return result;
  }

  addPoll(data) { let result; this.produce((draft) => { result = addPoll(draft, data); }); return result; }
  publishPoll(id, published = true) { let result; this.produce((draft) => { result = publishPoll(draft, id, published); }); return result; }
  votePoll(id, optionId, voterKey) { let result; this.produce((draft) => { result = votePoll(draft, id, optionId, voterKey); }); return result; }

  // Categories
  getActiveCategory(state) {
    return activeCategory(state || this.state);
  }

  switchCategory(id) {
    this.produce((draft) => {
      saveRootIntoActive(draft);
      switchCategory(draft, id);
      loadCategoryIntoRoot(draft, activeCategory(draft));
    });
  }

  addCategory() {
    this.produce((draft) => {
      saveRootIntoActive(draft);
      addCategory(draft);
    });
  }

  renameCategory(id, name) {
    let validatedName;
    try {
      validatedName = validated('category.update', { nome: name });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      renameCategory(draft, id, validatedName.nome);
    });
    return { ok: true };
  }

  removeCategory(id) {
    return this.produce((draft) => {
      return removeCategory(draft, id);
    });
  }

  // Phases
  getActivePhase() {
    return activePhaseOf(this.getActiveCategory());
  }

  addPhase() {
    try {
      validated('phase.create', {
        nome: `Fase ${this.getActiveCategory().phases?.length + 1 || 1}`,
        formato: 'liga',
        cfg: {}
      });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      saveRootIntoPhaseImmer(draft, category);
      addPhase(draft, category);
    });
    return { ok: true };
  }

  renamePhase(id, name) {
    let validatedName;
    try {
      validatedName = validated('phase.update', { nome: name });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      renamePhase(category, id, validatedName.nome);
    });
    return { ok: true };
  }

  removePhase(id) {
    return this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      saveRootIntoPhaseImmer(draft, category);
      return removePhase(draft, category, id);
    });
  }

  switchPhase(id) {
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      saveRootIntoPhase(draft, activePhaseOf(category));
      switchPhase(draft, category, id);
      loadPhaseIntoRoot(draft, activePhaseOf(category));
    });
  }

  setPhaseFormat(id, fmt) {
    const validFormats = ['liga', 'grupos', 'gxg', 'mata'];
    if (!validFormats.includes(fmt)) { toastError('Formato de fase inválido'); return { ok: false }; }
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      saveRootIntoPhase(draft, activePhaseOf(category));
      setPhaseFormat(draft, category, id, fmt);
      if (category.activePhaseId === id) {loadPhaseIntoRoot(draft, activePhaseOf(category));}
    });
    return { ok: true };
  }

  setProgressTarget(srcId, targetId) {
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      setProgressTarget(category, srcId, targetId);
    });
  }

  setProgressMode(srcId, mode) {
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      setProgressMode(category, srcId, mode);
    });
  }

  setProgressCount(srcId, count) {
    this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      setProgressCount(category, srcId, count);
    });
  }

  // Generate phase
  generateActivePhase() {
    let result;
    this.produce((draft) => {
      result = generateActivePhase(draft);
    });
    return result;
  }

  // Matches
  setScore(matchId, field, value) {
    let result;
    this.produce((draft) => {
      result = setScore(draft, matchId, field, value);
    });
    return result;
  }

  saveMatchOps(matchId, ops) {
    let result;
    this.produce((draft) => {
      result = saveMatchOps(draft, matchId, ops);
    });
    return result;
  }

  clearResults() {
    let result;
    this.produce((draft) => {
      result = clearResults(draft);
    });
    return result;
  }

  addMatchEvent(obj, event) {
    this.produce((_draft) => {
      addMatchEvent(obj, event);
    });
  }

  removeMatchEvent(obj, index) {
    this.produce((_draft) => {
      removeMatchEvent(obj, index);
    });
  }

  // Bracket
  advanceBracket() {
    this.produce((draft) => {
      if (draft.bracket) {advanceBracket(draft.bracket, draft.cfg);}
    });
  }

  findTie(id) {
    return findTie(this.state.bracket, id);
  }

  setTieScore(tieId, field, value) {
    this.produce((draft) => {
      const tie = findTie(draft.bracket, tieId);
      if (tie) {
        tie[field] = value === '' ? null : Number(value);
      }
      if (draft.bracket) {advanceBracket(draft.bracket, draft.cfg);}
    });
  }

  genCross() {
    return this.produce((draft) => {
      return genCross(draft);
    });
  }

  // Scoreboard
  clockToggle(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardClockToggle(obj);}
    });
  }

  clockReset(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardClockReset(obj);}
    });
  }

  setPeriod(id, kind, delta) {
    let result;
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {result = scoreboardSetPeriod(obj, delta);}
    });
    return result;
  }

  adjustFoul(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustFoul(obj, side, delta);}
    });
  }

  adjustTimeout(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustTimeout(obj, side, delta);}
    });
  }

  adjustPenalty(id, kind, side, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustPenalty(obj, side, delta);}
    });
  }

  toggleServer(id, kind) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardToggleServer(obj);}
    });
  }

  adjustScore(id, kind, field, delta) {
    this.produce((draft) => {
      const obj = findScoreboardObj(draft, id, kind);
      if (obj) {scoreboardAdjustScore(obj, field, delta);}
    });
  }

  // Teams
  addTeam() {
    this.produce((draft) => {
      draft.teams = draft.teams || [];
      draft.teams.push({ id: uid(), nome: `Equipe ${draft.teams.length + 1}`, roster: [] });
    });
  }

  removeTeam(id) {
    this.produce((draft) => {
      draft.teams = draft.teams.filter((t) => t.id !== id);
    });
  }

  updateTeamName(id, name) {
    let validatedName;
    try {
      validatedName = validated('team.update', { nome: name });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === id);
      if (team) {team.nome = validatedName.nome;}
    });
    return { ok: true };
  }

  setTeamLogo(teamId, url) {
    if (url) {
      try {
        validated('team.roster', { foto: url }); // reuse athlete schema for URL validation
      } catch (e) {
        toastError(e.message);
        return { ok: false, errors: e.message };
      }
    }
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {setTeamLogo(team, url);}
    });
    return { ok: true };
  }

  // Roster
  addAthlete(teamId, data) {
    let validatedData;
    try {
      validatedData = validated('athlete.create', { teamId, ...data });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let addResult = { ok: false };
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {addResult = addAthlete(team, validatedData);}
    });
    return addResult;
  }

  updateAthlete(teamId, athleteId, data) {
    let validatedData;
    try {
      validatedData = validated('athlete.update', data);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let updateResult = { ok: false };
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {updateResult = updateAthlete(team, athleteId, validatedData);}
    });
    return updateResult;
  }

  removeAthlete(teamId, athleteId) {
    let result = { ok: false };
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {result = removeAthlete(team, athleteId);}
    });
    return result;
  }

  setAthletePhoto(teamId, athleteId, url) {
    if (url) {
      try {
        validated('athlete.create', { foto: url }); // reuse for URL validation
      } catch (e) {
        toastError(e.message);
        return { ok: false, errors: e.message };
      }
    }
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {setAthletePhoto(team, athleteId, url);}
    });
    return { ok: true };
  }

  // Staff
  setTeamStaff(teamId, key, name) {
    const staffRoles = ['tecnico', 'auxiliar', 'preparador', 'medico', 'fisio', 'nutricionista', 'psicologo'];
    if (!staffRoles.includes(key)) { toastError('Papel de staff inválido'); return { ok: false }; }
    this.produce((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (team) {setTeamStaff(team, key, name.trim() || '');}
    });
    return { ok: true };
  }

  // Venues
  addVenue(data) {
    let validatedData;
    try {
      validatedData = validated('venue.create', data);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let addResult;
    this.produce((draft) => {
      addResult = addVenue(draft, validatedData);
    });
    return addResult;
  }

  removeVenue(id) {
    let result;
    this.produce((draft) => {
      result = removeVenue(draft, id);
    });
    return result;
  }

  // Officials
  addOfficial(data) {
    let validatedData;
    try {
      validatedData = validated('official.create', data);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let addResult;
    this.produce((draft) => {
      addResult = addOfficial(draft, validatedData);
    });
    return addResult;
  }

  removeOfficial(id) {
    let result;
    this.produce((draft) => {
      result = removeOfficial(draft, id);
    });
    return result;
  }

  // Collaborators
  ensureCollaborators() {
    this.produce((draft) => {
      ensureCollaborators(draft);
    });
  }

  inviteManager(user, data) {
    let validatedData;
    try {
      validatedData = validated('collaborator.invite', data);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let result2;
    this.produce((draft) => {
      result2 = inviteManager(draft, user, validatedData);
    });
    return result2;
  }

  changeManagerRole(user, id, role) {
    let validatedData;
    try {
      validatedData = validated('collaborator.roleChange', { id, role });
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let result2;
    this.produce((draft) => {
      result2 = changeManagerRole(draft, user, validatedData.id, validatedData.role);
    });
    return result2;
  }

  removeManager(user, id) {
    let result;
    this.produce((draft) => {
      result = removeManager(draft, user, id);
    });
    return result;
  }

  // Branding
  ensureBranding() {
    this.produce((draft) => {
      ensureBranding(draft);
    });
  }

  setAccent(value) {
    try {
      // Validate color format
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        throw new Error('Cor deve ser hexadecimal (ex: #2fcf6b)');
      }
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      setAccent(draft, value);
    });
    return { ok: true };
  }

  // Availability against other championships must be checked by the caller first
  // (services/championships.js's checkSlugAvailable) — this only validates format and writes.
  setPublicSlug(value) {
    const slug = slugify(value);
    if (slug && !isValidSlug(slug)) {
      toastError('URL personalizada inválida — use letras, números e hífen, 3 a 60 caracteres.');
      return { ok: false };
    }
    this.produce((draft) => {
      draft.publicSlug = slug;
    });
    return { ok: true, slug };
  }

  // Valor "atual" configurado pelo organizador — cada aprovação de inscrição congela esse valor
  // em registration.feeAmount naquele momento (ver championship/index.js), então mudar aqui
  // depois nunca afeta quem já foi aprovado. 0 = recurso desligado.
  setRegistrationFee(fee, walletId) {
    const parsed = Number(fee);
    const amount = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
    this.produce((draft) => {
      draft.registrationFee = amount;
      draft.asaasWalletId = String(walletId || '').trim();
    });
  }

  setBrandImage(kind, url) {
    if (url) {
      try {
        validated('branding.image', { kind, url });
      } catch (e) {
        toastError(e.message);
        return { ok: false, errors: e.message };
      }
    }
    this.produce((draft) => {
      setBrandImage(draft, kind, url);
    });
    return { ok: true };
  }

  clearBrandImage(kind) {
    this.produce((draft) => {
      clearBrandImage(draft, kind);
    });
    return { ok: true };
  }

  addSponsor(data) {
    let validatedData;
    try {
      validatedData = validated('sponsor.create', data);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    let result2;
    this.produce((draft) => {
      result2 = addSponsor(draft, validatedData);
    });
    return result2;
  }

  removeSponsor(id) {
    let result;
    this.produce((draft) => {
      result = removeSponsor(draft, id);
    });
    return result;
  }

  // Config
  updateStatus(status) {
    const validStatuses = ['rascunho', 'inscricoes', 'andamento', 'encerrado'];
    if (!validStatuses.includes(status)) { toastError('Status inválido'); return { ok: false }; }
    this.produce((draft) => {
      draft.status = status;
    });
    return { ok: true };
  }

  updateScoring(cfg) {
    let validatedCfg;
    try {
      validatedCfg = validated('championship.scoring', cfg);
    } catch (e) {
      toastError(e.message);
      return { ok: false, errors: e.message };
    }
    this.produce((draft) => {
      draft.cfg = { ...draft.cfg, ...validatedCfg };
    });
    return { ok: true };
  }

  // Computed
  getStandings() {
    const category = this.getActiveCategory();
    const phase = this.getActivePhase();
    const formato = category.formato || this.state.formato || 'liga';
    
    if (formato === 'grupos') {
      return (category.grupos || []).map((group, gi) => {
        const idxs = group.map((id) => (category.teams || this.state.teams || []).findIndex((t) => t.id === id)).filter((i) => i >= 0);
        const ms = (category.matches || this.state.matches || []).filter((m) => (m.grupo || 0) === gi);
        return { title: `Grupo ${String.fromCharCode(65 + gi)}`, st: computeStandings(category.teams || this.state.teams || [], idxs, ms, phase.cfg || category.cfg || this.state.cfg || {}) };
      });
    }
    
    if (formato === 'gxg') {
      const A = (category.grupos?.[0] || []).map((id) => (category.teams || this.state.teams || []).findIndex((t) => t.id === id)).filter((i) => i >= 0);
      const B = (category.grupos?.[1] || []).map((id) => (category.teams || this.state.teams || []).findIndex((t) => t.id === id)).filter((i) => i >= 0);
      return [
        { title: 'Grupo A', st: computeStandings(category.teams || this.state.teams || [], A, this.state.matches || [], phase.cfg || category.cfg || this.state.cfg || {}) },
        { title: 'Grupo B', st: computeStandings(category.teams || this.state.teams || [], B, this.state.matches || [], phase.cfg || category.cfg || this.state.cfg || {}) }
      ];
    }
    
    const idxs = (category.teams || this.state.teams || []).map((_, i) => i);
    return [{ title: 'Classificação', st: computeStandings(category.teams || this.state.teams || [], idxs, category.matches || this.state.matches || [], phase.cfg || category.cfg || this.state.cfg || {}) }];
  }

  getScorers() {
    // scorerRanking uses allMatchObjs which reads from state
    return import('./standings.js').then(({ scorerRanking }) => scorerRanking(this.state));
  }

  getDiscipline() {
    return import('./standings.js').then(({ cardRanking, suspensionInfo }) => {
      const lim = (this.state.cfg && this.state.cfg.yellowLimit) || 3;
      const rows = cardRanking(this.state);
      const suspended = [];
      (this.state.teams || []).forEach((team) => (team.roster || []).forEach((athlete) => {
        const info = suspensionInfo(this.state, athlete.id);
        if (info.suspended) {suspended.push({ athlete, team, info });}
      }));
      return { lim, rows, suspended };
    });
  }

  applyProgression(phaseId, force = false) {
    return this.produce((draft) => {
      const category = this.getActiveCategory(draft);
      return applyProgression(draft, category, phaseId, { force });
    });
  }
}

export function createChampionshipStore(initialState) {
  return new ChampionshipStore(initialState);
}

