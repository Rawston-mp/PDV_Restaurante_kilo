import type { Role } from '@/modules/auth/domain/types/Role';
import type { Permission } from '@/modules/auth/domain/types/Permission';

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: ['orders:create', 'orders:add-item', 'orders:advance-status', 'products:view', 'products:manage'],
  GERENTE: ['orders:create', 'orders:add-item', 'orders:advance-status', 'products:view', 'products:manage'],
  CAIXA: ['orders:create', 'orders:add-item', 'orders:advance-status', 'products:view', 'products:manage'],
  ATENDENTE: ['orders:create', 'orders:add-item', 'products:view', 'products:manage'],
  COMANDA_A: ['orders:add-item', 'products:view'],
  COMANDA_B: ['orders:add-item', 'products:view']
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
