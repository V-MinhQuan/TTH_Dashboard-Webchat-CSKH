import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type Role = 'manager' | 'staff' | null;

export interface UserInfo {
  username: string;
  name: string;
  email: string;
  phone?: string;
  role: 'manager' | 'staff';
  accessToken?: string;
  tokenExpiresAt?: string;
  lastLogin?: string;
}

interface AuthContextType {
  role: Role;
  user: UserInfo | null;
  login: (user: UserInfo, remember: boolean) => void;
  setRole: (role: Role) => void;
  setUser: (user: UserInfo | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'flic_dashboard_auth';

interface StoredAuth {
  role: Exclude<Role, null>;
  user: UserInfo;
}

function isStoredAuth(value: any): value is StoredAuth {
  return (
    value &&
    value.user &&
    (value.role === 'manager' || value.role === 'staff') &&
    (value.user.role === 'manager' || value.user.role === 'staff') &&
    typeof value.user.username === 'string' &&
    typeof value.user.name === 'string' &&
    typeof value.user.email === 'string' &&
    (value.user.accessToken === undefined || typeof value.user.accessToken === 'string')
  );
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (isStoredAuth(parsed)) {
        return parsed;
      }

      safeRemoveStoredAuth(storage);
    } catch {
      safeRemoveStoredAuth(storage);
    }
  }

  return null;
}

function saveStoredAuth(auth: StoredAuth, remember: boolean) {
  if (typeof window === 'undefined') return;

  const targetStorage = remember ? window.localStorage : window.sessionStorage;
  const otherStorage = remember ? window.sessionStorage : window.localStorage;
  try {
    targetStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    safeRemoveStoredAuth(otherStorage);
  } catch {
    // Storage can be unavailable in restricted browser modes; keep in-memory auth.
  }
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;

  safeRemoveStoredAuth(window.localStorage);
  safeRemoveStoredAuth(window.sessionStorage);
}

function updateStoredAuthUser(user: UserInfo | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    clearStoredAuth();
    return;
  }

  const remember = Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY));
  saveStoredAuth({ user, role: user.role }, remember);
}

function safeRemoveStoredAuth(storage: Storage) {
  try {
    storage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedAuth] = useState<StoredAuth | null>(() => readStoredAuth());
  const [role, setRole] = useState<Role>(storedAuth?.role ?? null);
  const [user, setUserState] = useState<UserInfo | null>(storedAuth?.user ?? null);

  const login = (userData: UserInfo, remember: boolean) => {
    const userWithTimestamp = {
      ...userData,
      lastLogin: new Date().toISOString()
    };
    setUserState(userWithTimestamp);
    setRole(userData.role);
    saveStoredAuth({ user: userWithTimestamp, role: userData.role }, remember);
  };

  const setUser = (userData: UserInfo | null) => {
    setUserState(userData);
    if (userData) {
      setRole(userData.role);
    }
    updateStoredAuthUser(userData);
  };

  const logout = useCallback(() => {
    setRole(null);
    setUserState(null);
    clearStoredAuth();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => logout();
    window.addEventListener('flic:auth-expired', handleExpiredSession);
    return () => window.removeEventListener('flic:auth-expired', handleExpiredSession);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ role, user, login, setRole, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
