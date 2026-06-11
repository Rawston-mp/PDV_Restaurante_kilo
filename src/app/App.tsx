import { NavLink, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '@/modules/orders/presentation/pages/DashboardPage';
import { NewOrderPage } from '@/modules/orders/presentation/pages/NewOrderPage';
import { ProductsPage } from '@/modules/products/presentation/pages/ProductsPage';
import { RequirePermission } from '@/modules/auth/presentation/components/RequirePermission';
import { RequireRole } from '@/modules/auth/presentation/components/RequireRole';
import { AuthAccessPanel } from '@/modules/auth/presentation/components/AuthAccessPanel';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { ComandaScreen } from '@/components/Comanda/ComandaScreen';
import { AdminPage } from '@/modules/admin/presentation/pages/AdminPage';
import { CadastroPage } from '@/modules/suppliers/presentation/pages/CadastroPage';

export function App() {
  const { user } = useAuth();
  const canAccessDashboard = user?.role !== 'COMANDA_A' && user?.role !== 'COMANDA_B';
  const canAccessCadastro = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA';

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>PDV Touch</h1>
        <nav>
          {canAccessDashboard && <NavLink to="/">Dashboard</NavLink>}
          <NavLink to="/orders/new">Novo Pedido</NavLink>
          <NavLink to="/products">Produtos</NavLink>
          <NavLink to="/comanda">Balanças</NavLink>
          {canAccessCadastro && <NavLink to="/cadastro">Cadastros</NavLink>}
          <NavLink to="/admin">Admin</NavLink>
        </nav>

        <AuthAccessPanel />
      </aside>

      <main className="content">
        <Routes>
          <Route
            path="/"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE']}>
                <DashboardPage />
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
            path="/cadastro"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA']}>
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
