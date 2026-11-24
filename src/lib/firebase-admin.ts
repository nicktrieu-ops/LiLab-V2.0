import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
}

function loadAppletConfig(): AppletConfig {
  const candidates = [
    path.resolve(__dirname, '../../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];
  for (const configPath of candidates) {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppletConfig;
    }
  }
  return {};
}

const appletConfig = loadAppletConfig();
const projectId = appletConfig.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const storageBucket = process.env.LILAB_STORAGE_BUCKET || appletConfig.storageBucket;

if (!getApps().length) {
  initializeApp({
    ...(projectId ? { projectId } : {}),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

export const adminAuth = getAuth();

/** Firestore is the single source of truth in V2.0 (Cloud SQL retired). */
export const adminDb = appletConfig.firestoreDatabaseId
  ? getFirestore(appletConfig.firestoreDatabaseId)
  : getFirestore();

/** Cloud Storage holds curriculum PDFs and media that used to live in Postgres as base64. */
export function adminBucket() {
  return getStorage().bucket(storageBucket);
}
