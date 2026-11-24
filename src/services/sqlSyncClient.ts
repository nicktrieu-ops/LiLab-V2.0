import { auth } from '../firebase';
import type { AcademyCollectionName } from '../db/academyRepo';

const SYNC_TIMEOUT_MS = 8000;

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

const SQL_SYNCED_COLLECTIONS = new Set<AcademyCollectionName>([
  'users',
  'user_invites',
  'teachers',
  'students',
  'programs',
  'classes',
  'schedules',
  'assessments',
  'gemini_notes',
  'invoices',
  'payables',
  'enrollments',
  'payment_methods',
  'quick_notes',
]);

async function postWithTimeout(
  url: string,
  options: RequestInit
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mirrors a single Firestore record into PostgreSQL asynchronously without
 * blocking optimistic UI updates if SQL mirror latency spikes.
 */
export async function syncRecordToSql(
  col: AcademyCollectionName,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!SQL_SYNCED_COLLECTIONS.has(col)) return;
  try {
    const headers = await getAuthHeaders();
    if (!headers) return;
    await postWithTimeout('/api/sql/upsert', {
      method: 'POST',
      headers,
      body: JSON.stringify({ collection: col, id, data }),
    });
  } catch (err) {
    console.warn('SQL sync skipped:', err);
  }
}

export async function syncBatchToSql(
  items: Array<{ collection: AcademyCollectionName; id: string; data: Record<string, unknown> }>
): Promise<void> {
  const validItems = items.filter((item) => SQL_SYNCED_COLLECTIONS.has(item.collection));
  if (validItems.length === 0) return;
  try {
    const headers = await getAuthHeaders();
    if (!headers) return;
    await postWithTimeout('/api/sql/upsert-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: validItems }),
    });
  } catch (err) {
    console.warn('SQL batch sync skipped:', err);
  }
}

export async function deleteRecordFromSql(
  col: AcademyCollectionName,
  id: string
): Promise<void> {
  if (!SQL_SYNCED_COLLECTIONS.has(col)) return;
  try {
    const headers = await getAuthHeaders();
    if (!headers) return;
    await postWithTimeout(
      `/api/sql/record/${encodeURIComponent(col)}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers,
      }
    );
  } catch (err) {
    console.warn('SQL delete sync skipped:', err);
  }
}

export async function resetAllSqlData(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    if (!headers) return;
    await postWithTimeout('/api/sql/reset-all', {
      method: 'POST',
      headers,
    });
  } catch (err) {
    console.warn('SQL reset sync skipped:', err);
  }
}
