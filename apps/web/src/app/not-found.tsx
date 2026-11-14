import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-mute">ربما حُذف المحتوى أو تغيّر الرابط.</p>
      <Link href="/community" className="btn-primary mt-6">العودة إلى الساحة</Link>
    </div>
  );
}
