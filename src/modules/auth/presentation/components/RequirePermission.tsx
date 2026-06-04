import type { ReactNode } from 'react';

import type { Permission } from '@/modules/auth/domain/types/Permission';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

type RequirePermissionProps = {
  permission: Permission;
  children: ReactNode;
};

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { user, can } = useAuth();

  if (!user || !can(permission)) {
    return <div className="card">Acesso negado para a permissao solicitada.</div>;
  }

  return <>{children}</>;
}
