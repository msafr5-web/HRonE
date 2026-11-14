'use client';

import { Mail, ShieldBan, UserCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { Spinner, useToast } from './ui';

export function ProfileActions({ profile }: { profile: Profile }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [following, setFollowing] = useState(profile.viewerFollows);
  const [followers, setFollowers] = useState(profile.followerCount);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(profile.viewerBlocked);

  // viewerFollows is unknown during SSR – fetch once the session exists.
  useEffect(() => {
    if (ready && user) api<Profile>(`/users/${profile.username}`).then((p) => { setFollowing(p.viewerFollows); setFollowers(p.followerCount); setBlocked(p.viewerBlocked); }).catch(() => {});
  }, [ready, user?.id, profile.username]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user?.id === profile.id) return <Link href="/settings" className="btn-outline">تعديل الملف</Link>;

  async function toggle() {
    if (!user) return router.push('/login');
    setBusy(true);
    try {
      await api(`/users/${profile.username}/follow`, { method: following ? 'DELETE' : 'POST' });
      setFollowers((n) => n + (following ? -1 : 1)); setFollowing(!following);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function toggleBlock() {
    if (!user) return router.push('/login');
    if (!blocked && !confirm(`حظر ${profile.displayName}؟ لن تتمكنا من المراسلة، وستُلغى المتابعة بينكما.`)) return;
    setBusy(true);
    try {
      await api(`/users/${profile.username}/block`, { method: blocked ? 'DELETE' : 'POST' });
      setBlocked(!blocked);
      if (!blocked) setFollowing(false);
      toast(blocked ? 'أُلغي الحظر' : 'تم الحظر');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <button className={following ? 'btn-outline' : 'btn-primary'} onClick={toggle} disabled={busy} aria-pressed={following}>
        {busy ? <Spinner /> : following ? <><UserCheck size={16} /> تتابعه</> : <><UserPlus size={16} /> متابعة</>}
      </button>
      <Link href={user ? `/messages?to=${profile.username}` : '/login'} className="btn-outline"><Mail size={16} /> مراسلة</Link>
      <button className="btn-ghost !px-2.5" onClick={toggleBlock} disabled={busy} aria-pressed={blocked} title={blocked ? 'إلغاء الحظر' : 'حظر'} aria-label={blocked ? 'إلغاء الحظر' : 'حظر المستخدم'}>
        <ShieldBan size={17} className={blocked ? 'text-red-500' : ''} />
      </button>
      <span className="sr-only">{followers} متابع</span>
    </div>
  );
}
