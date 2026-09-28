import { defineConfig } from 'vite';

// Identificador do deploy: o app compara com /version.json pra saber que saiu versão nova
// (telão aberto por horas recarrega sozinho; o painel mostra "Nova versão").
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID) },
  plugins: [{
    name: 'arena-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/app/reports.js') || id.includes('/src/app/pdf-utils.js')) {return 'reports';}
          if (id.includes('node_modules/firebase/app') || id.includes('node_modules/@firebase/app')) {return 'firebase-core';}
          if (id.includes('node_modules/firebase/firestore') || id.includes('node_modules/@firebase/firestore')) {return 'firebase-firestore';}
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {return 'firebase-auth';}
          if (id.includes('node_modules/firebase/storage') || id.includes('node_modules/@firebase/storage')) {return 'firebase-storage';}
          return undefined;
        },
      },
    },
  },
});
