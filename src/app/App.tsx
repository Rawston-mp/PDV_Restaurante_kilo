import { useEffect, useRef } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { RestaurantDashboardPage } from '@/modules/orders/presentation/pages/RestaurantDashboardPage';
import { WelcomePage } from '@/modules/home/presentation/pages/WelcomePage';
import { NewOrderPage } from '@/modules/orders/presentation/pages/NewOrderPage';
import { ProductsPage } from '@/modules/products/presentation/pages/ProductsPage';
import { RequirePermission } from '@/modules/auth/presentation/components/RequirePermission';
import { RequireRole } from '@/modules/auth/presentation/components/RequireRole';
import { AuthAccessPanel } from '@/modules/auth/presentation/components/AuthAccessPanel';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { ComandaScreen } from '@/components/Comanda/ComandaScreen';
import { AdminPage } from '@/modules/admin/presentation/pages/AdminPage';
import { CadastroPage } from '@/modules/suppliers/presentation/pages/CadastroPage';
import { CashierPage } from '@/modules/cashier/presentation/pages/CashierPage';
import { startFiscalRetryWorker } from '@/modules/fiscal/infrastructure/container/fiscalRetryWorker';

const FLUSH_ROUTES = ['/caixa', '/comanda'];

export function App() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isScaleTerminal = user?.role === 'COMANDA_A' || user?.role === 'COMANDA_B';
  const canAccessDashboard = user?.role === 'ADMIN' || user?.role === 'GERENTE';
  const canAccessCadastro = user?.role === 'ADMIN' || user?.role === 'GERENTE';
  const isFlush = FLUSH_ROUTES.some((r) => location.pathname.startsWith(r));
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => startFiscalRetryWorker(), []);

  useEffect(() => {
    if (isScaleTerminal && !location.pathname.startsWith('/comanda')) {
      navigate('/comanda', { replace: true });
    }
  }, [isScaleTerminal, location.pathname, navigate]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const currentUserId = user?.id ?? null;
    previousUserIdRef.current = currentUserId;

    if (!previousUserId && currentUserId && !isScaleTerminal) {
      navigate('/', { replace: true });
    }
  }, [isScaleTerminal, navigate, user?.id]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>PDV Touch</h1>
        <nav>
          {canAccessDashboard && <NavLink to="/dashboard">Dashboard</NavLink>}
          {!isScaleTerminal && <NavLink to="/orders/new">Novo Pedido</NavLink>}
          {!isScaleTerminal && <NavLink to="/products">Produtos</NavLink>}
          <NavLink to="/comanda">Balanças</NavLink>
          {!isScaleTerminal && <NavLink to="/caixa">Caixa</NavLink>}
          {canAccessCadastro && <NavLink to="/cadastro">Cadastros</NavLink>}
          {!isScaleTerminal && user?.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <AuthAccessPanel />
      </aside>

      <main className={isFlush ? 'content--flush' : 'content'}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE']}>
                <WelcomePage />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE']}>
                <RestaurantDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/orders/new"
            element={
              <RequirePermission permission="orders:create">
                <NewOrderPage />
              </RequirePermission>
            }
          />
          <Route
            path="/products"
            element={
              <RequirePermission permission="products:view">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/comanda"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA', 'COMANDA_A', 'COMANDA_B']}>
                <ComandaScreen />
              </RequireRole>
            }
          />
          <Route
            path="/caixa"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA']}>
                <CashierPage />
              </RequireRole>
            }
          />
          <Route
            path="/cadastro"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE']}>
                <CadastroPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole allowedRoles={['ADMIN']}>
                <AdminPage />
              </RequireRole>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
