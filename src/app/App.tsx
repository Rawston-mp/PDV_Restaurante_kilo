import { NavLink, Route, Routes } from 'react-router-dom';

import { DashboardPage } from '@/modules/orders/presentation/pages/DashboardPage';
import { NewOrderPage } from '@/modules/orders/presentation/pages/NewOrderPage';
import { ProductsPage } from '@/modules/products/presentation/pages/ProductsPage';
import { RequirePermission } from '@/modules/auth/presentation/components/RequirePermission';
import { RequireRole } from '@/modules/auth/presentation/components/RequireRole';
import { AuthAccessPanel } from '@/modules/auth/presentation/components/AuthAccessPanel';
import { BalancaScreen } from '@/components/Balanca/BalancaScreen';

export function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>PDV Touch</h1>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/orders/new">Novo Pedido</NavLink>
          <NavLink to="/products">Produtos</NavLink>
          <NavLink to="/balanca">Balancas</NavLink>
        </nav>

        <AuthAccessPanel />
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
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
              <RequirePermission permission="products:manage">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/balanca"
            element={
              <RequireRole allowedRoles={['ADMIN', 'GERENTE', 'CAIXA', 'BALANCA_A', 'BALANCA_B']}>
                <BalancaScreen />
              </RequireRole>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
