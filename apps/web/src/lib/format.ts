import type { Author, Role } from './types';

const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'الآن';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  let best: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const u of units) if (abs >= u[1]) best = u;
  return rtf.format(Math.round(diff / best[1]), best[0]);
}

export const dateAr = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });

/** Arabic: first letter of the first name only (two joined Arabic letters can fuse into a ligature such as "لا"). Latin: two initials. */
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (/[؀-ۿ]/.test(parts[0] ?? '')) return parts[0][0];
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'عضو',
  HR_SPECIALIST: 'أخصائي موارد بشرية',
  LEGAL_CONSULTANT: 'مستشار قانوني',
  ADMIN: 'الإدارة',
};

export const isExpert = (a: Pick<Author, 'role' | 'verification'>) =>
  (a.role === 'HR_SPECIALIST' || a.role === 'LEGAL_CONSULTANT') && a.verification === 'VERIFIED';

/** Compact Arabic-friendly numbers (1,2 ألف). */
export const compact = (n: number) => new Intl.NumberFormat('ar-SA-u-nu-latn', { notation: 'compact' }).format(n);
