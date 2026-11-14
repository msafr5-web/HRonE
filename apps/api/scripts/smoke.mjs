// End-to-end smoke test against a RUNNING API (start it with NODE_ENV=test so rate limits are bypassed).
//   node --env-file=.env scripts/smoke.mjs
import { createHmac, randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api';
const RUN = Date.now().toString(36);
let pass = 0;
const fails = [];

function check(name, cond, extra = '') {
  if (cond) pass++;
  else fails.push(`${name} ${extra}`);
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : ' ' + extra}`);
}

async function call(method, path, { token, cookie, body, rawBody, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined || rawBody ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  const sc = res.headers.getSetCookie?.() ?? [];
  const cookieOut = sc.find((c) => c.startsWith('hrone_rt='))?.split(';')[0];
  return { status: res.status, json, cookie: cookieOut };
}

const PW = 'Sup3r-Secret-Pass';
async function register(name) {
  const r = await call('POST', '/auth/register', { body: { username: `${name}_${RUN}`, email: `${name}.${RUN}@example.com`, password: PW, displayName: `${name} test` } });
  return { ...r, token: r.json?.accessToken, id: r.json?.user?.id, username: `${name}_${RUN}` };
}

console.log('— health & validation');
check('health ok', (await call('GET', '/health')).json?.status === 'ok');
check('weak password rejected (400)', (await call('POST', '/auth/register', { body: { username: 'weak_user', email: 'w@example.com', password: 'short', displayName: 'W' } })).status === 400);
check('unknown field rejected (forbidNonWhitelisted)', (await call('POST', '/auth/register', { body: { username: 'extra_user', email: 'e@example.com', password: PW, displayName: 'E', role: 'ADMIN' } })).status === 400);
check('reserved username blocked', (await call('POST', '/auth/register', { body: { username: 'admin', email: 'r@example.com', password: PW, displayName: 'Rr' } })).status === 409);

console.log('— auth');
const alice = await register('alice');
const bob = await register('bob');
check('register alice → 201 + access token + cookie', alice.status === 201 && !!alice.token && !!alice.cookie);
check('public registration is always EMPLOYEE', alice.json.user.role === 'EMPLOYEE');
check('password hash never returned', !JSON.stringify(alice.json).includes('passwordHash'));
check('duplicate email/username → 409', (await call('POST', '/auth/register', { body: { username: alice.username, email: `x.${RUN}@example.com`, password: PW, displayName: 'dup' } })).status === 409);
check('login wrong password → 401', (await call('POST', '/auth/login', { body: { identifier: alice.username, password: 'wrong-password-1' } })).status === 401);
const loginOk = await call('POST', '/auth/login', { body: { identifier: alice.username.toUpperCase(), password: PW } });
check('login is case-insensitive on username', loginOk.status === 200);
check('/auth/me requires token', (await call('GET', '/auth/me')).status === 401);
check('/auth/me with token', (await call('GET', '/auth/me', { token: alice.token })).json?.username === alice.username);

console.log('— refresh rotation + reuse detection');
const c0 = loginOk.cookie;
const r1 = await call('POST', '/auth/refresh', { cookie: c0 });
check('refresh rotates (new cookie differs)', r1.status === 200 && !!r1.cookie && r1.cookie !== c0);
const reuse = await call('POST', '/auth/refresh', { cookie: c0 });
check('reusing old refresh token → 401', reuse.status === 401);
const r2 = await call('POST', '/auth/refresh', { cookie: r1.cookie });
check('reuse burns the whole family (new token also dead)', r2.status === 401);

console.log('— community');
const post = await call('POST', '/community/posts', { token: alice.token, body: { body: 'سؤال عن احتساب مكافأة نهاية الخدمة؟', tags: ['#نظام_العمل', 'GOSI', '#نظام_العمل'] } });
check('create post (tags deduped)', post.status === 201 && post.json.tags.length === 2, JSON.stringify(post.json));
check('create post requires auth', (await call('POST', '/community/posts', { body: { body: 'x' } })).status === 401);
const feed = await call('GET', '/community/posts');
check('public feed readable without token', feed.status === 200 && feed.json.items.some((p) => p.id === post.json.id));
const byTag = await call('GET', '/community/posts?tag=%23%D9%86%D8%B8%D8%A7%D9%85_%D8%A7%D9%84%D8%B9%D9%85%D9%84');
check('filter by Arabic tag', byTag.json.items.some((p) => p.id === post.json.id));
const like1 = await call('POST', `/community/posts/${post.json.id}/like`, { token: bob.token });
const like2 = await call('POST', `/community/posts/${post.json.id}/like`, { token: bob.token });
check('like is idempotent', like1.json.likeCount === 1 && like2.json.likeCount === 1);
check('viewerLiked reflected for bob', (await call('GET', `/community/posts/${post.json.id}`, { token: bob.token })).json.viewerLiked === true);
check('unlike', (await call('DELETE', `/community/posts/${post.json.id}/like`, { token: bob.token })).json.likeCount === 0);
const cm = await call('POST', `/community/posts/${post.json.id}/comments`, { token: bob.token, body: { body: 'شكراً للمشاركة' } });
check('comment created + counter', cm.status === 201 && (await call('GET', `/community/posts/${post.json.id}`)).json.commentCount === 1);
check("cannot delete someone else's post (403)", (await call('DELETE', `/community/posts/${post.json.id}`, { token: bob.token })).status === 403);
check('trending tags', (await call('GET', '/community/tags/trending')).json.length >= 1);
check('non-UUID id → 400', (await call('GET', '/community/posts/not-a-uuid')).status === 400);

console.log('— consultations (Q&A)');
const th = await call('POST', '/consultations', { token: alice.token, body: { title: 'خلاف حول احتساب الإجازات السنوية', body: 'تم خصم أيام من إجازتي السنوية دون إشعار مسبق، ما الإجراء المناسب؟', tags: ['الإجازات'], isAnonymous: true } });
check('create anonymous thread', th.status === 201 && th.json.mine === true);
check('anonymous author hidden from public', (await call('GET', `/consultations/${th.json.id}`)).json.author === null);
check('author still sees own thread as mine', (await call('GET', `/consultations/${th.json.id}`, { token: alice.token })).json.mine === true);
const rb = await call('POST', `/consultations/${th.json.id}/replies`, { token: bob.token, body: { body: 'راجع الفقرة المتعلقة بالإجازات في نظام العمل وقدّم شكوى عبر القنوات الرسمية.' } });
check('reply created', rb.status === 201);
const nested = await call('POST', `/consultations/${th.json.id}/replies`, { token: alice.token, body: { body: 'شكراً، سأفعل ذلك', parentId: rb.json.id } });
check('nested reply (1 level)', nested.status === 201);
check('2nd nesting level rejected', (await call('POST', `/consultations/${th.json.id}/replies`, { token: bob.token, body: { body: 'مستوى ثالث', parentId: nested.json.id } })).status === 400);
check('cannot vote on own reply', (await call('POST', `/consultations/replies/${rb.json.id}/vote`, { token: bob.token, body: { value: 1 } })).status === 403);
const v1 = await call('POST', `/consultations/replies/${rb.json.id}/vote`, { token: alice.token, body: { value: 1 } });
const v2 = await call('POST', `/consultations/replies/${rb.json.id}/vote`, { token: alice.token, body: { value: 1 } });
check('upvote counted once', v1.json.score === 1 && v2.json.score === 1);
check('flip vote to -1 → score -1', (await call('POST', `/consultations/replies/${rb.json.id}/vote`, { token: alice.token, body: { value: -1 } })).json.score === -1);
check('retract vote → 0', (await call('POST', `/consultations/replies/${rb.json.id}/vote`, { token: alice.token, body: { value: 0 } })).json.score === 0);
check('only asker may accept (403)', (await call('POST', `/consultations/${th.json.id}/accept/${rb.json.id}`, { token: bob.token })).status === 403);
check('asker accepts answer', (await call('POST', `/consultations/${th.json.id}/accept/${rb.json.id}`, { token: alice.token })).status === 200);
const solved = await call('GET', '/consultations?filter=solved');
check('solved filter lists it', solved.json.items.some((t) => t.id === th.json.id && t.solved));
const reps = await call('GET', `/consultations/${th.json.id}/replies`, { token: alice.token });
check('accepted flag on reply + replyCount', reps.json.some((r) => r.id === rb.json.id && r.accepted) && solved.json.items.find((t) => t.id === th.json.id).replyCount === 2);

console.log('— RBAC, verification, moderation');
const admin = await call('POST', '/auth/login', { body: { identifier: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const at = admin.json?.accessToken;
check('admin login (seeded)', admin.status === 200 && admin.json.user.role === 'ADMIN');
check('non-admin blocked from /admin (403)', (await call('GET', '/admin/reports', { token: alice.token })).status === 403);
const vr = await call('POST', '/users/me/verification', { token: bob.token, body: { requestedRole: 'HR_SPECIALIST', notes: 'مدير موارد بشرية', documents: ['https://example.com/proof'] } });
check('bob requests expert verification', vr.status === 201);
check('duplicate pending request → 409', (await call('POST', '/users/me/verification', { token: bob.token, body: { requestedRole: 'HR_SPECIALIST' } })).status === 409);
const pend = await call('GET', '/admin/verifications', { token: at });
const mine = pend.json.find((v) => v.user.username === bob.username);
check('admin sees pending request', !!mine);
check('admin approves', (await call('POST', `/admin/verifications/${mine.id}/approve`, { token: at, body: { note: 'ok' } })).status === 200);
const bobMe = await call('GET', '/auth/me', { token: bob.token });
check('bob is now verified HR_SPECIALIST (immediately, no re-login)', bobMe.json.role === 'HR_SPECIALIST' && bobMe.json.verification === 'VERIFIED');
const rb2 = await call('POST', `/consultations/${th.json.id}/replies`, { token: bob.token, body: { body: 'إضافة من خبير موثّق.' } });
check('expert reply flagged asExpert', rb2.json.asExpert === true);
check('report a post', (await call('POST', '/reports', { token: bob.token, body: { targetType: 'POST', targetId: post.json.id, reason: 'محتوى غير لائق (اختبار)' } })).status === 200);
const rep = (await call('GET', '/admin/reports', { token: at })).json.find((r) => r.targetId === post.json.id);
check('admin sees report', !!rep);
await call('POST', `/admin/reports/${rep.id}/hide`, { token: at });
check('hidden post is gone from public API (404)', (await call('GET', `/community/posts/${post.json.id}`)).status === 404);

console.log('— premium & subscriptions');
const pt = await call('POST', '/consultations', { token: at, body: { title: 'دليل تفصيلي للتعامل مع نزاعات الأجور', body: 'محتوى مميز للمشتركين فقط يشرح خطوات توثيق المطالبة والإجراءات.', isPremium: true } });
check('admin can publish premium thread', pt.status === 201);
check('non-expert cannot publish premium (403)', (await call('POST', '/consultations', { token: alice.token, body: { title: 'محاولة مميز', body: 'نص طويل كفاية لاجتياز التحقق من الطول.', isPremium: true } })).status === 403);
const locked = await call('GET', `/consultations/${pt.json.id}`, { token: alice.token });
check('premium body locked for non-subscriber', locked.json.locked === true && locked.json.body.length < 160);
check('premium replies blocked (403 PREMIUM_REQUIRED)', (await call('GET', `/consultations/${pt.json.id}/replies`, { token: alice.token })).json?.code === 'PREMIUM_REQUIRED');
check('@Premium() route → 402 for non-subscriber', (await call('GET', '/subscriptions/premium-check', { token: alice.token })).status === 402);
const evt = { id: randomUUID(), type: 'subscription.activated', userId: alice.id, providerRef: `ref_${RUN}`, interval: 'MONTH', currentPeriodEnd: new Date(Date.now() + 30 * 864e5).toISOString() };
const raw = JSON.stringify(evt);
const sig = createHmac('sha256', process.env.WEBHOOK_SECRET).update(raw).digest('hex');
check('webhook with bad signature → 401', (await call('POST', '/subscriptions/webhooks/test', { rawBody: raw, headers: { 'x-signature': 'deadbeef' } })).status === 401);
const w1 = await call('POST', '/subscriptions/webhooks/test', { rawBody: raw, headers: { 'x-signature': sig } });
const w2 = await call('POST', '/subscriptions/webhooks/test', { rawBody: raw, headers: { 'x-signature': sig } });
check('webhook applied once, replay is idempotent', w1.json?.duplicate === false && w2.json?.duplicate === true, JSON.stringify([w1.json, w2.json]));
check('subscriber can read premium replies', (await call('GET', `/consultations/${pt.json.id}/replies`, { token: alice.token })).status === 200);
check('@Premium() route → 200 for subscriber', (await call('GET', '/subscriptions/premium-check', { token: alice.token })).status === 200);

console.log('— messaging (REST + Socket.io)');
const conv = await call('POST', '/messages/conversations', { token: alice.token, body: { username: bob.username } });
const conv2 = await call('POST', '/messages/conversations', { token: bob.token, body: { username: alice.username } });
check('one conversation per pair (A,B == B,A)', conv.json.id === conv2.json.id);
check('cannot message yourself', (await call('POST', '/messages/conversations', { token: alice.token, body: { username: alice.username } })).status === 400);
const got = new Promise((resolve) => {
  const s = io(BASE.replace('/api', ''), { auth: { token: bob.token }, transports: ['websocket'] });
  s.on('message:new', (m) => { s.close(); resolve(m); });
  s.on('connect', async () => { await new Promise((r) => setTimeout(r, 200)); resolve.ready?.(); });
  setTimeout(() => { s.close(); resolve(null); }, 6000);
  globalThis.__sock = s;
});
await new Promise((r) => setTimeout(r, 800));
const cid = `c${RUN}abcdef01`;
const m1 = await call('POST', `/messages/conversations/${conv.json.id}/messages`, { token: alice.token, body: { body: 'مرحباً، هل لديك وقت للاستشارة؟', clientMsgId: cid } });
const m2 = await call('POST', `/messages/conversations/${conv.json.id}/messages`, { token: alice.token, body: { body: 'مرحباً، هل لديك وقت للاستشارة؟', clientMsgId: cid } });
check('send message + idempotent resend (same id)', m1.status === 201 && m1.json.id === m2.json.id);
const pushed = await got;
check('recipient receives message:new over WebSocket', pushed?.id === m1.json.id);
const list = await call('GET', '/messages/conversations', { token: bob.token });
check('unread count = 1 for recipient', list.json[0]?.unread === 1);
await call('POST', `/messages/conversations/${conv.json.id}/read`, { token: bob.token });
check('unread cleared after read', (await call('GET', '/messages/conversations', { token: bob.token })).json[0].unread === 0);
const carol = await register('carol');
check('outsider cannot read conversation (403)', (await call('GET', `/messages/conversations/${conv.json.id}/messages`, { token: carol.token })).status === 403);
const badSock = await new Promise((resolve) => {
  const s = io(BASE.replace('/api', ''), { auth: { token: 'garbage' }, transports: ['websocket'], reconnection: false });
  s.on('disconnect', () => resolve(true));
  setTimeout(() => resolve(false), 4000);
});
check('socket with invalid token is disconnected', badSock);

console.log('— profile & follow');
check('follow user', (await call('POST', `/users/${bob.username}/follow`, { token: alice.token })).json?.following === true);
const prof = await call('GET', `/users/${bob.username}`, { token: alice.token });
check('profile shows followerCount + viewerFollows', prof.json.followerCount === 1 && prof.json.viewerFollows === true);
check('profile never leaks email', !JSON.stringify(prof.json).includes('@'));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
