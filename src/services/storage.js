import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase.js';
import { resizeImage } from '../app/images.js';
import { compressPhoto } from '../app/roster.js';

const BRAND_SPEC = {
  logo: { maxW: 500, maxH: 500, quality: 0.82 },
  cover: { maxW: 1400, maxH: 700, quality: 0.72 },
};

async function uploadAndReplace(championshipId, path, file, spec) {
  const dataUrl = await resizeImage(file, spec.maxW, spec.maxH, spec.quality);
  if (!dataUrl) {return '';}
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadBrandImage(championshipId, kind, file, oldUrl = '') {
  const spec = BRAND_SPEC[kind];
  if (oldUrl) {
    try {
      const oldRef = ref(storage, oldUrl);
      await deleteObject(oldRef);
    } catch {
      // Image compression is best effort; the original file remains valid.
    }
  }
  const path = `championships/${championshipId}/branding/${kind}-${Date.now()}.jpg`;
  return uploadAndReplace(championshipId, path, file, spec);
}

export async function uploadSponsorLogo(championshipId, file, oldUrl = '') {
  if (oldUrl) {
    try {
      const oldRef = ref(storage, oldUrl);
      await deleteObject(oldRef);
    } catch {
      // Upload failures are surfaced by the caller.
    }
  }
  const dataUrl = await resizeImage(file, 360, 180, 0.78);
  if (!dataUrl) {return '';}
  const path = `championships/${championshipId}/sponsors/${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadAthletePhoto(championshipId, file, oldUrl = '') {
  if (oldUrl) {
    try {
      const oldRef = ref(storage, oldUrl);
      await deleteObject(oldRef);
    } catch {
      // Firebase errors are returned to the caller.
    }
  }
  const dataUrl = await compressPhoto(file);
  if (!dataUrl) {return '';}
  const path = `championships/${championshipId}/athletes/${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadTeamLogo(championshipId, file, oldUrl = '') {
  if (oldUrl) {
    try {
      const oldRef = ref(storage, oldUrl);
      await deleteObject(oldRef);
    } catch {
      // Firebase errors are returned to the caller.
    }
  }
  const dataUrl = await compressPhoto(file);
  if (!dataUrl) {return '';}
  const path = `championships/${championshipId}/teams/${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function deleteImageByUrl(url) {
  if (!url) {return;}
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    } catch {
      // Firebase errors are returned to the caller.
    }
}


