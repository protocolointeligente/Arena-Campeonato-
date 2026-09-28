import { collection, doc, getDoc, getDocs, limit, runTransaction, startAfter, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase.js';
import { validate, schemas } from '../app/schemas.js';

export function registrationTeamKey(name) {
  return String(name || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export function registrationDocId(teamKey) {
  let hash = 2166136261;
  for (const char of registrationTeamKey(teamKey)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `team_${(hash >>> 0).toString(36)}`;
}

export function registrationPageSize(value = 500) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(500, Math.max(1, numeric)) : 500;
}

function registrationItem(item) { return { id: item.id, ...item.data() }; }

export async function listRegistrationsPage(championshipId, { pageSize = 500, cursor = null } = {}) {
  const constraints = [orderBy('created', 'desc')];
  if (cursor) {constraints.push(startAfter(await getDoc(doc(db, 'championships', championshipId, 'registrations', cursor))));}
  constraints.push(limit(registrationPageSize(pageSize)));
  const result = await getDocs(query(collection(db, 'championships', championshipId, 'registrations'), ...constraints));
  const items = result.docs.map(registrationItem);
  return { items, nextCursor: items.length === registrationPageSize(pageSize) ? items.at(-1)?.id || null : null };
}

export async function listRegistrations(championshipId) { return (await listRegistrationsPage(championshipId)).items; }
export async function submitRegistration(championshipId, data) {
  const payload = { ...data, rosterMode: data.rosterMode || 'team', teamName: data.teamName?.trim(), responsible: data.responsible?.trim(), phone: data.phone?.trim(), email: data.email?.trim() || '', coach: data.coach?.trim() || '' };
  const validation = validate(schemas.registration.submit, payload);
  if (!validation.ok) { throw new Error(validation.errors); }
  const publicSnap = await getDoc(doc(db, 'publicChampionships', championshipId));
  if (publicSnap.exists()) {
    let publicState = {};
    try { publicState = JSON.parse(publicSnap.data().data || '{}'); } catch { publicState = {}; }
    const configuredLimit = Number(publicState.cfg?.maxRoster);
    const maxRoster = Number.isInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 50) : 50;
    if (validation.data.athletes.length > maxRoster) {
      throw new Error(`Esta modalidade permite no máximo ${maxRoster} participantes.`);
    }
  }
  // Público não tem permissão de list; o id determinístico por nome + transação já barra duplicata.
  const registrationCollection = collection(db, 'championships', championshipId, 'registrations');
  const teamNameKey = registrationTeamKey(validation.data.teamName);
  const registrationRef = doc(registrationCollection, registrationDocId(teamNameKey));
  const registration = { ...validation.data, teamNameKey, status: 'pending', created: Date.now() };
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(registrationRef);
    if (existing.exists() && ['pending', 'approved'].includes(existing.data().status)) {
      throw new Error('Esta equipe já possui uma inscrição neste campeonato.');
    }
    transaction.set(registrationRef, registration);
  });
  return registrationRef;
}
export async function updateRegistration(championshipId, registrationId, data) { return updateDoc(doc(db, 'championships', championshipId, 'registrations', registrationId), data); }


