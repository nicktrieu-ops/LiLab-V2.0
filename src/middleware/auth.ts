import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';

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

/** Returns the verified Firebase user for a request, or null when there is no valid token. */
export async function getOptionalUser(req: Request): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length));
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await getOptionalUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sign in again to continue.' });
  }
  req.user = user;
  next();
};
