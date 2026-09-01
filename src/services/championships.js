import { collection, doc, getDoc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { clone } from '../app/utils.ts';

const privateCollection = collection(db, 'championships');
const publicCollection = collection(db, 'publicChampionships');

function parseSnapshot(snapshot) {
  const data = snapshot.data();
  let state = {};
  try { state = JSON.parse(data.data || '{}'); } catch { state = {}; }
  return { ...state, id: snapshot.id, ownerUid: data.ownerUid, ownerEmail: data.ownerEmail || state.ownerEmail || '' };
}

function publicState(value) {
  const state = clone(value);
  delete state.collaborators; delete state.ownerEmail; delete state.ownerUid; delete state.billing; delete state._catLoaded;
  (state.categories || []).forEach((category) => (category.teams || []).forEach((team) => { delete team.registration; (team.roster || []).forEach((athlete) => delete athlete.foto); }));
  (state.teams || []).forEach((team) => { delete team.registration; (team.roster || []).forEach((athlete) => delete athlete.foto); });
  return state;
}

function payload(value) {
  const user = auth.currentUser;
  if (!user) {throw new Error('Faça login');}
  const ownerUid = value.ownerUid || user.uid;
  const ownerEmail = (value.ownerEmail || user.email || '').toLowerCase();
  const collaborators = Array.isArray(value.collaborators) ? value.collaborators.filter((item) => item.status !== 'revoked') : [];
  const byRole = (role) => collaborators.filter((item) => item.role === role).map((item) => (item.email || '').toLowerCase()).filter(Boolean);
  const teams = value.teams || [];
  const athletes = teams.reduce((total, team) => total + (team.roster || []).length, 0);
  return { ownerUid, ownerEmail, collaboratorEmails: collaborators.map((item) => (item.email || '').toLowerCase()).filter(Boolean), adminEmails: byRole('admin'), resultsEmails: byRole('results'), registrationEmails: byRole('registrations'), viewerEmails: byRole('viewer'), public: true, nome: value.nome || 'Campeonato', formato: value.formato, status: value.status || 'rascunho', teamCount: teams.length, athleteCount: athletes, updated: Date.now(), data: JSON.stringify({ ...value, ownerUid, ownerEmail, _catLoaded: undefined }) };
}

export async function listMine() {
  const user = auth.currentUser;
  if (!user) {return [];}
  const [owned, shared] = await Promise.all([
    getDocs(query(privateCollection, where('ownerUid', '==', user.uid))),
    getDocs(query(privateCollection, where('collaboratorEmails', 'array-contains', (user.email || '').toLowerCase()))),
  ]);
  const map = new Map();
  [owned, shared].forEach((result) => result.forEach((snapshot) => { const data = snapshot.data(); map.set(snapshot.id, { id: snapshot.id, nome: data.nome, formato: data.formato, status: data.status || 'em_andamento', updated: data.updated || 0, shared: data.ownerUid !== user.uid }); }));
  return [...map.values()].sort((a, b) => b.updated - a.updated);
}

export async function getChampionship(id) { const snapshot = await getDoc(doc(privateCollection, id)); return snapshot.exists() ? parseSnapshot(snapshot) : null; }

export function subscribeChampionship(id, cb) {
  return onSnapshot(doc(privateCollection, id), (snapshot) => {
    cb(snapshot.exists() ? parseSnapshot(snapshot) : null);
  }, () => cb(null));
}

export async function saveChampionship(value) {
  const batch = writeBatch(db);
  batch.set(doc(privateCollection, value.id), payload(value));
  batch.set(doc(publicCollection, value.id), { ownerUid: payload(value).ownerUid, nome: value.nome || 'Campeonato', formato: value.formato || 'liga', status: value.status || 'rascunho', updated: Date.now(), data: JSON.stringify(publicState(value)) });
  await batch.commit();
}

export async function removeChampionship(id) { const batch = writeBatch(db); batch.delete(doc(privateCollection, id)); batch.delete(doc(publicCollection, id)); await batch.commit(); }


