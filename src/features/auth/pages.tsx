import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { Button, Notice } from '@/components/ui';
import { Field, Input } from '@/components/forms/Field';
import { supabase } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/errors';
import { loginSchema, resetRequestSchema, setPasswordSchema } from '@/lib/validation/schemas';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { PRIVACY_NOTICE_VERSION } from '@/features/pharmacy/PharmacyProvider';
import { PrivacyNoticeText } from '@/features/legal/texts';

export function LoginPage() {
  const { session, passwordSetupPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  if (session && passwordSetupPending) return <Navigate to="/definir-palavra-passe" replace />;
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword(values);
    if (e) setError(toUserMessage(e));
    else navigate('/', { replace: true });
  });

  return (
    <AuthLayout title="Iniciar sessão" description="Use a conta individual que recebeu por convite.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Email" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="username" {...form.register('email')} />}
        </Field>
        <Field label="Palavra-passe" error={form.formState.errors.password?.message}>
          {(p) => (
            <Input {...p} type="password" autoComplete="current-password" {...form.register('password')} />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Entrar
        </Button>
        <p className="text-center text-sm">
          <Link to="/recuperar-palavra-passe" className="text-brand-700 underline-offset-2 hover:underline">
            Esqueci-me da palavra-passe
          </Link>
        </p>
        <p className="text-xs text-muted">
          Não existe registo público. Se precisa de acesso, peça à administradora da farmácia.
        </p>
      </form>
    </AuthLayout>
  );
}

export function ResetRequestPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof resetRequestSchema>, unknown, z.output<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema),
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-palavra-passe`,
    });
    // Por segurança, a resposta é igual exista ou não a conta.
    if (e && e.status === 429) setError(toUserMessage(e));
    else setSent(true);
  });

  return (
    <AuthLayout
      title="Recuperar palavra-passe"
      description="Enviamos uma ligação para definir uma nova palavra-passe."
    >
      {sent ? (
        <Notice tone="success" title="Pedido registado">
          Se o email pertencer a uma conta activa, vai receber uma mensagem com as instruções nos próximos
          minutos.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Email" error={form.formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="username" {...form.register('email')} />}
          </Field>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Enviar instruções
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/entrar" className="text-brand-700 hover:underline">
          Voltar ao início de sessão
        </Link>
      </p>
    </AuthLayout>
  );
}

export function SetPasswordPage() {
  const { session, loading, clearPasswordSetup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof setPasswordSchema>, unknown, z.output<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
  });

  if (loading) return null;
  if (!session) {
    return (
      <AuthLayout title="Ligação inválida ou expirada">
        <Notice tone="warning">
          A ligação do convite ou da recuperação já não é válida. Peça um novo convite à administradora ou use
          “Esqueci-me da palavra-passe”.
        </Notice>
        <p className="mt-4 text-center text-sm">
          <Link to="/entrar" className="text-brand-700 hover:underline">
            Ir para o início de sessão
          </Link>
        </p>
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) {
      setError(toUserMessage(e));
      return;
    }
    clearPasswordSetup();
    window.history.replaceState(null, '', window.location.pathname);
    navigate('/', { replace: true });
  });

  return (
    <AuthLayout
      title="Definir palavra-passe"
      description={`Conta: ${session.user.email ?? ''}. Use pelo menos 12 caracteres, com maiúsculas, minúsculas e algarismos.`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Nova palavra-passe" error={form.formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Field label="Repetir palavra-passe" error={form.formState.errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('confirm')} />}
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Guardar palavra-passe
        </Button>
      </form>
    </AuthLayout>
  );
}

export function NoAccessPage() {
  const { signOut, session } = useAuth();
  return (
    <AuthLayout title="Sem acesso a nenhuma farmácia">
      <p className="text-sm text-ink-soft">
        A conta {session?.user.email ? <strong>{session.user.email}</strong> : null} não está associada a
        nenhuma farmácia activa, ou o acesso foi desactivado. Fale com a administradora da farmácia.
      </p>
      <Button variant="secondary" className="mt-5 w-full" onClick={() => void signOut()}>
        Terminar sessão
      </Button>
    </AuthLayout>
  );
}

export function NotConfiguredPage() {
  return (
    <AuthLayout title="Configuração em falta">
      <div className="space-y-3 text-sm text-ink-soft">
        <p>A aplicação ainda não tem os dados de ligação ao Supabase.</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Copie <code className="rounded bg-canvas px-1">.env.example</code> para{' '}
            <code className="rounded bg-canvas px-1">.env.local</code>.
          </li>
          <li>
            Preencha <code className="rounded bg-canvas px-1">VITE_SUPABASE_URL</code> e{' '}
            <code className="rounded bg-canvas px-1">VITE_SUPABASE_ANON_KEY</code> (chave pública).
          </li>
          <li>Reinicie o servidor de desenvolvimento.</li>
        </ol>
        <p>Veja o README para o ambiente local com o Supabase CLI.</p>
      </div>
    </AuthLayout>
  );
}

/** Primeiro acesso: confirmação de leitura do aviso de privacidade (não é consentimento). */
export function PrivacyAcknowledgePage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from('privacy_acknowledgements')
      .insert({ user_id: userId, notice_version: PRIVACY_NOTICE_VERSION });
    setSaving(false);
    if (e && e.code !== '23505') {
      setError(toUserMessage(e));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['privacy-ack'] });
  };

  return (
    <div className="min-h-dvh bg-canvas px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-6 py-4">
          <h1 className="text-lg font-semibold">
            Aviso de Privacidade — leitura obrigatória no primeiro acesso
          </h1>
          <p className="mt-1 text-sm text-muted">Versão {PRIVACY_NOTICE_VERSION}</p>
        </div>
        <div className="max-h-[55dvh] overflow-y-auto px-6 py-5">
          <PrivacyNoticeText />
        </div>
        <div className="space-y-4 border-t border-line px-6 py-5">
          <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-ink">
            Tomei conhecimento do Aviso de Privacidade do FarmaStock e sei que devo utilizar o sistema apenas
            para tarefas relacionadas com a gestão interna do inventário da farmácia. Não devo introduzir
            dados de pacientes, receitas médicas ou informação clínica.
          </p>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => void signOut()}>
              Sair
            </Button>
            <Button onClick={() => void confirm()} loading={saving}>
              Confirmar leitura e continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
