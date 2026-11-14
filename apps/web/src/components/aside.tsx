import { Flame, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { Tag } from '@/lib/types';

export function Aside({ trending }: { trending: (Tag & { count: number })[] }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Flame size={16} className="text-gold-500" /> المواضيع الرائجة</h2>
        {trending.length === 0 ? (
          <p className="text-sm text-mute">ستظهر هنا المواضيع الأكثر نقاشاً.</p>
        ) : (
          <ul className="space-y-1">
            {trending.map((t, i) => (
              <li key={t.slug}>
                <Link href={`/community?tag=${encodeURIComponent(t.slug)}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50">
                  <span><span className="me-2 text-xs text-mute">{i + 1}</span>#{t.label}</span>
                  <span className="text-xs text-mute">{t.count} منشور</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="brand-panel rounded-2xl p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} /> هل أنت خبير موارد بشرية؟</h2>
        <p className="mt-2 text-xs leading-6 opacity-90">وثّق حسابك لتظهر إجاباتك بشارة «خبير موثّق» وتصل لمن يحتاج مساعدتك.</p>
        <Link href="/settings" className="mt-3 inline-block rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25">طلب التوثيق</Link>
      </section>
      <p className="px-1 text-xs leading-6 text-mute">باستخدامك المجتمع فأنت توافق على <Link className="underline" href="/legal/rules">قواعد المجتمع</Link>. لا تنشر بيانات شخصية أو وثائق تعريفية.</p>
    </aside>
  );
}
