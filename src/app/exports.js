import { uid } from './utils.ts';

export function championshipJSON(state) {
  const filename = `${(state.nome || 'campeonato').replace(/[^\w-]+/g, '_')}.json`;
  return { filename, content: JSON.stringify(state, null, 2) };
}

export function parseChampionshipImport(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!value || typeof value !== 'object' || !value.formato || typeof value.cfg !== 'object' || !value.cfg) {return { ok: false, reason: 'invalid' };}
  value.id = uid();
  value.cfg.seedNames = value.cfg.seedNames || [];
  delete value.ownerUid;
  delete value.ownerEmail;
  delete value.collaborators;
  delete value.billing;
  return { ok: true, value };
}


