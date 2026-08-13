import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyALN9uPafzN_KU-_NG_P1QtQth_P82xOsQ',
  authDomain: 'arena-campeonatos-2c7ac.firebaseapp.com',
  projectId: 'arena-campeonatos-2c7ac',
  storageBucket: 'arena-campeonatos-2c7ac.firebasestorage.app',
  messagingSenderId: '151897061607',
  appId: '1:151897061607:web:786f47bcb11c505e130a42',
  measurementId: 'G-LP5D508Y6X',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const observeAuth = (callback) => onAuthStateChanged(auth, callback);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
