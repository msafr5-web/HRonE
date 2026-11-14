'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, onSession, refreshSession, setSession } from './api';
import type { Me } from './types';

interface AuthCtx {
  user: Me | null;
  /** false until the first silent-refresh attempt finishes (prevents login-flash). */
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (v: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: Me) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    onSession((me, expiresIn) => {
      setUser(me);
      clearTimeout(timer.current);
      // Renew a minute before the access token expires.
      if (me && expiresIn) timer.current = setTimeout(() => void refreshSession(), Math.max(expiresIn - 60, 30) * 1000);
    });
    void refreshSession().finally(() => setReady(true));
    return () => clearTimeout(timer.current);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const d = await api<{ accessToken: string; expiresIn: number; user: Me }>('/auth/login', { method: 'POST', body: { identifier, password }, auth: false });
    setSession(d.accessToken, d.user, d.expiresIn);
  }, []);

  const register = useCallback(async (v: { username: string; email: string; password: string; displayName: string }) => {
    const d = await api<{ accessToken: string; expiresIn: number; user: Me }>('/auth/register', { method: 'POST', body: v, auth: false });
    setSession(d.accessToken, d.user, d.expiresIn);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', auth: false }).catch(() => {});
    setSession(null, null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout, setUser }), [user, ready, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
