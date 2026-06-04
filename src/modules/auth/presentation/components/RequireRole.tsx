import type { ReactNode } from 'react';

import type { Role } from '@/modules/auth/domain/types/Role';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

type RequireRoleProps = {
  allowedRoles: Role[];
  children: ReactNode;
};

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <div className="card">Acesso negado para o perfil atual.</div>;
  }

  return <>{children}</>;
}
