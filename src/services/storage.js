import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase.js';
import { resizeImage } from '../app/images.js';

const BRAND_SPEC = {
  logo: { maxW: 500, maxH: 500, quality: 0.82 },
  cover: { maxW: 1400, maxH: 700, quality: 0.72 },
};

export async function uploadBrandImage(championshipId, kind, file) {
  const spec = BRAND_SPEC[kind];
  const dataUrl = await resizeImage(file, spec.maxW, spec.maxH, spec.quality);
  if (!dataUrl) return '';
  const path = `championships/${championshipId}/branding/${kind}-${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

export async function uploadSponsorLogo(championshipId, file) {
  const dataUrl = await resizeImage(file, 360, 180, 0.78);
  if (!dataUrl) return '';
  const path = `championships/${championshipId}/sponsors/${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

// ponytail: no delete-on-replace/remove — old Storage objects are orphaned
// when a logo/cover/sponsor image is replaced or a sponsor removed. Add
// deleteObject(fileRef) cleanup if Storage costs ever matter.
