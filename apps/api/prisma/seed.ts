import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { normalizeTag } from '../src/common/utils/tags';

const prisma = new PrismaClient();

// Starter topics so the tag picker is useful on day one (labels are editable content, not legal claims).
const TAGS = ['نظام_العمل', 'التأمينات_الاجتماعية', 'نطاقات', 'عقود_العمل', 'نهاية_الخدمة', 'الأجور', 'الإجازات', 'التوظيف', 'السعودة', 'تسوية_النزاعات'];

async function main() {
  for (const raw of TAGS) {
    const t = normalizeTag(raw);
    if (t) await prisma.tag.upsert({ where: { slug: t.slug }, create: t, update: {} });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: { username: 'HRonE_Admin', usernameLower: 'hrone_admin', email: email.toLowerCase(), passwordHash, displayName: 'إدارة HRonE', role: 'ADMIN', verification: 'VERIFIED' },
      update: {},
    });
    console.log(`Admin ready: ${email}`);
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set – skipped admin creation');
  }
}

main().finally(() => prisma.$disconnect());
