import type { Role } from '@/modules/auth/domain/types/Role';

export type User = {
  id: string;
  name: string;
  role: Role;
};
