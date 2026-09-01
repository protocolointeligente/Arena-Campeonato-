import { addDoc, collection, doc, getDoc, getDocs, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase.js';
import { validate, schemas } from '../app/schemas.js';

export function registrationTeamKey(name) {
  return String(name || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export async function listRegistrations(championshipId) { const result = await getDocs(query(collection(db, 'championships', championshipId, 'registrations'), orderBy('created', 'desc'))); return result.docs.map((item) => ({ id: item.id, ...item.data() })); }
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
  const registrations = await getDocs(collection(db, 'championships', championshipId, 'registrations'));
  const teamKey = registrationTeamKey(validation.data.teamName);
  if (registrations.docs.some((item) => {
    const record = item.data();
    return ['pending', 'approved'].includes(record.status)
      && registrationTeamKey(record.teamNameKey || record.teamName) === teamKey;
  })) {
    throw new Error('Esta equipe já possui uma inscrição neste campeonato.');
  }
  return addDoc(collection(db, 'championships', championshipId, 'registrations'), { ...validation.data, teamNameKey: registrationTeamKey(validation.data.teamName), status: 'pending', created: Date.now() });
}
export async function updateRegistration(championshipId, registrationId, data) { return updateDoc(doc(db, 'championships', championshipId, 'registrations', registrationId), data); }


