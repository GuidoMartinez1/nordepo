import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { SucursalProvider } from './contexts/SucursalContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Clientes from './pages/Clientes'
import Proveedores from './pages/Proveedores'
import Ventas from './pages/Ventas'
import NuevaVenta from './pages/NuevaVenta'
import Compras from './pages/Compras'
import Traslados from './pages/Traslados'

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
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/productos" element={<Productos />} />
                      <Route path="/categorias" element={<Categorias />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/proveedores" element={<Proveedores />} />
                      <Route path="/ventas" element={<Ventas />} />
                      <Route path="/ventas/nueva" element={<NuevaVenta />} />
                      <Route path="/compras" element={<Compras />} />
                      <Route path="/traslados" element={<Traslados />} />
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
