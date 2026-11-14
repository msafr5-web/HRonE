import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * ⚠️ DRAFT TEXT. These pages must be reviewed and approved by a qualified Saudi lawyer
 * (including PDPL obligations) before public launch.
 */
const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  rules: {
    title: 'قواعد المجتمع',
    sections: [
      ['الاحترام', 'نتناقش بمهنية. لا للإساءة أو التحريض أو السخرية من الأشخاص أو الجنسيات أو الفئات.'],
      ['الخصوصية', 'لا تنشر أسماء أشخاص أو أرقام هوية أو عقوداً أو مراسلات خاصة. استخدم «النشر المجهول» عند عرض نزاع شخصي.'],
      ['الدقة', 'أشِر إلى المادة النظامية أو المصدر الرسمي عند الاستشهاد، وميّز بين الرأي والنص النظامي.'],
      ['عدم الاستشارة القانونية', 'المحتوى آراء مجتمعية لأغراض معرفية ولا يُعد استشارة قانونية. للحالات الرسمية راجع الجهة المختصة أو محامياً مرخّصاً.'],
      ['المحتوى المخالف', 'يُخفى المحتوى المبلَّغ عنه بعد المراجعة، وقد يُعلَّق الحساب عند تكرار المخالفة.'],
      ['التوثيق', 'شارة «خبير موثّق» تُمنح بعد مراجعة يدوية للإثباتات، ويمكن سحبها عند المخالفة.'],
    ],
  },
  terms: {
    title: 'شروط الاستخدام',
    sections: [
      ['مسودة', 'هذا نص مبدئي يلزم اعتماده من مستشار قانوني قبل الإطلاق العام.'],
      ['الخدمة', 'HRonE منصة مجتمعية للنقاش المهني في الموارد البشرية. لا تقدّم المنصة استشارات قانونية مرخّصة.'],
      ['المحتوى', 'يتحمل المستخدم مسؤولية ما ينشره، ويمنح المنصة ترخيصاً لعرضه ضمن الخدمة.'],
      ['الاشتراكات', 'تفاصيل الباقات والاسترداد تُحدَّد عند تفعيل خدمة الدفع.'],
    ],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    sections: [
      ['مسودة', 'هذا نص مبدئي يلزم اعتماده من مستشار قانوني وفق نظام حماية البيانات الشخصية قبل الإطلاق العام.'],
      ['البيانات التي نجمعها', 'الاسم، البريد الإلكتروني، المحتوى الذي تنشره، والرسائل الخاصة، وبيانات تقنية لازمة للأمان.'],
      ['كلمات المرور', 'تُخزَّن مجزأة بخوارزمية حديثة ولا يمكن لفريقنا الاطلاع عليها.'],
      ['حقوقك', 'يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذف حسابك.'],
      ['الاستضافة', 'موقع استضافة البيانات وآليات النقل خارج المملكة (إن وُجدت) تُوثَّق قبل الإطلاق.'],
    ],
  },
};

type Props = { params: Promise<{ doc: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = DOCS[(await params).doc];
  return { title: d?.title ?? 'غير موجود' };
}
export default async function LegalPage({ params }: Props) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <article className="card mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-extrabold">{d.title}</h1>
      {d.sections.map(([h, t]) => <section key={h}><h2 className="font-bold text-brand-700">{h}</h2><p className="mt-1 text-sm leading-8 text-mute">{t}</p></section>)}
    </article>
  );
}
