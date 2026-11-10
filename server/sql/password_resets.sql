-- ExxaSoft — tabla de códigos de restablecimiento de contraseña (proyecto Supabase de Eco)
-- Ejecutar una vez en el editor SQL de Supabase (Eco).
-- Solo el service_role (usado desde server/, nunca desde el navegador) puede leer o
-- escribir esta tabla: RLS queda activo y sin políticas, por lo que el acceso con
-- la anon key queda bloqueado por completo.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_email_pending_idx
  on public.password_resets (email)
  where used_at is null;

alter table public.password_resets enable row level security;
