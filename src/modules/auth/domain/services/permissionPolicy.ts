import type { Role } from '@/modules/auth/domain/types/Role';
import type { Permission } from '@/modules/auth/domain/types/Permission';

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: ['orders:create', 'orders:add-item', 'orders:advance-status', 'products:manage'],
  GERENTE: ['orders:create', 'orders:add-item', 'orders:advance-status', 'products:manage'],
  CAIXA: ['orders:create', 'orders:add-item', 'orders:advance-status'],
  ATENDENTE: ['orders:create', 'orders:add-item'],
  BALANCA_A: ['orders:add-item'],
  BALANCA_B: ['orders:add-item']
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
