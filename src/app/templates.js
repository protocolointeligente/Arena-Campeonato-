const teamSports = { scoreType: 'goals', rosterMode: 'team', cfg: { maxRoster: 30, periods: 2 } };
const courtSports = { scoreType: 'sets', rosterMode: 'team', cfg: { maxRoster: 18, setsToWin: 3 } };
const doublesSports = { scoreType: 'sets', rosterMode: 'dupla', cfg: { maxRoster: 2, setsToWin: 2 } };
const individualSets = { scoreType: 'sets', rosterMode: 'individual', cfg: { maxRoster: 1, setsToWin: 2 } };
const individualSports = { scoreType: 'points', rosterMode: 'individual', cfg: { maxRoster: 1, periods: 1 } };

export const COMPETITION_MODELS = {
  liga: { label: 'Liga / pontos corridos', formatos: ['liga'] },
  grupos: { label: 'Grupos + fase final', formatos: ['grupos', 'gxg'] },
  mata: { label: 'Mata-mata', formatos: ['mata'] },
  ranking: { label: 'Ranking / chave simples', formatos: ['liga'] },
  swiss: { label: 'Sistema suíço', formatos: ['liga'] },
};

export const MODALITIES = {
  futebol: { label: 'Futebol', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  futsal: { label: 'Futsal', category: 'coletivo', defaults: { formato: 'grupos', ...teamSports } },
  'futebol-7': { label: 'Futebol 7 / Society', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  handebol: { label: 'Handebol', category: 'coletivo', defaults: { formato: 'grupos', ...teamSports } },
  basquete: { label: 'Basquete', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  voleibol: { label: 'Vôlei de quadra', category: 'coletivo', defaults: { formato: 'grupos', ...courtSports } },
  'volei-de-praia': { label: 'Vôlei de praia', category: 'duplas', defaults: { formato: 'grupos', ...doublesSports } },
  'beach-tennis': { label: 'Beach tennis', category: 'duplas', defaults: { formato: 'grupos', ...doublesSports } },
  tenis: { label: 'Tênis', category: 'individual', defaults: { formato: 'mata', ...individualSets } },
  padel: { label: 'Padel', category: 'duplas', defaults: { formato: 'grupos', ...doublesSports } },
  peteca: { label: 'Peteca', category: 'individual', defaults: { formato: 'liga', ...individualSets } },
  badminton: { label: 'Badminton', category: 'individual', defaults: { formato: 'grupos', ...individualSets } },
  judô: { label: 'Judô', category: 'lutas', defaults: { formato: 'mata', ...individualSports } },
  'jiu-jitsu': { label: 'Jiu-jitsu', category: 'lutas', defaults: { formato: 'mata', ...individualSports } },
  karatê: { label: 'Karatê', category: 'lutas', defaults: { formato: 'grupos', ...individualSports } },
  taekwondo: { label: 'Taekwondo', category: 'lutas', defaults: { formato: 'mata', ...individualSports } },
  'ginastica-artistica': { label: 'Ginástica artística', category: 'ginástica', defaults: { formato: 'ranking', ...individualSports } },
  'ginastica-ritmica': { label: 'Ginástica rítmica', category: 'ginástica', defaults: { formato: 'ranking', ...individualSports } },
  hóquei: { label: 'Hóquei', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  'futebol-americano': { label: 'Futebol americano', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  rugby: { label: 'Rugby', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  natação: { label: 'Natação', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  atletismo: { label: 'Atletismo', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  ciclismo: { label: 'Ciclismo', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  skate: { label: 'Skate', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  surf: { label: 'Surfe', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  'tenis-de-mesa': { label: 'Tênis de mesa', category: 'individual', defaults: { formato: 'grupos', ...individualSets } },
  squash: { label: 'Squash', category: 'individual', defaults: { formato: 'mata', ...individualSets } },
  xadrez: { label: 'Xadrez', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  'levantamento-peso': { label: 'Levantamento de peso', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  triatlo: { label: 'Triatlo', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  corrida: { label: 'Corrida de rua', category: 'individual', defaults: { formato: 'ranking', ...individualSports } },
  'e-sports': { label: 'E-sports', category: 'coletivo', defaults: { formato: 'grupos', ...teamSports } },
  'futebol-de-botao': { label: 'Futebol de botão', category: 'individual', defaults: { formato: 'mata', ...individualSports } },
  bocha: { label: 'Bocha', category: 'duplas', defaults: { formato: 'grupos', ...doublesSports } },
  curling: { label: 'Curling', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  polo: { label: 'Polo aquático', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
  'hockey-inline': { label: 'Hóquei inline', category: 'coletivo', defaults: { formato: 'liga', ...teamSports } },
};

export const CHAMPIONSHIP_TEMPLATES = Object.fromEntries(Object.entries(MODALITIES).map(([id, modality]) => [id, {
  label: modality.label,
  modalidade: id,
  formato: modality.defaults.formato,
  scoreType: modality.defaults.scoreType,
  rosterMode: modality.defaults.rosterMode,
  cfg: { turnos: 1, ...(modality.defaults.cfg || {}) },
}]));

export function templateConfig(template = 'futebol', model = '') {
  const aliases = { liga: 'futebol', grupos: 'futsal', mata: 'tenis' };
  const selected = CHAMPIONSHIP_TEMPLATES[template] || CHAMPIONSHIP_TEMPLATES[aliases[template]] || CHAMPIONSHIP_TEMPLATES.futebol;
  const modelConfig = COMPETITION_MODELS[model];
  const formato = modelConfig?.formatos[0] || selected.formato;
  const points = selected.scoreType === 'sets' ? { winPts: 2, drawPts: 0, lossPts: 0 } : selected.scoreType === 'points' ? { winPts: 1, drawPts: 0, lossPts: 0 } : { winPts: 3, drawPts: 1, lossPts: 0 };
  return { modalidade: selected.modalidade, modelo: modelConfig ? model : selected.formato, formato, scoreType: selected.scoreType, rosterMode: selected.rosterMode, cfg: { ...selected.cfg, ...points, ...(formato === 'grupos' ? { nGrupos: 2 } : {}), criterios: ['P', 'V', 'SG', 'GP', 'DISC'], discYellow: 1, discRed: 2 } };
}
