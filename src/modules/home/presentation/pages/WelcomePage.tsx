import { Building2, CheckCircle2, Home, ShoppingCart } from 'lucide-react';

import { findStoreSettingById } from '@/modules/admin/infrastructure/local/platformSettings';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { DashboardPage } from '@/modules/orders/presentation/pages/DashboardPage';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatCnpj = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length !== 14) {
    return value || '00.000.000/0000-00';
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const buildAddressLine = (store: ReturnType<typeof findStoreSettingById>) => {
  if (!store) {
    return 'Rua Exemplo, 123 - Centro - Cidade/UF';
  }

  const street = [store.address, store.number].filter(Boolean).join(', ');
  const district = store.district ? ` - ${store.district}` : '';
  const cityUf = [store.city, store.state].filter(Boolean).join('/');
  const cityLine = cityUf ? ` - ${cityUf}` : '';
  const address = `${street}${district}${cityLine}`.trim();

  return address || 'Rua Exemplo, 123 - Centro - Cidade/UF';
};

export function WelcomePage() {
  const { user } = useAuth();
  const store = user?.storeId ? findStoreSettingById(user.storeId) : null;
  const displayName = store?.tradeName || store?.name || user?.storeName || 'PDVTouch Restaurante';
  const legalName = store?.legalName || displayName;
  const cnpj = formatCnpj(store?.cnpj ?? '');
  const addressLine = buildAddressLine(store);
  const welcomeTitle = store?.welcomeTitle?.trim() || 'Bem-vindo ao PDV!';
  const welcomeSubtitle = store?.welcomeSubtitle?.trim() || 'Tudo pronto para você realizar ótimas vendas.';
  const logoUrl = store?.logoUrl?.trim() || '';

  return (
    <section className="welcome-page">
      <div className="welcome-hero card">
        <div className="welcome-copy">
          <h2>{welcomeTitle}</h2>
          <p>{welcomeSubtitle}</p>

          <article className="welcome-store-card">
            <div className="welcome-store-icon" aria-hidden="true">
              <Home size={22} />
            </div>
            <div>
              <span>Estabelecimento</span>
              <strong>{displayName}</strong>
              <p>{cnpj}</p>
              <p>{addressLine}</p>
              {legalName !== displayName && <p>Razão social: {legalName}</p>}
            </div>
          </article>
        </div>

        <div className="welcome-visual" aria-hidden="true">
          {logoUrl ? (
            <div className="welcome-logo-frame">
              <img src={logoUrl} alt="" />
            </div>
          ) : (
            <>
              <div className="welcome-terminal">
                <div className="welcome-screen">
                  <ShoppingCart size={34} />
                  <CheckCircle2 size={22} />
                </div>
                <div className="welcome-terminal-base" />
              </div>
              <div className="welcome-card-chip welcome-card-chip-left" />
              <div className="welcome-card-chip welcome-card-chip-right" />
              <Building2 className="welcome-building-mark" size={36} />
            </>
          )}
        </div>
      </div>

      <div className="welcome-dashboard">
        <DashboardPage />
      </div>
    </section>
  );
}
