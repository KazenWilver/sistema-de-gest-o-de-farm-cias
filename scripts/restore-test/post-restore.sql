-- Objectos fora dos schemas da aplicação que o dump não inclui.
-- O trigger que cria o perfil quando o Supabase Auth cria um utilizador está em auth.users,
-- schema excluído pelo `supabase db dump`. Recriar aqui (idempotente).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
