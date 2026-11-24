import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export const SERVER_SUPER_ADMIN_EMAILS = [
  'nickmyriam@gmail.com',
  'nicktrieu@gmail.com',
  'lilabvietnam@gmail.com',
] as const;

export function isServerSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return (SERVER_SUPER_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    if (decodedToken.email) {
      await getOrCreateUser({
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
        role: isServerSuperAdmin(decodedToken.email) ? 'super_admin' : undefined,
      }).catch((err) => {
        console.error('Background user sync failed:', err);
      });
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
