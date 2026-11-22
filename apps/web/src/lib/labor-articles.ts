/**
 * Saudi Labor Law quick references shown in popovers.
 *
 * IMPORTANT — LEGAL REVIEW REQUIRED BEFORE RELYING ON THESE: the summaries are brief, guidance-only paraphrases.
 * The law was amended in 2025 and article numbering/wording may differ from the version a user quotes.
 * Verify every entry against the current official text (Ministry of Human Resources / Umm Al-Qura) and flip
 * `reviewed` to true once checked. The UI always shows the disclaimer below.
 */
export interface LaborArticle { title: string; summary: string; reviewed: boolean }

export const LABOR_DISCLAIMER = 'ملخص إرشادي وليس استشارة قانونية — راجع النص الرسمي لنظام العمل.';

export const LABOR_ARTICLES: Record<number, LaborArticle> = {
  77: {
    title: 'المادة 77 — التعويض عن إنهاء العقد لسبب غير مشروع',
    summary: 'إذا أُنهي العقد دون سبب مشروع، يستحق الطرف المتضرر تعويضاً يُحدَّد بحسب نوع العقد (محدد المدة أو غير محدد المدة) ومدة الخدمة.',
    reviewed: false,
  },
  80: {
    title: 'المادة 80 — الفسخ دون مكافأة أو إشعار',
    summary: 'تحدد الحالات التي يجوز فيها لصاحب العمل إنهاء العقد دون مكافأة أو إشعار أو تعويض، مثل الاعتداء أو الإخلال الجسيم بالالتزامات أو التغيب المتكرر دون عذر، بعد استيفاء الإجراءات النظامية.',
    reviewed: false,
  },
  81: {
    title: 'المادة 81 — ترك العامل للعمل دون إشعار',
    summary: 'تحدد الحالات التي يجوز فيها للعامل ترك العمل دون إشعار مع بقاء استحقاقه، مثل إخلال صاحب العمل بالتزاماته الجوهرية أو تعريضه لخطر جسيم.',
    reviewed: false,
  },
  84: {
    title: 'المادة 84 — مكافأة نهاية الخدمة',
    summary: 'عند انتهاء علاقة العمل يدفع صاحب العمل مكافأة نهاية الخدمة للعامل، وتُحسب على أساس الأجر الأخير ومدة الخدمة بحسب النظام ولائحته.',
    reviewed: false,
  },
};

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toWesternDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
