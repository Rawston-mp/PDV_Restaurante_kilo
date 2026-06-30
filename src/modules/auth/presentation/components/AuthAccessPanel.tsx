import { useEffect, useMemo, useState } from 'react';

import { getRoleLabel, type Role } from '@/modules/auth/domain/types/Role';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import {
  readStoreSettings,
  roleCanAccessStore,
  type StoreSettings
} from '@/modules/admin/infrastructure/local/platformSettings';
import { getDefaultPinHint } from '@/modules/auth/infrastructure/local/pinPolicy';

const getStoreDisplayName = (store: StoreSettings) => store.tradeName || store.name;

export function AuthAccessPanel() {
  const { user, signInWithPassword, signOut, availableRoles } = useAuth();

  const [role, setRole] = useState<Role>('CAIXA');
  const [stores, setStores] = useState<StoreSettings[]>(readStoreSettings);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const accessibleStores = useMemo(
    () => stores.filter((store) => roleCanAccessStore(role, store)),
    [role, stores]
  );
  const selectedStore = accessibleStores.find((store) => store.id === selectedStoreId) ?? null;

  useEffect(() => {
    if (!user) {
      setStores(readStoreSettings());
    }
  }, [user]);

  useEffect(() => {
    if (selectedStore && accessibleStores.some((store) => store.id === selectedStore.id)) {
      return;
    }

    const firstStore = accessibleStores[0];
    setSelectedStoreId(firstStore?.id ?? '');
  }, [accessibleStores, selectedStore]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const result = signInWithPassword(role, password, selectedStoreId);
    setMessage(result.message);

    if (result.success) {
      setPassword('');
    }
  };

  if (user) {
    return (
      <section className="auth-sidebar-status">
        <p className="auth-sidebar-label">Usuário logado</p>
        <strong>{user.name}</strong>
        <span>{getRoleLabel(user.role)}</span>
        <span>Loja: {user.storeName ?? 'Sem loja'}</span>

        <button
          type="button"
          className="button-muted auth-switch-user"
          onClick={() => {
            setPassword('');
            setMessage(null);
            signOut();
          }}
        >
          Trocar usuário
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
          <span>Selecione a loja, o usuário e informe o PIN</span>
        </div>

        <form onSubmit={onSubmit} className="auth-form" autoComplete="off">
          <label htmlFor="store-select">Loja</label>
          <select
            id="store-select"
            value={selectedStoreId}
            onChange={(event) => {
              setSelectedStoreId(event.target.value);
              setMessage(null);
            }}
            disabled={accessibleStores.length === 0}
          >
            {accessibleStores.length === 0 ? (
              <option value="">Nenhuma loja vinculada</option>
            ) : (
              accessibleStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {getStoreDisplayName(store)}
                </option>
              ))
            )}
          </select>

          <label htmlFor="role">Usuário</label>
          <select
            id="role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as Role);
              setSelectedStoreId('');
            }}
          >
            {availableRoles.map((option) => (
              <option key={option} value={option}>
                {getRoleLabel(option)}
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
              autoComplete="new-password"
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

          <button type="submit" className="auth-submit" disabled={!selectedStoreId}>Entrar</button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-hint">{getDefaultPinHint()}</p>
      </section>
    </div>
  );
}
