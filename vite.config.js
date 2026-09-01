import { defineConfig } from 'vite';

export default defineConfig({
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
