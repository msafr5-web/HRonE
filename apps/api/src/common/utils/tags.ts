/**
 * Tag normalisation for Arabic + Latin hashtags:
 * strips '#', diacritics (tashkeel), tatweel; unifies alef/ya/ta-marbuta variants; lowercases Latin.
 * The first-written text is kept as `label`, the normalised form is the unique `slug`.
 */
export function normalizeTag(raw: string): { slug: string; label: string } | null {
  const label = raw.normalize('NFKC').replace(/^#+/, '').trim().slice(0, 30);
  const slug = label
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[آأإ]/g, 'ا') // أ إ آ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replace(/\s+/g, '_');
  if (slug.length < 2) return null;
  return { slug, label: label.replace(/\s+/g, '_') };
}

export function normalizeTags(raw: string[] | undefined, max = 5) {
  const seen = new Map<string, { slug: string; label: string }>();
  for (const t of raw ?? []) {
    const n = normalizeTag(t);
    if (n && !seen.has(n.slug)) seen.set(n.slug, n);
    if (seen.size >= max) break;
  }
  return [...seen.values()];
}
