# NORDEPO

Sistema de gestión de ventas para artículos deportivos (multi-sucursal).

Stack: React + Vite + Tailwind · Express · PostgreSQL · JWT  
Deploy previsto: Netlify (front) + Render (API), igual que AliMar.

## Qué incluye (esqueleto)

- Auth con JWT
- Sucursales + **stock por sucursal**
- Productos (1 fila = modelo/talle/color)
- Categorías, clientes, proveedores
- Ventas (descuentan stock de la sucursal activa)
- Compras (suman stock a la sucursal activa)
- Traslados entre sucursales
- Dashboard filtrado por sucursal

**No incluye:** bolsas abiertas, venta por kg, AFIP.

## Requisitos

- Node.js 18+
- PostgreSQL corriendo en localhost

## Setup local

```bash
# 1. Dependencias
npm run install:all
# o desde la raíz:
npm install && npm install --prefix backend && npm install --prefix frontend

# 2. Variables de entorno
cp backend/.env.example backend/.env
# Editá DB_PASSWORD, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

# 3. Crear la base en PostgreSQL
createdb nordepo
# (o: psql -c "CREATE DATABASE nordepo;")

# 4. Crear tablas + usuario admin + sucursales Centro/Norte
npm run init-db

# 5. Correr API + front
npm run dev
```

- Frontend: http://localhost:3000  
- API: http://localhost:3001  

Login con el usuario definido en `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Estructura

```
nordepo/
├── backend/src/          # Express API
│   ├── initDb.js         # Schema multi-sucursal
│   ├── server.js
│   └── routes/
└── frontend/src/         # React app
    ├── contexts/         # Auth + Sucursal activa
    ├── pages/
    └── components/
```

## Modelo de stock

`productos` no tiene stock global. El stock vive en `stock_sucursal (producto_id, sucursal_id, cantidad)`.
