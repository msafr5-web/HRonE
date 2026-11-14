const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Mail { subject: string; text: string; html: string }

/** Minimal, client-safe RTL layout (inline styles only – mail clients strip <style>). */
function layout(title: string, intro: string, cta: { url: string; label: string }, footnote: string): Mail['html'] {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f7f5ef;font-family:Tahoma,Arial,sans-serif;color:#14201b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e4e0d4;border-radius:16px">
<tr><td style="padding:28px 28px 8px"><span style="display:inline-block;background:#0e583f;color:#fff;font-weight:900;border-radius:10px;padding:8px 12px">HR</span>
<span style="font-size:20px;font-weight:800;color:#0b3d2e;margin-right:8px">HRon<span style="color:#c8a24a">E</span></span></td></tr>
<tr><td style="padding:8px 28px"><h1 style="font-size:20px;margin:12px 0">${esc(title)}</h1><p style="font-size:15px;line-height:1.9;margin:0 0 20px">${esc(intro)}</p>
<a href="${esc(cta.url)}" style="display:inline-block;background:#167050;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px">${esc(cta.label)}</a>
<p style="font-size:12px;color:#62706a;line-height:1.8;margin:20px 0 0">إن لم يعمل الزر، انسخ الرابط التالي في المتصفح:<br><span dir="ltr" style="word-break:break-all">${esc(cta.url)}</span></p></td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e4e0d4;font-size:12px;color:#62706a;line-height:1.8">${esc(footnote)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function verifyEmailMail(name: string, url: string): Mail {
  const intro = `مرحباً ${name}، شكراً لانضمامك إلى HRonE. أكّد بريدك الإلكتروني لتفعيل حسابك واستعادته عند الحاجة.`;
  return {
    subject: 'أكّد بريدك الإلكتروني – HRonE',
    text: `${intro}\n\nرابط التأكيد (صالح 24 ساعة):\n${url}\n\nإن لم تنشئ هذا الحساب فتجاهل الرسالة.`,
    html: layout('أكّد بريدك الإلكتروني', intro, { url, label: 'تأكيد البريد' }, 'الرابط صالح لمدة 24 ساعة. إن لم تنشئ هذا الحساب فتجاهل الرسالة.'),
  };
}

export function resetPasswordMail(name: string, url: string): Mail {
  const intro = `مرحباً ${name}، وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في HRonE.`;
  return {
    subject: 'إعادة تعيين كلمة المرور – HRonE',
    text: `${intro}\n\nلإعادة التعيين افتح الرابط (صالح ساعة واحدة ويُستخدم مرة واحدة):\n${url}\n\nإن لم تطلب ذلك فتجاهل الرسالة؛ كلمة مرورك لم تتغيّر.`,
    html: layout('إعادة تعيين كلمة المرور', intro, { url, label: 'تعيين كلمة مرور جديدة' }, 'الرابط صالح لمدة ساعة ويُستخدم مرة واحدة. إن لم تطلب ذلك فتجاهل الرسالة؛ كلمة مرورك لم تتغيّر.'),
  };
}
