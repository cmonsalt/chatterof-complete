# ChatterOF - OnlyFans Chat Management System

Sistema de gestión inteligente de chats para OnlyFans con IA.

## 🚀 Quick Start

### 1. Clonar repositorio

```bash
git clone https://github.com/tu-usuario/chatterof-frontend.git
cd chatterof-frontend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` y agrega tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 5. Build para producción

```bash
npm run build
```

## 📋 Configuración de Supabase

### Edge Functions

Debes desplegar las siguientes funciones en Supabase:

1. **chat-generate**: Genera respuestas con IA
2. **auth-signup**: Registro de usuarios

```bash
cd supabase
supabase functions deploy chat-generate
supabase functions deploy auth-signup
```

### Base de Datos

Ejecuta el schema SQL proporcionado en `supabase/schema.sql`

## 🏗️ Estructura del Proyecto

```
chatterof-frontend/
├── src/
│   ├── components/      # Componentes reutilizables
│   ├── contexts/        # Contextos de React (Auth)
│   ├── lib/            # Configuración (Supabase)
│   ├── pages/          # Páginas principales
│   ├── App.jsx         # App principal
│   └── main.jsx        # Entry point
├── supabase/
│   ├── functions/      # Edge Functions
│   └── schema.sql      # Schema de BD
└── package.json
```

## 🌐 Deploy

### Vercel (Recomendado)

1. Push a GitHub
2. Importa en Vercel
3. Agrega variables de entorno
4. Deploy automático

## 📝 Licencia

MIT
