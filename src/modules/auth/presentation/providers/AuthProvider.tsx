import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { User } from '@/modules/auth/domain/entities/User';
import { hasPermission } from '@/modules/auth/domain/services/permissionPolicy';
import type { Permission } from '@/modules/auth/domain/types/Permission';
import { getRoleLabel, type Role } from '@/modules/auth/domain/types/Role';
import {
  changeRolePin,
  getPinPolicySummary,
  verifyLoginPin,
  verifySensitivePin,
  type PinKind
} from '@/modules/auth/infrastructure/local/pinPolicy';
import {
  findStoreSettingById,
  getStoreSettingsForRole,
  roleCanAccessStore
} from '@/modules/admin/infrastructure/local/platformSettings';
import { logInfo, logWarn } from '@/shared/infrastructure/logging/structuredLogger';

export type SensitiveAction = 'CLOSE_COMANDA' | 'CANCEL_ORDER';

type ChangePinInput = {
  kind: PinKind;
  role: Role;
  currentPin: string;
  nextPin: string;
  confirmPin: string;
};

type AuthContextValue = {
  user: User | null;
  signInAs: (user: User) => void;
  signInWithPassword: (role: Role, password: string, storeId?: string) => { success: boolean; message: string };
  confirmSensitiveAction: (
    action: SensitiveAction,
    password: string
  ) => { success: boolean; message: string };
  signOut: () => void;
  can: (permission: Permission) => boolean;
  availableRoles: Role[];
  changePin: (input: ChangePinInput) => { success: boolean; message: string };
  getPinHealth: () => { loginStrengthIssues: number; sensitiveStrengthIssues: number };
};

const AuthContext = createContext<AuthContextValue | null>(null);

const storageKey = 'pdv.auth.user';

const actionNameMap: Record<SensitiveAction, string> = {
  CLOSE_COMANDA: 'fechamento de comanda',
  CANCEL_ORDER: 'cancelamento de pedido'
};

const getStoreDisplayName = (store: { name: string; tradeName?: string }) => store.tradeName || store.name;

const availableRoles: Role[] = ['ADMIN', 'CAIXA', 'COMANDA_A', 'COMANDA_B', 'GERENTE', 'ATENDENTE'];

const defaultUser: User = {
  id: 'u-admin-default',
  name: 'Administrador',
  role: 'ADMIN'
};

const loadStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (import.meta.env.DEV) {
    if (window.localStorage && typeof window.localStorage.removeItem === 'function') {
      window.localStorage.removeItem(storageKey);
    }

    return null;
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
      signInWithPassword: (role: Role, password: string, storeId?: string) => {
        const selectedStore = storeId ? findStoreSettingById(storeId) : getStoreSettingsForRole(role)[0] ?? null;

        if (!selectedStore) {
          logWarn({
            event: 'AUTH_LOGIN_DENIED',
            module: 'auth',
            details: { role, reason: 'STORE_NOT_FOUND' }
          });

          return {
            success: false,
            message: 'Selecione uma loja ativa para acessar o sistema.'
          };
        }

        if (!roleCanAccessStore(role, selectedStore)) {
          logWarn({
            event: 'AUTH_LOGIN_DENIED',
            module: 'auth',
            details: { role, storeId: selectedStore.id, reason: 'STORE_ROLE_NOT_LINKED' }
          });

          return {
            success: false,
            message: `Perfil ${getRoleLabel(role)} não está vinculado à loja ${getStoreDisplayName(selectedStore)}.`
          };
        }

        if (!verifyLoginPin(role, password)) {
          logWarn({
            event: 'AUTH_LOGIN_DENIED',
            module: 'auth',
            details: { role, storeId: selectedStore.id }
          });

          return {
            success: false,
            message: 'Senha inválida para o perfil selecionado.'
          };
        }

        const nextUser: User = {
          id: `u-${role.toLowerCase()}`,
          name: getRoleLabel(role),
          role,
          storeId: selectedStore.id,
          storeName: getStoreDisplayName(selectedStore)
        };

        setUser(nextUser);
        persistUser(nextUser);

        logInfo({
          event: 'AUTH_LOGIN_SUCCESS',
          module: 'auth',
          details: { role, storeId: selectedStore.id }
        });

        return {
          success: true,
          message: `Acesso liberado: ${getRoleLabel(role)} em ${getStoreDisplayName(selectedStore)}.`
        };
      },
      confirmSensitiveAction: (action: SensitiveAction, password: string) => {
        if (!user) {
          return {
            success: false,
            message: 'Usuário não autenticado para ação sensível.'
          };
        }

        if (!verifySensitivePin(user.role, password)) {
          logWarn({
            event: 'AUTH_SENSITIVE_DENIED',
            module: 'auth',
            details: { action, actorRole: user.role }
          });

          return {
            success: false,
            message: `Senha de confirmação inválida para ${actionNameMap[action]}.`
          };
        }

        logInfo({
          event: 'AUTH_SENSITIVE_APPROVED',
          module: 'auth',
          details: { action, actorRole: user.role }
        });

        return {
          success: true,
          message: `Confirmação de ${actionNameMap[action]} aprovada.`
        };
      },
      changePin: ({ kind, role, currentPin, nextPin, confirmPin }: ChangePinInput) => {
        if (!user || user.role !== 'ADMIN') {
          return {
            success: false,
            message: 'Somente ADMIN pode alterar a política de PIN.'
          };
        }

        if (nextPin !== confirmPin) {
          return {
            success: false,
            message: 'A confirmação do novo PIN não confere.'
          };
        }

        const result = changeRolePin({
          kind,
          role,
          currentPin,
          nextPin
        });

        if (result.success) {
          logInfo({
            event: 'AUTH_PIN_CHANGED',
            module: 'auth',
            details: { kind, role, actorRole: user.role }
          });
        } else {
          logWarn({
            event: 'AUTH_PIN_CHANGE_DENIED',
            module: 'auth',
            details: { kind, role, actorRole: user.role }
          });
        }

        return result;
      },
      getPinHealth: () => getPinPolicySummary(),
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
