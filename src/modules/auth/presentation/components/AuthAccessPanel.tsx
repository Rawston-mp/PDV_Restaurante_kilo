import { useState } from 'react';

import type { Role } from '@/modules/auth/domain/types/Role';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

const roleLabel: Record<Role, string> = {
  ADMIN: 'Admin',
  GERENTE: 'Gerente',
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  COMANDA_A: 'Comanda A',
  COMANDA_B: 'Comanda B'
};

export function AuthAccessPanel() {
  const { user, signInWithPassword, signOut, availableRoles } = useAuth();

  const [role, setRole] = useState<Role>('CAIXA');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const result = signInWithPassword(role, password);
    setMessage(result.message);

    if (result.success) {
      setPassword('');
    }
  };

  if (user) {
    return (
      <section className="auth-sidebar-status">
        <p className="auth-sidebar-label">Usuario logado</p>
        <strong>{user.name}</strong>
        <span>{roleLabel[user.role]}</span>

        <button
          type="button"
          className="button-muted auth-switch-user"
          onClick={() => {
            setPassword('');
            setMessage(null);
            signOut();
          }}
        >
          Trocar usuario
        </button>
      </section>
    );
  }

  return (
    <div className="auth-overlay">
      <section className="auth-panel auth-panel-centered">
        <div className="auth-brand">
          <strong>PDVTouch</strong>
          <span>Sistema de Ponto de Venda</span>
        </div>

        <div className="auth-panel-header">
          <strong>Acessar o sistema</strong>
          <span>Selecione seu perfil e informe o PIN</span>
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
          <div className="auth-password-row">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite o PIN"
              required
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <button type="submit" className="auth-submit">Entrar</button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-hint">
          PIN login: Admin 9000, Caixa 2025, Comanda A 1111, Comanda B 2222. PIN sensivel: Admin 9900, Caixa 2200.
        </p>
      </section>
    </div>
  );
}
