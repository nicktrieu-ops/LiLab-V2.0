export type PreviewRole = 'parent' | 'student' | 'teacher' | 'admin';

/** Sample accounts for the clickable preview. Everything about them is made up. */
export const PREVIEW_ACCOUNTS: Record<PreviewRole, { uid: string; email: string; displayName: string; role: PreviewRole }> = {
  parent: { uid: 'pv_parent', email: 'parent.preview@lilab.example', displayName: 'Chị Lan (sample parent)', role: 'parent' },
  student: { uid: 'pv_student', email: 'bao.preview@lilab.example', displayName: 'Bảo (sample student)', role: 'student' },
  teacher: { uid: 'pv_teacher', email: 'teacher.preview@lilab.example', displayName: 'Ms. Hannah (sample teacher)', role: 'teacher' },
  admin: { uid: 'pv_admin', email: 'admin.preview@lilab.example', displayName: 'LiLab office (sample admin)', role: 'admin' },
};

const ROLE_KEY = 'lilab_preview_role';

export function getPreviewRole(): PreviewRole {
  try {
    const stored = sessionStorage.getItem(ROLE_KEY) as PreviewRole | null;
    if (stored && stored in PREVIEW_ACCOUNTS) return stored;
  } catch {
    // storage blocked in the frame
  }
  return 'parent';
}

export function setPreviewRole(role: PreviewRole) {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    // storage blocked in the frame
  }
}
