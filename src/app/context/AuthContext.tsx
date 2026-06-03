import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'manager' | 'staff' | null;

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);

  const logout = () => setRole(null);

  return (
    <AuthContext.Provider value={{ role, setRole, logout }}>
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
