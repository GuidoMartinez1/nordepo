import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { SucursalProvider } from './contexts/SucursalContext'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Proveedores from './pages/Proveedores'
import Ventas from './pages/Ventas'
import NuevaVenta from './pages/NuevaVenta'
import Compras from './pages/Compras'
import NuevaCompra from './pages/NuevaCompra'
import Traslados from './pages/Traslados'
import Actualizaciones from './pages/Actualizaciones'
import CuentasMp from './pages/CuentasMp'
import Gastos from './pages/Gastos'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SucursalProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route
                        path="/"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Dashboard />
                          </RoleRoute>
                        }
                      />
                      <Route path="/productos" element={<Productos />} />
                      <Route
                        path="/categorias"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Categorias />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/proveedores"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Proveedores />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/gastos"
                        element={
                          <RoleRoute roles={['admin', 'vendedor']}>
                            <Gastos />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/reportes"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Reportes />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/cuentas-mp"
                        element={
                          <RoleRoute roles={['admin']}>
                            <CuentasMp />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/usuarios"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Usuarios />
                          </RoleRoute>
                        }
                      />
                      <Route path="/ventas" element={<Ventas />} />
                      <Route path="/ventas/nueva" element={<NuevaVenta />} />
                      <Route
                        path="/compras"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Compras />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/compras/nueva"
                        element={
                          <RoleRoute roles={['admin']}>
                            <NuevaCompra />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/traslados"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Traslados />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/actualizaciones"
                        element={
                          <RoleRoute roles={['admin']}>
                            <Actualizaciones />
                          </RoleRoute>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
          <Toaster position="top-right" />
        </SucursalProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
