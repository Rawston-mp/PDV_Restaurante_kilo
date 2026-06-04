import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { User } from '@/modules/auth/domain/entities/User';
import { hasPermission } from '@/modules/auth/domain/services/permissionPolicy';
import type { Permission } from '@/modules/auth/domain/types/Permission';
import type { Role } from '@/modules/auth/domain/types/Role';

export type SensitiveAction = 'CLOSE_COMANDA' | 'CANCEL_ORDER';

type AuthContextValue = {
  user: User | null;
  signInAs: (user: User) => void;
  signInWithPassword: (role: Role, password: string) => { success: boolean; message: string };
  confirmSensitiveAction: (
    action: SensitiveAction,
    password: string
  ) => { success: boolean; message: string };
  signOut: () => void;
  can: (permission: Permission) => boolean;
  availableRoles: Role[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

const storageKey = 'pdv.auth.user';

const rolePasswordMap: Record<Role, string> = {
  ADMIN: '9000',
  GERENTE: '7070',
  CAIXA: '2025',
  ATENDENTE: '3030',
  BALANCA_A: '1111',
  BALANCA_B: '2222'
};

const sensitivePasswordMap: Record<Role, string> = {
  ADMIN: '9900',
  GERENTE: '7700',
  CAIXA: '2200',
  ATENDENTE: '3300',
  BALANCA_A: '1100',
  BALANCA_B: '2201'
};

const actionNameMap: Record<SensitiveAction, string> = {
  CLOSE_COMANDA: 'fechamento de comanda',
  CANCEL_ORDER: 'cancelamento de pedido'
};

const roleNames: Record<Role, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  BALANCA_A: 'Balanca A',
  BALANCA_B: 'Balanca B'
};

const availableRoles: Role[] = ['ADMIN', 'CAIXA', 'BALANCA_A', 'BALANCA_B', 'GERENTE', 'ATENDENTE'];

const defaultUser: User = {
  id: 'u-admin-default',
  name: 'Administrador',
  role: 'ADMIN'
};

const loadStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return defaultUser;
  }

  if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
    return defaultUser;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultUser;
  }

  try {
    const parsed = JSON.parse(raw) as User;
    if (!parsed.id || !parsed.name || !parsed.role) {
      return defaultUser;
    }

    return parsed;
  } catch {
    return defaultUser;
  }
};

const persistUser = (user: User | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.localStorage || typeof window.localStorage.setItem !== 'function') {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(user));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);

  const value = useMemo(
    () => ({
      user,
      signInAs: (nextUser: User) => {
        setUser(nextUser);
        persistUser(nextUser);
      },
      signInWithPassword: (role: Role, password: string) => {
        if (rolePasswordMap[role] !== password) {
          return {
            success: false,
            message: 'Senha invalida para o perfil selecionado.'
          };
        }

        const nextUser: User = {
          id: `u-${role.toLowerCase()}`,
          name: roleNames[role],
          role
        };

        setUser(nextUser);
        persistUser(nextUser);

        return {
          success: true,
          message: `Acesso liberado: ${roleNames[role]}.`
        };
      },
      confirmSensitiveAction: (action: SensitiveAction, password: string) => {
        if (!user) {
          return {
            success: false,
            message: 'Usuario nao autenticado para acao sensivel.'
          };
        }

        const expected = sensitivePasswordMap[user.role];
        if (expected !== password) {
          return {
            success: false,
            message: `Senha de confirmacao invalida para ${actionNameMap[action]}.`
          };
        }

        return {
          success: true,
          message: `Confirmacao de ${actionNameMap[action]} aprovada.`
        };
      },
      signOut: () => {
        setUser(null);
        persistUser(null);
      },
      can: (permission: Permission) => (user ? hasPermission(user.role, permission) : false),
      availableRoles
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de AuthProvider');
  }

  return ctx;
}
