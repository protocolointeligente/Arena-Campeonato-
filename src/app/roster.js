import { uid } from './utils.js';

export function teamById(state, id) {
  return (state.teams || []).find((team) => team.id === id) || null;
}

export function athleteById(state, athleteId) {
  for (const team of state.teams || []) {
    const athlete = (team.roster || []).find((item) => item.id === athleteId);
    if (athlete) return { athlete, team };
  }
  return null;
}

export function athName(state, athleteId) {
  const result = athleteById(state, athleteId);
  return result ? result.athlete.nome : '—';
}

export function teamNameById(state, id) {
  const team = teamById(state, id);
  return team ? team.nome : null;
}

export function addAthlete(team, { nome, dob, numero }) {
  const trimmed = (nome || '').trim();
  if (!trimmed) return { ok: false, reason: 'Informe o nome.' };
  team.roster = team.roster || [];
  const athlete = { id: uid(), nome: trimmed, dob: (dob || '').trim(), numero: (numero || '').trim(), foto: '' };
  team.roster.push(athlete);
  return { ok: true, athlete };
}

export function updateAthlete(team, athleteId, { nome, dob, numero }) {
  const athlete = (team.roster || []).find((item) => item.id === athleteId);
  if (!athlete) return { ok: false, reason: 'Atleta não encontrado.' };
  const before = { ...athlete };
  const trimmedNome = (nome || '').trim();
  athlete.nome = trimmedNome || athlete.nome;
  if (dob !== undefined) athlete.dob = (dob || '').trim();
  if (numero !== undefined) athlete.numero = (numero || '').trim();
  return { ok: true, before, after: { ...athlete } };
}

export function removeAthlete(team, athleteId) {
  const before = (team.roster || []).length;
  team.roster = (team.roster || []).filter((item) => item.id !== athleteId);
  return { ok: team.roster.length < before };
}

export function setAthletePhoto(team, athleteId, dataUrl) {
  const athlete = (team.roster || []).find((item) => item.id === athleteId);
  if (!athlete) return { ok: false };
  athlete.foto = dataUrl;
  return { ok: true };
}

export function setTeamLogo(team, dataUrl) {
  if (!team) return { ok: false };
  team.logo = dataUrl;
  return { ok: true };
}

export function compressPhoto(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
