// End-to-end test of the email flows against a RUNNING API wired to a local capture SMTP server.
//   Terminal 1:  NODE_ENV=test SMTP_HOST=localhost SMTP_PORT=2525 node --env-file=.env dist/main.js
//   Terminal 2:  node --env-file=.env scripts/mail-test.mjs
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const R = Date.now().toString(36);
const inbox = [];
let pass = 0;
const fails = [];
const ok = (n, c, x = '') => { c ? pass++ : fails.push(n + ' ' + x); console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : ' ' + x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, _s, cb) { simpleParser(stream).then((m) => { inbox.push(m); cb(); }, cb); },
});
await new Promise((r) => smtp.listen(2525, '127.0.0.1', r));

async function call(m, p, { b, cookie, token } = {}) {
  const res = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const sc = res.headers.getSetCookie?.() ?? [];
  return { s: res.status, j: await res.json().catch(() => ({})), cookie: sc.find((c) => c.startsWith('hrone_rt='))?.split(';')[0] };
}
async function mailTo(addr, subjectPart, since = 0, wait = 6000) {
  const end = Date.now() + wait;
  while (Date.now() < end) {
    const m = inbox.slice(since).find((x) => x.to?.value?.some((v) => v.address === addr) && x.subject?.includes(subjectPart));
    if (m) return m;
    await sleep(150);
  }
  return null;
}
const tokenOf = (m) => decodeURIComponent((m.text.match(/token=([A-Za-z0-9_%-]+)/) ?? [])[1] ?? '');

const email = `mailtest.${R}@example.com`;
const PW = 'First-Pass-12345';
const NEW = 'Second-Pass-67890';

console.log('— email verification');
const reg = await call('POST', '/auth/register', { b: { username: `mt_${R}`, email, password: PW, displayName: 'مستخدم البريد' } });
ok('register → 201', reg.s === 201);
const vm = await mailTo(email, 'أكّد');
ok('verification email delivered over SMTP', !!vm);
ok('sender is hrone@hrone.online', vm?.from?.value?.[0]?.address === 'hrone@hrone.online', JSON.stringify(vm?.from?.value));
ok('mail has RTL HTML + plain-text alternative', !!vm && vm.html.includes('dir="rtl"') && vm.text.length > 30);
const vtoken = vm ? tokenOf(vm) : '';
ok('link points to the web app /verify-email', !!vm && vm.text.includes('/verify-email?token='));
ok('unverified at first', (await call('GET', '/auth/me', { token: reg.j.accessToken })).j.emailVerifiedAt === null);
ok('garbage token rejected (400)', (await call('POST', '/auth/verify-email', { b: { token: 'x'.repeat(40) } })).s === 400);
ok('verify-email succeeds', (await call('POST', '/auth/verify-email', { b: { token: vtoken } })).s === 200);
ok('now verified', !!(await call('GET', '/auth/me', { token: reg.j.accessToken })).j.emailVerifiedAt);
ok('verification link is single-use', (await call('POST', '/auth/verify-email', { b: { token: vtoken } })).s === 400);
ok('resend when verified is a no-op', (await call('POST', '/auth/resend-verification', { token: reg.j.accessToken })).j.alreadyVerified === true);

console.log('— password reset');
const unknownBefore = inbox.length;
const unk = await call('POST', '/auth/forgot-password', { b: { email: `nobody.${R}@example.com` } });
await sleep(1200);
ok('unknown email → same 200 answer (no enumeration)', unk.s === 200 && unk.j.sent === true);
ok('…and no mail is sent for it', inbox.length === unknownBefore);

const login1 = await call('POST', '/auth/login', { b: { identifier: email, password: PW } });
const oldCookie = login1.cookie;
const mark = inbox.length;
ok('forgot-password for real user → 200', (await call('POST', '/auth/forgot-password', { b: { email: email.toUpperCase() } })).s === 200);
const rm1 = await mailTo(email, 'إعادة تعيين', mark);
ok('reset email delivered', !!rm1);
const t1 = rm1 ? tokenOf(rm1) : '';

const mark2 = inbox.length;
await call('POST', '/auth/forgot-password', { b: { email } });
const rm2 = await mailTo(email, 'إعادة تعيين', mark2);
const t2 = rm2 ? tokenOf(rm2) : '';
ok('a newer reset link invalidates the older one', t1 && t2 && t1 !== t2 && (await call('POST', '/auth/reset-password', { b: { token: t1, password: NEW } })).s === 400);
ok('weak new password rejected (400)', (await call('POST', '/auth/reset-password', { b: { token: t2, password: 'short' } })).s === 400);
ok('(weak attempt did not burn the link)', (await call('POST', '/auth/reset-password', { b: { token: t2, password: NEW } })).s === 200);
ok('reset link is single-use', (await call('POST', '/auth/reset-password', { b: { token: t2, password: NEW + 'x1' } })).s === 400);
ok('old password no longer works (401)', (await call('POST', '/auth/login', { b: { identifier: email, password: PW } })).s === 401);
ok('new password works', (await call('POST', '/auth/login', { b: { identifier: email, password: NEW } })).s === 200);
ok('existing sessions were revoked (old refresh cookie → 401)', (await call('POST', '/auth/refresh', { cookie: oldCookie })).s === 401);

console.log('— expiry');
const prisma = new PrismaClient();
const mark3 = inbox.length;
await call('POST', '/auth/forgot-password', { b: { email } });
const rm3 = await mailTo(email, 'إعادة تعيين', mark3);
await prisma.authToken.updateMany({ where: { usedAt: null, type: 'PASSWORD_RESET', user: { email } }, data: { expiresAt: new Date(Date.now() - 1000) } });
ok('expired reset link rejected (400)', !!rm3 && (await call('POST', '/auth/reset-password', { b: { token: tokenOf(rm3), password: 'Third-Pass-13579' } })).s === 400);
const stored = await prisma.authToken.findFirst({ where: { user: { email } }, select: { tokenHash: true } });
ok('only a SHA-256 hash is stored, never the raw token', !!stored && /^[0-9a-f]{64}$/.test(stored.tokenHash));
await prisma.$disconnect();

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) console.log('FAILED:\n - ' + fails.join('\n - '));
smtp.close();
process.exit(fails.length ? 1 : 0);
