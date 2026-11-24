import { getDocs, type Query, type QuerySnapshot, type DocumentData, type CollectionReference } from 'firebase/firestore';

/**
 * V2 cost control for slow-changing catalogue collections (programs, curriculum notes,
 * bank details, academy events). Parents, students and teachers only read these, so a
 * live listener per screen is wasted reads. This fetches once, shares the result between
 * every screen that asks within the TTL, and has the same call shape as onSnapshot so the
 * call sites barely change. Admin screens keep live listeners because admins edit these.
 */
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; snap: Promise<QuerySnapshot<DocumentData>> }>();

export function readCatalogue(
  key: string,
  ref: Query<DocumentData> | CollectionReference<DocumentData>,
  onNext: (snap: QuerySnapshot<DocumentData>) => void,
  onError?: (err: unknown) => void,
  ttlMs = DEFAULT_TTL_MS
): () => void {
  let active = true;
  let entry = cache.get(key);
  if (!entry || Date.now() - entry.at > ttlMs) {
    const snap = getDocs(ref);
    entry = { at: Date.now(), snap };
    cache.set(key, entry);
    snap.catch(() => cache.delete(key));
  }
  entry.snap.then(
    (snap) => {
      if (active) onNext(snap);
    },
    (err) => {
      if (active && onError) {
        try {
          onError(err);
        } catch {
          // handlers such as handleFirestoreError rethrow; nothing else to do here
        }
      }
    }
  );
  return () => {
    active = false;
  };
}

/** Drop a cached catalogue so the next read fetches fresh data (call after an edit). */
export function invalidateCatalogue(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
