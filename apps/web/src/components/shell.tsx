'use client';

import clsx from 'clsx';
import { Home, LogOut, Mail, MessagesSquare, Moon, PenSquare, Search, Settings, ShieldAlert, Sun, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAutoHideHeader } from '@/lib/use-auto-hide-header';
import type { Conversation } from '@/lib/types';
import { NotificationBell } from './notification-bell';
import { Avatar } from './ui';

const NAV = [
  { href: '/community', label: 'الساحة', icon: Home },
  { href: '/consultations', label: 'الاستشارات', icon: MessagesSquare },
  { href: '/messages', label: 'الرسائل', icon: Mail },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="HR1 – الصفحة الرئيسية">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/hr1-mark.svg" alt="" width={38} height={38} className="h-[38px] w-[38px] shrink-0 rounded-[11px] shadow-card" />
      <span className="flex flex-col" aria-hidden>
        <span className="hr1-text" dir="ltr">HR<span>1</span></span>
        <span className="hr1-tag hidden sm:block">مجتمع الموارد البشرية</span>
      </span>
    </Link>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <>
      <form role="search" className="relative hidden lg:block" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
        <Search size={15} className="pointer-events-none absolute right-3 top-2.5 text-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" placeholder="بحث…" className="input !w-48 !rounded-full !py-2 !pr-9 text-sm transition-all focus:!w-64" />
      </form>
      <Link href="/search" className="btn-ghost !p-2 lg:hidden" aria-label="بحث"><Search size={18} /></Link>
    </>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  return (
    <button
      className="btn-ghost !p-2"
      aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        if (next) document.documentElement.setAttribute('data-bs-theme', 'dark'); else document.documentElement.removeAttribute('data-bs-theme');
        try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!user) return null;
  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-50';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="قائمة الحساب" className="rounded-full ring-2 ring-transparent transition hover:ring-brand-100">
        <Avatar name={user.displayName} seed={user.username} size={36} />
      </button>
      {open && (
        <div role="menu" className="card absolute left-0 z-40 mt-2 w-56 animate-rise p-1.5">
          <div className="px-3 py-2"><p className="truncate text-sm font-bold">{user.displayName}</p><p className="truncate text-xs text-mute" dir="ltr">@{user.username}</p></div>
          <hr className="my-1 border-line" />
          <Link role="menuitem" className={item} href={`/u/${user.username}`} onClick={() => setOpen(false)}><UserRound size={16} /> ملفي الشخصي</Link>
          <Link role="menuitem" className={item} href="/settings" onClick={() => setOpen(false)}><Settings size={16} /> الإعدادات والتوثيق</Link>
          {user.role === 'ADMIN' && <Link role="menuitem" className={item} href="/admin" onClick={() => setOpen(false)}><ShieldAlert size={16} /> لوحة الإدارة</Link>}
          <button role="menuitem" className={clsx(item, 'text-red-600')} onClick={async () => { setOpen(false); await logout(); router.push('/'); }}><LogOut size={16} /> تسجيل الخروج</button>
        </div>
      )}
    </div>
  );
}

/** Polls unread count (cheap) so the Messages tab can show a badge. */
function useUnread() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user) return setN(0);
    let stop = false;
    const tick = () => api<Conversation[]>('/messages/conversations').then((c) => !stop && setN(c.reduce((a, x) => a + x.unread, 0))).catch(() => {});
    tick();
    const t = setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener('hrone:unread', onFocus);
    return () => { stop = true; clearInterval(t); window.removeEventListener('hrone:unread', onFocus); };
  }, [user]);
  return n;
}

export function Header() {
  const { user, ready } = useAuth();
  const path = usePathname();
  const unread = useUnread();
  const headerRef = useRef<HTMLElement>(null);
  useAutoHideHeader(headerRef);
  return (
    <header ref={headerRef} className="site-header glass-nav sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {NAV.map(({ href, label, icon: I }) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={clsx('relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition', active ? 'bg-brand-50 text-brand-700' : 'text-mute hover:bg-brand-50 hover:text-ink')}>
                <I size={17} /> {label}
                {href === '/messages' && unread > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <HeaderSearch />
          <NotificationBell />
          <ThemeToggle />
          {!ready ? <span className="h-9 w-24" /> : user ? (
            <>
              <Link href="/consultations/new" className="btn-primary hidden sm:inline-flex"><PenSquare size={16} /> اسأل المجتمع</Link>
              <UserMenu />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">دخول</Link>
              <Link href="/register" className="btn-primary">انضم مجاناً</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  const { user } = useAuth();
  const unread = useUnread();
  const items = [...NAV, { href: user ? `/u/${user.username}` : '/login', label: user ? 'حسابي' : 'دخول', icon: UserRound }];
  return (
    <nav aria-label="التنقل السفلي" className="glass-nav fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ href, label, icon: I }) => {
          const active = path.startsWith(href) && href !== '/login';
          return (
            <li key={label}>
              <Link href={href} aria-current={active ? 'page' : undefined} className={clsx('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', active ? 'text-brand-600' : 'text-mute')}>
                <I size={21} strokeWidth={active ? 2.5 : 2} />
                {label}
                {label === 'الرسائل' && unread > 0 && <span className="absolute right-[32%] top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line pb-24 pt-8 text-sm text-mute md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} HR1 — مجتمع مهني للموارد البشرية في المملكة.</p>
        <nav className="flex flex-wrap gap-4" aria-label="روابط قانونية">
          <Link href="/legal/rules" className="hover:text-ink">قواعد المجتمع</Link>
          <Link href="/legal/terms" className="hover:text-ink">الشروط</Link>
          <Link href="/legal/privacy" className="hover:text-ink">الخصوصية</Link>
        </nav>
      </div>
    </footer>
  );
}
