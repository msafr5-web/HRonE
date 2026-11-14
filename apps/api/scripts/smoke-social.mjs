// Notifications, search and blocking against a RUNNING API (NODE_ENV=test):  node --env-file=.env scripts/smoke-social.mjs
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const R = Date.now().toString(36);
const PW = 'Sup3r-Secret-Pass';
let pass = 0;
const fails = [];
const ok = (n, c, x = '') => { c ? pass++ : fails.push(n + ' ' + x); console.log((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : ' ' + x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(m, p, t, b) {
  const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
}
const mk = async (n, d) => { const r = await call('POST', '/auth/register', null, { username: `${n}_${R}`, email: `${n}.${R}@example.com`, password: PW, displayName: d }); return { t: r.j.accessToken, id: r.j.user.id, u: `${n}_${R}` }; };
const notes = async (t) => (await call('GET', '/notifications?limit=50', t)).j;
const unread = async (t) => (await call('GET', '/notifications/unread-count', t)).j.unread;

const alice = await mk('alice', 'أليس الباحثة');
const bob = await mk('bob', 'بوب المجيب');
const admin = (await call('POST', '/auth/login', null, { identifier: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).j.accessToken;

console.log('— notifications');
ok('notifications require auth', (await call('GET', '/notifications')).s === 401);
const post = (await call('POST', '/community/posts', alice.t, { body: `منشور عن مكافأة نهاية الخدمة ${R}`, tags: ['اختبار'] })).j;
await call('POST', `/community/posts/${post.id}/like`, bob.t);
await sleep(300);
ok('like → recipient gets POST_LIKE', (await notes(alice.t)).items.some((n) => n.type === 'POST_LIKE' && n.actor.username === bob.u));
await call('DELETE', `/community/posts/${post.id}/like`, bob.t);
await call('POST', `/community/posts/${post.id}/like`, bob.t);
await sleep(300);
ok('re-liking does not spam (de-duplicated)', (await notes(alice.t)).items.filter((n) => n.type === 'POST_LIKE').length === 1);
await call('POST', `/community/posts/${post.id}/like`, alice.t);
await call('POST', `/community/posts/${post.id}/comments`, alice.t, { body: 'تعليق على منشوري' });
await sleep(300);
ok('acting on your own content never notifies you', (await notes(alice.t)).items.every((n) => n.actor?.username !== alice.u));
await call('POST', `/community/posts/${post.id}/comments`, bob.t, { body: 'تعليق من بوب للاختبار' });
await call('POST', `/users/${alice.u}/follow`, bob.t);
await sleep(400);
const n1 = await notes(alice.t);
ok('comment → POST_COMMENT with preview', n1.items.some((n) => n.type === 'POST_COMMENT' && n.preview?.includes('تعليق من بوب')));
ok('follow → NEW_FOLLOWER', n1.items.some((n) => n.type === 'NEW_FOLLOWER'));
ok('unread counter matches', n1.unread === 3 && (await unread(alice.t)) === 3, String(n1.unread));

const th = (await call('POST', '/consultations', alice.t, { title: `سؤال عن الإجازات ${R}`, body: 'تفاصيل السؤال بما يكفي من الطول للتحقق من القواعد.', tags: ['الإجازات'] })).j;
const rep = (await call('POST', `/consultations/${th.id}/replies`, bob.t, { body: 'هذه إجابتي المفصلة على سؤالك.' })).j;
await call('POST', `/consultations/${th.id}/replies`, alice.t, { body: 'شكراً لك، توضيح إضافي', parentId: rep.id });
await call('POST', `/consultations/${th.id}/accept/${rep.id}`, alice.t);
await sleep(500);
const a2 = await notes(alice.t);
const b2 = await notes(bob.t);
ok('reply → asker gets THREAD_REPLY', a2.items.some((n) => n.type === 'THREAD_REPLY' && n.targetId === th.id));
ok('nested reply → parent author gets REPLY_REPLY', b2.items.some((n) => n.type === 'REPLY_REPLY'));
ok('accepted answer → author gets ANSWER_ACCEPTED', b2.items.some((n) => n.type === 'ANSWER_ACCEPTED'));
const one = a2.items.find((n) => !n.readAt);
const before = await unread(alice.t);
await call('POST', `/notifications/${one.id}/read`, alice.t);
ok('mark one read decrements unread', (await unread(alice.t)) === before - 1);
const before2 = await unread(bob.t);
await call('POST', `/notifications/${one.id}/read`, bob.t);
ok("cannot mark someone else's notification", (await unread(bob.t)) === before2);
ok('read-all → 0', (await call('POST', '/notifications/read-all', alice.t)).j.unread === 0 && (await unread(alice.t)) === 0);
const pg = (await call('GET', '/notifications?limit=2', alice.t)).j;
ok('cursor pagination', pg.items.length === 2 && !!pg.nextCursor);

console.log('— verification notification');
await call('POST', '/users/me/verification', bob.t, { requestedRole: 'HR_SPECIALIST', notes: 'x' });
const pend = (await call('GET', '/admin/verifications', admin)).j.find((v) => v.user.username === bob.u);
await call('POST', `/admin/verifications/${pend.id}/approve`, admin, {});
await sleep(300);
ok('approval → VERIFICATION_APPROVED', (await notes(bob.t)).items.some((n) => n.type === 'VERIFICATION_APPROVED'));

console.log('— search');
const sp = (await call('GET', `/community/posts?q=${encodeURIComponent('مكافأة')}`)).j;
ok('post search finds by body', sp.items.some((p) => p.id === post.id));
ok('diacritics in the query are ignored', (await call('GET', `/community/posts?q=${encodeURIComponent('مُكَافَأَة')}`)).j.items.some((p) => p.id === post.id));
ok('1-char query is ignored (returns normal feed)', (await call('GET', `/community/posts?q=${encodeURIComponent('م')}`)).s === 200);
ok('thread search by title', (await call('GET', `/consultations?q=${encodeURIComponent('الإجازات ' + R)}`)).j.items.some((t) => t.id === th.id));
const prem = (await call('POST', '/consultations', admin, { title: `دليل مميز ${R}`, body: `نص سري داخل المحتوى المميز كلمة_فريدة_${R} للمشتركين.`, isPremium: true })).j;
ok('premium BODY is not searchable (no leak)', !(await call('GET', `/consultations?q=${encodeURIComponent('كلمة_فريدة_' + R)}`)).j.items.some((t) => t.id === prem.id));
ok('premium TITLE is searchable', (await call('GET', `/consultations?q=${encodeURIComponent('دليل مميز ' + R)}`)).j.items.some((t) => t.id === prem.id));
const dir = (await call('GET', `/users/directory?q=${encodeURIComponent('أليس')}`)).j;
ok('people search by display name (public)', dir.some((u) => u.username === alice.u));
ok('people search never exposes email', !JSON.stringify(dir).includes('@'));
ok('people search by username', (await call('GET', `/users/directory?q=${bob.u.slice(0, 8)}`)).j.some((u) => u.username === bob.u));

console.log('— blocking');
const conv = (await call('POST', '/messages/conversations', alice.t, { username: bob.u })).j;
ok('can message before block', (await call('POST', `/messages/conversations/${conv.id}/messages`, alice.t, { body: 'مرحباً', clientMsgId: `blk-${R}-0001` })).s === 201);
ok('cannot block an administrator', (await call('POST', '/users/HRonE_Admin/block', alice.t)).s === 400);
ok('cannot block yourself', (await call('POST', `/users/${alice.u}/block`, alice.t)).s === 400);
ok('block user', (await call('POST', `/users/${bob.u}/block`, alice.t)).j.blocked === true);
ok('block severs follows', (await call('GET', `/users/${alice.u}`, bob.t)).j.viewerFollows === false);
ok('profile reports viewerBlocked', (await call('GET', `/users/${bob.u}`, alice.t)).j.viewerBlocked === true);
ok('blocked user cannot send (403 BLOCKED)', (await call('POST', `/messages/conversations/${conv.id}/messages`, bob.t, { body: 'هل ترد؟', clientMsgId: `blk-${R}-0002` })).j.code === 'BLOCKED');
ok('blocker cannot send either', (await call('POST', `/messages/conversations/${conv.id}/messages`, alice.t, { body: 'x1', clientMsgId: `blk-${R}-0003` })).j.code === 'BLOCKED');
ok('cannot start a new conversation across a block', (await call('POST', '/messages/conversations', bob.t, { username: alice.u })).j.code === 'BLOCKED');
ok('conversation list flags blockedByMe', (await call('GET', '/messages/conversations', alice.t)).j[0]?.blockedByMe === true);
ok('unblock', (await call('DELETE', `/users/${bob.u}/block`, alice.t)).j.blocked === false);
ok('messaging works again after unblock', (await call('POST', `/messages/conversations/${conv.id}/messages`, bob.t, { body: 'عدنا', clientMsgId: `blk-${R}-0004` })).s === 201);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
