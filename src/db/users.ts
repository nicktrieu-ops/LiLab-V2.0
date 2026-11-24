import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export interface UpsertSqlUserInput {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  phone?: string;
  photoUrl?: string;
  preferredLang?: string;
  claimedInviteId?: string;
  status?: string;
}

export async function getOrCreateUser(input: UpsertSqlUserInput) {
  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.uid, input.uid))
      .limit(1);

    const nextDisplayName = input.displayName ?? existing?.displayName ?? input.email.split('@')[0];
    const nextRole = input.role ?? existing?.role ?? 'parent';
    const nextLang = input.preferredLang ?? existing?.preferredLang ?? 'vi';
    const nextPhone = input.phone ?? existing?.phone ?? '';
    const nextPhotoUrl = input.photoUrl ?? existing?.photoUrl ?? '';
    const nextStatus = input.status ?? existing?.status ?? 'active';
    const nextInvite = input.claimedInviteId ?? existing?.claimedInviteId ?? '';

    const result = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: input.email.toLowerCase(),
        displayName: nextDisplayName,
        role: nextRole,
        phone: nextPhone,
        photoUrl: nextPhotoUrl,
        preferredLang: nextLang,
        claimedInviteId: nextInvite,
        status: nextStatus,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.email.toLowerCase(),
          displayName: nextDisplayName,
          role: nextRole,
          phone: nextPhone,
          photoUrl: nextPhotoUrl,
          preferredLang: nextLang,
          claimedInviteId: nextInvite,
          status: nextStatus,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to persist user profile.', { cause: error });
  }
}

export async function listSqlUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
