# HRonE — مجتمع الموارد البشرية في السعودية

مجتمع مهني (ساحة عامة + أسئلة وأجوبة + خبراء موثّقون + رسائل لحظية) مبني كتطبيق متجانس مقسّم إلى وحدات.

```
apps/api   NestJS 11 · Prisma 6 · PostgreSQL · Socket.io · argon2 · JWT (rotation)
apps/web   Next.js 15 (App Router) · React 19 · Tailwind · RTL عربي · وضع داكن
docs/      تقريرا المراجعة التقنية (PDF)
```

## التشغيل المحلي (بدون Docker)

```bash
npm install
cp apps/api/.env.example apps/api/.env          # غيّر الأسرار قبل أي استضافة
cp apps/web/.env.example apps/web/.env.local

npm run dev:db                                   # PostgreSQL مدمج على المنفذ 54329 (نافذة منفصلة)
cd apps/api && npx prisma db push && npm run db:seed   # الجداول + الوسوم + حساب المدير
npm run dev:api                                  # http://localhost:4000/api
npm run dev:web                                  # http://localhost:3000
```

مع Docker: `docker compose up -d` ثم اجعل `DATABASE_URL=postgresql://hrone:hrone@localhost:5432/HRoeN`.

## الاختبار

```bash
# شغّل الـ API بوضع الاختبار (يعطّل تحديد المعدل فقط) ثم:
cd apps/api && NODE_ENV=test node dist/main.js &
npm run smoke -w apps/api      # 71 فحصاً: مصادقة، تدوير الرموز، RBAC، الاستشارات، التصويت، Premium، Webhooks، الرسائل، WebSocket
```

## ما هو مبني

| الوحدة | المحتوى |
|---|---|
| auth | تسجيل/دخول (argon2id)، Access قصير + Refresh في httpOnly cookie مع **تدوير وكشف إعادة الاستخدام**، توقيت دخول متساوٍ |
| users | ملفات، متابعة، بحث، طلب توثيق خبير (يُراجع يدوياً) |
| community | منشورات، وسوم عربية مطبّعة، إعجاب، تعليقات، ترقيم بمؤشر، **بحث** (المحتوى المميّز لا يُبحث في نصه) |
| consultations | أسئلة، ردود (مستوى تداخل واحد)، تصويت، إجابة معتمدة، نشر مجهول، محتوى Premium |
| messaging | محادثة 1-إلى-1 (زوج فريد)، `clientMsgId` ضد التكرار، حالة قراءة، دفع عبر Socket.io، **حظر المستخدمين** |
| subscriptions | سجل اشتراكات **مستقل عن المزوّد**، Webhook موقّع (HMAC) مع idempotency، `@Premium()` |
| moderation | بلاغات، إخفاء، مراجعة التوثيق، تعطيل حسابات، منح اشتراك يدوي |
| mail | إرسال SMTP: تأكيد البريد (24 ساعة) واستعادة كلمة المرور (ساعة، مرة واحدة). تُخزَّن بصمة الرمز فقط، وإعادة التعيين تُنهي كل الجلسات |
| notifications | إعجاب، تعليق، رد، إجابة معتمدة، متابع جديد، نتيجة التوثيق (دون تكرار ودون إشعار الذات) |
| ai-engine | **معطّل عمداً** (انظر أدناه) |

الحراس العامة بالترتيب: Throttler ← JWT ← Roles ← VerifiedExpert ← Premium. الأخطاء بصيغة موحّدة، والتحقق `whitelist + forbidNonWhitelisted`.

## قبل الإطلاق العام (لم يُنفَّذ / يحتاج قراراً)

1. **مزوّد الدفع:** Stripe غير مدرج للسعودية وقت الفحص. اختر مزوّداً محلياً (Moyasar/Tap/HyperPay) **وأكّد كتابياً دعم مدى للدفع المتكرر**، ثم اكتب محوّلاً يرسل الحدث الموحّد إلى `/api/subscriptions/webhooks/:provider`. حالياً الاشتراك يُمنح يدوياً من الإدارة.
2. **قانوني:** صفحات الشروط والخصوصية والقواعد **مسودات** وتحتاج مراجعة محامٍ سعودي (PDPL، وهل تحتاج «الاستشارات» ترخيصاً). الواجهة تعرض إخلاء مسؤولية.
3. **PDPL والاستضافة:** حدّد موقع الاستضافة وتقييم نقل البيانات قبل رفع بيانات حقيقية.
4. **المرفقات (S3/R2):** حقل `attachments` جاهز في المخطط، لكن رفع الملفات بروابط موقّعة غير مبني.
5. **Redis:** غير مستخدم بعد. عند تشغيل أكثر من نسخة من الـ API أضف `@socket.io/redis-adapter` ومخبأ الاشتراكات.
6. **الذكاء الاصطناعي:** لا يُفعَّل قبل قاعدة معرفة تنظيمية موثّقة ومراجَعة قانونياً (انظر التعليق في `ai-engine.module.ts`).
7. **أمان الإنتاج:** أسرار قوية، HTTPS، `NODE_ENV=production` (cookie آمن)، نسخ احتياطي مجرَّب، مراقبة، فحص ملفات.
8. **غير مبني:** بحث نصي عربي متقدم، حظر مستخدمين في الرسائل.

## الإدارة

لوحة الإدارة على `/admin` (تظهر في قائمة الحساب للمدير فقط): بلاغات مع معاينة المحتوى، مراجعة طلبات التوثيق، ومنح اشتراك يدوي. حساب المدير من `ADMIN_EMAIL/ADMIN_PASSWORD` عبر `npm run db:seed -w apps/api`. نقاط النهاية تحت `/api/admin/*` (بلاغات، توثيق، تعطيل، منح اشتراك).

## البريد الإلكتروني (hrone@hrone.online)

الميزات جاهزة وتعمل بمجرد تعبئة إعدادات SMTP في `apps/api/.env` (تأخذها من مستضيف بريد النطاق):

```
SMTP_HOST=mail.hrone.online      # عادةً؛ تأكد من مستضيفك
SMTP_PORT=465                    # 465 مع SMTP_SECURE=true  ·  أو 587 مع SMTP_SECURE=false
SMTP_SECURE=true
SMTP_USER=hrone@hrone.online
SMTP_PASS=كلمة_سر_صندوق_البريد
MAIL_FROM="HRonE <hrone@hrone.online>"
WEB_ORIGIN=https://hrone.online  # يُبنى منه رابط الرسائل؛ في التطوير http://localhost:3000
```

بدون `SMTP_HOST` يُعطَّل الإرسال، وتُسجَّل الرسائل (مع الرابط) في سجل الخادم أثناء التطوير فقط.

**قبل الإطلاق** أضف سجلات DNS للنطاق وإلا ستذهب الرسائل إلى «غير المرغوب»: **SPF** و**DKIM** (يوفرها مستضيف البريد) و**DMARC**.

اختبار الإرسال الفعلي محلياً (خادم SMTP التقاطي، لا يرسل لأحد):

```bash
NODE_ENV=test SMTP_HOST=localhost SMTP_PORT=2525 node --env-file=.env dist/main.js
node --env-file=.env scripts/mail-test.mjs      # 24 فحصاً
```

## النشر للإنتاج (Docker + HTTPS تلقائي)

الموقع كله على **أصل واحد** (نطاق واحد): Caddy يوجّه `/api` و`/socket.io` إلى الـ API وما سواهما إلى الويب، فتبقى ملفات الارتباط (cookies) من الطرف الأول.

```bash
cp .env.production.example .env.production      # املأ كل القيم (أسرار قوية)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api npx tsx prisma/seed.ts   # مرة واحدة: الوسوم + المدير
```

- الـ API ينفّذ `prisma migrate deploy` عند كل إقلاع (الهجرة الأولى `0001_init`، وتحقّقتُ منها على قاعدة فارغة: 21 جدولاً وبلا فروق عن المخطط).
- وجّه سجل DNS للنطاق (A) إلى خادمك، وافتح المنفذين 80 و443.
- **غير مُجرَّب:** ملفات Docker وCaddy لم أستطع بناءها هنا لأن Docker غير مثبّت على هذا الجهاز؛ جرّبتُ فقط بناء الويب بوضع `standalone` وتشغيله، وبناء الـ API وهجرته.

**قاعدة التطوير الحالية** أُنشئت بـ `db push` لا بالهجرات. لتحويلها إلى مسار الهجرات مرة واحدة:

```bash
cd apps/api && npx prisma migrate resolve --applied 0001_init
```

بعدها أي تعديل على المخطط: `npx prisma migrate dev --name وصف_التعديل`.

## كل الاختبارات

```bash
npm run smoke -w apps/api          # 71 فحصاً: أساسيات النظام
npm run smoke:social -w apps/api   # 36 فحصاً: إشعارات، بحث، حظر
npm run smoke:mail -w apps/api     # 24 فحصاً: بريد (يحتاج الـ API بـ SMTP_HOST=localhost SMTP_PORT=2525)
```
