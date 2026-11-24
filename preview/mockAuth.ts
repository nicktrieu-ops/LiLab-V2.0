/**
 * Preview-only stand-in for 'firebase/auth'. Any sign-in (Google, email, register)
 * signs in as the sample account for the role picked in the preview bar.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PREVIEW_ACCOUNTS, getPreviewRole, type PreviewRole } from './previewAccounts';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  getIdToken: () => Promise<string>;
  reload: () => Promise<void>;
}

type AuthLike = { currentUser: User | null };
const auth: AuthLike = { currentUser: null };
const subscribers = new Set<(u: User | null) => void>();

function userFor(role: PreviewRole): User {
  const acc = PREVIEW_ACCOUNTS[role];
  return {
    uid: acc.uid,
    email: acc.email,
    displayName: acc.displayName,
    photoURL: null,
    emailVerified: true,
    getIdToken: async () => 'preview-token',
    reload: async () => {},
  };
}

function emit() {
  for (const fn of subscribers) fn(auth.currentUser);
}

export function getAuth(..._args: any[]) {
  return auth;
}

export function onAuthStateChanged(_auth: AuthLike, cb: (u: User | null) => void) {
  subscribers.add(cb);
  queueMicrotask(() => cb(auth.currentUser));
  return () => subscribers.delete(cb);
}

export function previewSignIn(role: PreviewRole = getPreviewRole()) {
  auth.currentUser = userFor(role);
  emit();
  return { user: auth.currentUser };
}

export async function signInWithPopup(..._args: any[]) {
  return previewSignIn();
}
export async function signInWithEmailAndPassword(..._args: any[]) {
  return previewSignIn();
}
export async function createUserWithEmailAndPassword(..._args: any[]) {
  return previewSignIn();
}
export async function signOut(..._args: any[]) {
  auth.currentUser = null;
  emit();
}
export async function sendEmailVerification(..._args: any[]) {}
export async function updateProfile(..._args: any[]) {}
export async function sendPasswordResetEmail(..._args: any[]) {}

export class GoogleAuthProvider {
  setCustomParameters(_p: Record<string, string>) {}
  addScope(_s: string) {}
}
