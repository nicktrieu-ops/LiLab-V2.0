/**
 * Preview-only stand-in for 'firebase/firestore' (aliased in vite.config.ts when
 * building with --mode preview). Keeps every collection in memory so the whole app can
 * be clicked through with sample data and no Firebase project, network or billing.
 * Writes work and live listeners update, but nothing leaves the browser tab.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DocumentData = Record<string, any>;
export type Firestore = { __preview: true };
export type CollectionReference<T = DocumentData> = { kind: 'collection'; path: string; __t?: T };
export type DocumentReference<T = DocumentData> = { kind: 'doc'; col: string; id: string; path: string; __t?: T };
type Constraint =
  | { kind: 'where'; field: string; op: string; value: any }
  | { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { kind: 'limit'; n: number };
export type Query<T = DocumentData> = { kind: 'query'; path: string; constraints: Constraint[]; __t?: T };
export type QueryConstraint = Constraint;

const store = new Map<string, Map<string, DocumentData>>();
type Listener = { col: string; fire: () => void };
const listeners = new Set<Listener>();

const table = (col: string) => {
  let t = store.get(col);
  if (!t) {
    t = new Map();
    store.set(col, t);
  }
  return t;
};

let autoId = 0;
const newId = () => `pv_${Date.now().toString(36)}_${(autoId++).toString(36)}`;

// ---- sentinels -------------------------------------------------------------
class PreviewTimestamp {
  constructor(public ms: number) {}
  get seconds() {
    return Math.floor(this.ms / 1000);
  }
  get nanoseconds() {
    return 0;
  }
  toDate() {
    return new Date(this.ms);
  }
  toMillis() {
    return this.ms;
  }
  toJSON() {
    return new Date(this.ms).toISOString();
  }
}
export const Timestamp = {
  now: () => new PreviewTimestamp(Date.now()),
  fromDate: (d: Date) => new PreviewTimestamp(d.getTime()),
  fromMillis: (ms: number) => new PreviewTimestamp(ms),
};
const SERVER_TS = { __sentinel: 'serverTimestamp' };
export const serverTimestamp = () => SERVER_TS;
export const arrayUnion = (...values: any[]) => ({ __sentinel: 'arrayUnion', values });
export const arrayRemove = (...values: any[]) => ({ __sentinel: 'arrayRemove', values });
export const increment = (n: number) => ({ __sentinel: 'increment', n });
export const deleteField = () => ({ __sentinel: 'delete' });

function resolveValue(next: any, prev: any): any {
  if (next && typeof next === 'object' && next.__sentinel) {
    switch (next.__sentinel) {
      case 'serverTimestamp':
        return new PreviewTimestamp(Date.now());
      case 'arrayUnion':
        return [...(Array.isArray(prev) ? prev : []), ...next.values.filter((v: any) => !(prev || []).includes(v))];
      case 'arrayRemove':
        return (Array.isArray(prev) ? prev : []).filter((v: any) => !next.values.includes(v));
      case 'increment':
        return (Number(prev) || 0) + next.n;
      case 'delete':
        return undefined;
    }
  }
  return next;
}

function applyFields(target: DocumentData, data: DocumentData) {
  for (const [rawKey, value] of Object.entries(data)) {
    const parts = rawKey.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] && typeof node[parts[i]] === 'object' ? { ...node[parts[i]] } : {};
      node = node[parts[i]];
    }
    const last = parts[parts.length - 1];
    const resolved = resolveValue(value, node[last]);
    if (resolved === undefined) delete node[last];
    else node[last] = resolved;
  }
}

// ---- references ------------------------------------------------------------
export function getFirestore(..._args: any[]): Firestore {
  return { __preview: true };
}
export const initializeFirestore = getFirestore;
export const persistentLocalCache = (..._args: any[]) => ({});
export const persistentMultipleTabManager = () => ({});
export const memoryLocalCache = () => ({});

export function collection(_db: any, path: string, ...rest: string[]): CollectionReference {
  return { kind: 'collection', path: [path, ...rest].join('/') };
}

export function doc(base: any, path?: string, ...rest: string[]): DocumentReference {
  if (base && base.kind === 'collection') {
    const id = path || newId();
    return { kind: 'doc', col: base.path, id, path: `${base.path}/${id}` };
  }
  const segments = [path, ...rest].filter(Boolean).join('/').split('/');
  const id = segments.pop() as string;
  const col = segments.join('/');
  return { kind: 'doc', col, id, path: `${col}/${id}` };
}

export function where(field: string, op: string, value: any): Constraint {
  return { kind: 'where', field, op, value };
}
export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Constraint {
  return { kind: 'orderBy', field, dir };
}
export function limit(n: number): Constraint {
  return { kind: 'limit', n };
}
export function query(ref: CollectionReference | Query, ...constraints: Constraint[]): Query {
  const base = ref.kind === 'query' ? ref.constraints : [];
  return { kind: 'query', path: ref.path, constraints: [...base, ...constraints] };
}

// ---- snapshots -------------------------------------------------------------
const getField = (data: DocumentData, field: string) =>
  field.split('.').reduce<any>((v, k) => (v == null ? v : v[k]), data);
const comparable = (v: any) => (v instanceof PreviewTimestamp ? v.ms : v);

function matches(data: DocumentData, c: Extract<Constraint, { kind: 'where' }>): boolean {
  const v = comparable(getField(data, c.field));
  const t = comparable(c.value);
  switch (c.op) {
    case '==':
      return v === t;
    case '!=':
      return v !== t && v !== undefined;
    case '<':
      return v < t;
    case '<=':
      return v <= t;
    case '>':
      return v > t;
    case '>=':
      return v >= t;
    case 'in':
      return Array.isArray(t) && t.includes(v);
    case 'not-in':
      return Array.isArray(t) && !t.includes(v) && v !== undefined;
    case 'array-contains':
      return Array.isArray(v) && v.includes(t);
    case 'array-contains-any':
      return Array.isArray(v) && Array.isArray(t) && t.some((x: any) => v.includes(x));
    default:
      return true;
  }
}

function makeDocSnap(col: string, id: string, data: DocumentData | undefined) {
  const copy = data ? structuredCloneSafe(data) : undefined;
  return {
    id,
    ref: { kind: 'doc', col, id, path: `${col}/${id}` } as DocumentReference,
    exists: () => copy !== undefined,
    data: () => (copy ? structuredCloneSafe(copy) : undefined),
    get: (field: string) => (copy ? getField(copy, field) : undefined),
    metadata: { hasPendingWrites: false, fromCache: false },
  };
}

function structuredCloneSafe<T>(v: T): T {
  if (v instanceof PreviewTimestamp) return new PreviewTimestamp(v.ms) as T;
  if (Array.isArray(v)) return v.map(structuredCloneSafe) as T;
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = structuredCloneSafe(val);
    return out;
  }
  return v;
}

function runQuery(ref: CollectionReference | Query) {
  let rows = [...table(ref.path).entries()].map(([id, data]) => ({ id, data }));
  const constraints = ref.kind === 'query' ? ref.constraints : [];
  for (const c of constraints) if (c.kind === 'where') rows = rows.filter((r) => matches(r.data, c));
  for (const c of constraints) {
    if (c.kind === 'orderBy') {
      rows = rows.filter((r) => getField(r.data, c.field) !== undefined);
      rows.sort((a, b) => {
        const x = comparable(getField(a.data, c.field));
        const y = comparable(getField(b.data, c.field));
        const cmp = x < y ? -1 : x > y ? 1 : 0;
        return c.dir === 'desc' ? -cmp : cmp;
      });
    }
  }
  for (const c of constraints) if (c.kind === 'limit') rows = rows.slice(0, c.n);
  const docs = rows.map((r) => makeDocSnap(ref.path, r.id, r.data));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn),
    docChanges: () => docs.map((d) => ({ type: 'added', doc: d })),
    metadata: { hasPendingWrites: false, fromCache: false },
  };
}
export type QuerySnapshot<_T = DocumentData> = ReturnType<typeof runQuery>;
export type DocumentSnapshot<_T = DocumentData> = ReturnType<typeof makeDocSnap>;

// ---- reads -----------------------------------------------------------------
export async function getDocs(ref: CollectionReference | Query) {
  return runQuery(ref);
}
export async function getDoc(ref: DocumentReference) {
  return makeDocSnap(ref.col, ref.id, table(ref.col).get(ref.id));
}
export const getDocFromServer = getDoc;
export const getDocsFromServer = getDocs;
export async function getCountFromServer(ref: CollectionReference | Query) {
  const n = runQuery(ref).size;
  return { data: () => ({ count: n }) };
}

export function onSnapshot(ref: any, ...args: any[]): () => void {
  const handlers = args.filter((a) => typeof a === 'function');
  const objHandler = args.find((a) => a && typeof a === 'object' && (a.next || a.error));
  const next = handlers[0] || objHandler?.next;
  const col = ref.kind === 'doc' ? ref.col : ref.path;
  let active = true;
  const fire = () => {
    if (!active || !next) return;
    const snap = ref.kind === 'doc' ? makeDocSnap(ref.col, ref.id, table(ref.col).get(ref.id)) : runQuery(ref);
    next(snap);
  };
  const entry = { col, fire };
  listeners.add(entry);
  queueMicrotask(fire);
  return () => {
    active = false;
    listeners.delete(entry);
  };
}

function notify(col: string) {
  queueMicrotask(() => {
    for (const l of listeners) if (l.col === col) l.fire();
  });
}

// ---- writes ----------------------------------------------------------------
export async function setDoc(ref: DocumentReference, data: DocumentData, options?: { merge?: boolean }) {
  const t = table(ref.col);
  const base = options?.merge ? { ...(t.get(ref.id) || {}) } : {};
  applyFields(base, data);
  t.set(ref.id, base);
  notify(ref.col);
}
export async function updateDoc(ref: DocumentReference, data: DocumentData) {
  const t = table(ref.col);
  if (!t.has(ref.id)) throw new Error(`No document to update: ${ref.path}`);
  const base = { ...(t.get(ref.id) as DocumentData) };
  applyFields(base, data);
  t.set(ref.id, base);
  notify(ref.col);
}
export async function addDoc(ref: CollectionReference, data: DocumentData) {
  const d = doc(ref);
  await setDoc(d, data);
  return d;
}
export async function deleteDoc(ref: DocumentReference) {
  table(ref.col).delete(ref.id);
  notify(ref.col);
}
export function writeBatch(_db?: any) {
  const ops: Array<() => Promise<void>> = [];
  const batch = {
    set: (ref: DocumentReference, data: DocumentData, o?: { merge?: boolean }) => (ops.push(() => setDoc(ref, data, o)), batch),
    update: (ref: DocumentReference, data: DocumentData) => (ops.push(() => updateDoc(ref, data)), batch),
    delete: (ref: DocumentReference) => (ops.push(() => deleteDoc(ref)), batch),
    commit: async () => {
      for (const op of ops) await op();
    },
  };
  return batch;
}
export async function runTransaction(_db: any, fn: (tx: any) => Promise<any>) {
  const tx = {
    get: getDoc,
    set: (r: DocumentReference, d: DocumentData, o?: { merge?: boolean }) => (void setDoc(r, d, o), tx),
    update: (r: DocumentReference, d: DocumentData) => (void updateDoc(r, d), tx),
    delete: (r: DocumentReference) => (void deleteDoc(r), tx),
  };
  return fn(tx);
}

/** Preview helper: load sample records without going through the app. */
export function __previewSeed(col: string, id: string, data: DocumentData) {
  const copy = { ...data };
  applyFields(copy, {});
  for (const [k, v] of Object.entries(copy)) copy[k] = resolveValue(v, undefined);
  table(col).set(id, copy);
}
