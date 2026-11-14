/** Search term cleanup: drop Arabic diacritics/tatweel, collapse spaces, cap length. Returns null if too short. */
export function searchTerm(raw?: string): string | null {
  if (!raw) return null;
  const t = raw
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return t.length >= 2 ? t : null;
}
