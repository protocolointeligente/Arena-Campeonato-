import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = 'arena-campeonatos-v2-intervencao-19.html';
const outputPath = 'dist/index.html';
const html = await readFile(sourcePath, 'utf8');

const firebaseConfig = `const FIREBASE_CONFIG = {
  apiKey: "AIzaSyALN9uPafzN_KU-_NG_P1QtQth_P82xOsQ",
  authDomain: "arena-campeonatos-2c7ac.firebaseapp.com",
  projectId: "arena-campeonatos-2c7ac",
  storageBucket: "arena-campeonatos-2c7ac.firebasestorage.app",
  messagingSenderId: "151897061607",
  appId: "1:151897061607:web:786f47bcb11c505e130a42",
  measurementId: "G-LP5D508Y6X"
};`;

let output = html.replace(/const FIREBASE_CONFIG = \{[\s\S]*?\n\};/, firebaseConfig);
output = output.replace(/<link rel="manifest" href="[^"]*">/g, '<link rel="manifest" href="/manifest.webmanifest">');
output = output.replace(/<link rel="icon"[^>]*>/g, '<link rel="icon" type="image/svg+xml" href="/icons/icon.svg">');
output = output.replace(
  'return{nome:x.nome||\'Campeonato\',formato:x.formato||\'liga\',status:x.status||\'rascunho\',updated:Date.now(),data:JSON.stringify(x)};',
  'return{ownerUid:obj.ownerUid||\'\',nome:x.nome||\'Campeonato\',formato:x.formato||\'liga\',status:x.status||\'rascunho\',updated:Date.now(),data:JSON.stringify(x)};'
);

await writeFile(outputPath, output, 'utf8');
console.log(`Legacy UX prepared: ${outputPath}`);
