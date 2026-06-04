import { useState } from 'react';

import type { Role } from '@/modules/auth/domain/types/Role';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

const roleLabel: Record<Role, string> = {
  ADMIN: 'Admin',
  GERENTE: 'Gerente',
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  BALANCA_A: 'Balanca A',
  BALANCA_B: 'Balanca B'
};

export function AuthAccessPanel() {
  const { user, signInWithPassword, signOut, availableRoles } = useAuth();

  const [role, setRole] = useState<Role>('CAIXA');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const result = signInWithPassword(role, password);
    setMessage(result.message);

    if (result.success) {
      setPassword('');
    }
  };

  return (
    <section className="auth-panel">
      <div className="auth-panel-header">
        <strong>Controle de acesso</strong>
        <span>{user ? `${roleLabel[user.role]} ativo` : 'Nao autenticado'}</span>
      </div>

      <form onSubmit={onSubmit} className="auth-form">
        <label htmlFor="role">Perfil</label>
        <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {availableRoles.map((option) => (
            <option key={option} value={option}>
              {roleLabel[option]}
            </option>
          ))}
        </select>

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite o PIN"
          required
        />

        <button type="submit">Entrar</button>
      </form>

      <button type="button" className="button-muted auth-logout" onClick={signOut}>
        Sair
      </button>

      {message && <p className="auth-message">{message}</p>}

      <p className="auth-hint">
        PIN login: Admin 9000, Caixa 2025, Balanca A 1111, Balanca B 2222. PIN sensivel: Admin 9900, Caixa 2200.
      </p>
    </section>
  );
}
