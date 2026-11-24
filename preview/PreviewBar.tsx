import React, { useState } from 'react';
import { previewSignIn } from './mockAuth';
import { getPreviewRole, setPreviewRole, type PreviewRole } from './previewAccounts';

const ROLES: Array<{ id: PreviewRole; label: string }> = [
  { id: 'parent', label: 'Parent' },
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'admin', label: 'Admin' },
];

/** Floating bar that only exists in the preview build: pick a role and jump into that portal. */
export const PreviewBar: React.FC = () => {
  const [role, setRole] = useState<PreviewRole>(getPreviewRole());
  const [open, setOpen] = useState(true);

  const choose = (next: PreviewRole) => {
    setRole(next);
    setPreviewRole(next);
    previewSignIn(next);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[100] bottom-4 left-4 px-3 py-2 rounded-full bg-ink text-white text-xs font-bold shadow-lg cursor-pointer no-print"
      >
        Preview
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Preview controls"
      className="fixed z-[100] bottom-4 left-1/2 -translate-x-1/2 w-[min(640px,calc(100vw-2rem))] bg-ink text-white rounded-2xl shadow-[0_20px_50px_-15px_rgba(10,14,40,0.7)] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 no-print"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">LiLab V2.0 preview</p>
        <p className="text-xs text-white/65">Sample data in your browser only. AI features need the live server.</p>
      </div>
      <div role="radiogroup" aria-label="View as" className="inline-flex p-0.5 rounded-lg bg-white/10">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={role === r.id}
            onClick={() => choose(r.id)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-colors ${
              role === r.id ? 'bg-sun text-ink' : 'text-white/75 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Hide preview controls"
        className="text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
      >
        Hide
      </button>
    </div>
  );
};
