export type Role =
  | 'ADMIN'
  | 'GERENTE'
  | 'CAIXA'
  | 'ATENDENTE'
  | 'COMANDA_A'
  | 'COMANDA_B';

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  COMANDA_A: 'Balança A',
  COMANDA_B: 'Balança B'
};

export const getRoleLabel = (role: Role) => roleLabels[role] ?? role;
