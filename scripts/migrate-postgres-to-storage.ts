/**
 * One-time move off Cloud SQL (LiLab V2.0).
 *
 * Copies the two Postgres tables that held files (protected_materials, media_assets)
 * into Cloud Storage, then reports how many rows each academy table had so you can
 * confirm Firestore already holds the same records before deleting the instance.
 *
 * Run once from a machine that can reach the database:
 *   SQL_HOST=... SQL_USER=... SQL_PASSWORD=... SQL_DB_NAME=... \
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json \
 *   npx tsx scripts/migrate-postgres-to-storage.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { adminDb } from '../src/lib/firebase-admin.ts';
import { saveProtectedMaterial } from '../src/services/storageMaterials.ts';
import { adminBucket } from '../src/lib/firebase-admin.ts';

const TABLE_TO_COLLECTION: Record<string, string> = {
  users: 'users',
  user_invites: 'user_invites',
  teachers: 'teachers',
  students: 'students',
  programs: 'programs',
  academy_classes: 'classes',
  schedules: 'schedules',
  assessments: 'assessments',
  gemini_notes: 'gemini_notes',
  invoices: 'invoices',
  payables: 'payables',
  enrollments: 'enrollments',
  payment_methods: 'payment_methods',
  quick_notes: 'quick_notes',
};

async function main() {
  const client = new pg.Client({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });
  await client.connect();

  const materials = await client.query(
    'select note_id, file_name, mime_type, content_base64, raw_text, uploaded_by_uid from protected_materials'
  );
  for (const row of materials.rows) {
    await saveProtectedMaterial({
      noteId: row.note_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      contentBase64: row.content_base64 || undefined,
      rawText: row.raw_text || undefined,
      uploadedByUid: row.uploaded_by_uid,
    });
    console.log(`material  ${row.note_id}`);
  }

  const media = await client.query('select key, mime_type, data_base64 from media_assets');
  for (const row of media.rows) {
    await adminBucket()
      .file(`media/${row.key}`)
      .save(Buffer.from(row.data_base64, 'base64'), {
        contentType: row.mime_type,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
    console.log(`media     ${row.key}`);
  }

  console.log('\nRow counts (Postgres vs Firestore). Investigate any table where Postgres is higher.');
  for (const [table, collection] of Object.entries(TABLE_TO_COLLECTION)) {
    const sqlCount = Number((await client.query(`select count(*)::int as n from ${table}`)).rows[0].n);
    const fsCount = (await adminDb.collection(collection).count().get()).data().count;
    const flag = sqlCount > fsCount ? '  <-- check' : '';
    console.log(`${table.padEnd(18)} postgres=${String(sqlCount).padStart(5)}  firestore=${String(fsCount).padStart(5)}${flag}`);
  }

  await client.end();
  console.log(`\nDone. Copied ${materials.rowCount} materials and ${media.rowCount} media files to Cloud Storage.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
