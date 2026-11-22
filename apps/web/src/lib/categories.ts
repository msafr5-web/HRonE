import type { Tag } from './types';

export type Category = 'labor' | 'gosi' | 'nitaqat' | 'general';

export const CATEGORY_LABEL: Record<Category, string> = {
  labor: 'نظام العمل',
  gosi: 'التأمينات الاجتماعية',
  nitaqat: 'نطاقات',
  general: 'موارد بشرية',
};

// Threads carry tags, not a category field, so the category is derived from tag text.
const RULES: [Category, RegExp][] = [
  ['gosi', /تأمين|التأمينات|gosi|قوسي/i],
  ['nitaqat', /نطاق|nitaqat|سعود|توطين/i],
  ['labor', /نظام[_\s]?العمل|عمل|عقد|عقود|فصل|إنهاء|نهاية[_\s]?الخدمة|مكافأة|إجازة|labor|labour/i],
];

export function categoryOf(tags: Tag[]): Category {
  const text = tags.map((t) => `${t.slug} ${t.label}`).join(' ');
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return 'general';
}
