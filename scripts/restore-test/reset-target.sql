-- Limpa um destino DESCARTÁVEL antes do teste de restauro. Nunca correr em produção.
-- Remove as tabelas/funções da aplicação e as contas Supabase Auth do destino.
drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
delete from auth.identities;
delete from auth.users;
