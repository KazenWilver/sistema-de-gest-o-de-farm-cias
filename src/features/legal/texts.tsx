import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Campo por preencher: destacado para nunca passar por texto aprovado. */
function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-warning-50 px-1 font-medium text-warning-700 ring-1 ring-warning-600/30">
      [{children}]
    </mark>
  );
}

export function DraftBanner() {
  return (
    <p className="mb-5 rounded-lg border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
      <strong>Versão preliminar, não aprovada.</strong> Modelo de trabalho que tem de ser completado e revisto
      por um jurista angolano antes de ser utilizado com dados reais. Os campos entre parênteses rectos estão
      por preencher.
    </p>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 font-semibold text-ink first:mt-0">{children}</h3>;
}

export function PrivacyNoticeText() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
      <DraftBanner />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium">Responsável pelo tratamento:</dt>
        <dd>
          <Todo>NOME LEGAL DA FARMÁCIA</Todo>
        </dd>
        <dt className="font-medium">Morada:</dt>
        <dd>
          <Todo>MORADA DA FARMÁCIA</Todo>
        </dd>
        <dt className="font-medium">Contacto:</dt>
        <dd>
          <Todo>EMAIL/TELEFONE PARA PEDIDOS DE PRIVACIDADE</Todo>
        </dd>
        <dt className="font-medium">Fornecedor técnico:</dt>
        <dd>
          <Todo>NOME LEGAL DO DESENVOLVEDOR/FORNECEDOR</Todo>
        </dd>
        <dt className="font-medium">Data de entrada em vigor:</dt>
        <dd>
          <Todo>DATA</Todo>
        </dd>
      </dl>
      <p>
        A <Todo>NOME DA FARMÁCIA</Todo> utiliza o FarmaStock para gerir o inventário de medicamentos e outros
        produtos de saúde. Este aviso explica que dados podem ser tratados quando um funcionário utiliza a
        aplicação.
      </p>
      <H>Que dados são tratados?</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>Nome de apresentação e identificador de acesso do utilizador.</li>
        <li>Informação necessária para autenticação e gestão de permissões.</li>
        <li>Registos de operações realizadas no sistema, como entradas, saídas e ajustes de stock.</li>
        <li>Informação técnica estritamente necessária para manter a segurança e resolver problemas.</li>
      </ul>
      <H>Para que são utilizados?</H>
      <p>
        Para permitir o acesso ao sistema, identificar quem realizou operações, proteger o inventário, manter
        o histórico de alterações e prestar apoio técnico.
      </p>
      <H>Que dados não devem ser introduzidos?</H>
      <p>
        O FarmaStock não deve ser utilizado para registar dados de pacientes, receitas médicas, diagnósticos,
        doenças, alergias ou histórico de saúde. Não introduza informação pessoal de clientes nos campos de
        observações.
      </p>
      <H>Quem pode aceder?</H>
      <p>
        Os utilizadores autorizados da farmácia podem aceder aos dados necessários às suas funções. O
        fornecedor técnico pode aceder a informação técnica ou operacional apenas quando necessário para
        prestar o serviço, resolver problemas ou cumprir obrigações legais, com acesso limitado e registo da
        intervenção.
      </p>
      <H>Onde são alojados os dados?</H>
      <p>
        <Todo>
          IDENTIFICAR OS FORNECEDORES, PAÍSES/REGIÕES E CONDIÇÕES DE TRANSFERÊNCIA APÓS VALIDAÇÃO JURÍDICA
        </Todo>
      </p>
      <H>Durante quanto tempo?</H>
      <p>
        Os dados são conservados enquanto forem necessários para as finalidades indicadas e de acordo com os
        prazos legais e operacionais definidos pela farmácia. Os dados de conta são revistos quando o acesso
        do trabalhador termina. Os backups seguem uma política de retenção limitada.
      </p>
      <H>Quais são os seus direitos?</H>
      <p>
        Pode solicitar informação, acesso, rectificação, actualização, cancelamento ou exercer oposição nos
        termos aplicáveis. Para o efeito, contacte <Todo>CONTACTO DA FARMÁCIA</Todo>.
      </p>
      <H>Segurança</H>
      <p>
        A aplicação utiliza controlos de acesso, autenticação, cifragem das comunicações, registos de
        actividade e cópias de segurança. Nenhum sistema ligado à Internet pode garantir risco zero.
      </p>
      <p>
        Para qualquer questão sobre este aviso, contacte <Todo>CONTACTO</Todo>.
      </p>
    </div>
  );
}

const TERMS: [string, string][] = [
  [
    'Objecto',
    'O FarmaStock é uma ferramenta de gestão interna de inventário. Permite registar produtos, lotes, quantidades, movimentos, datas de validade, alertas e relatórios operacionais.',
  ],
  [
    'Limites do serviço',
    'O FarmaStock não é software de facturação, contabilidade, POS, prescrição, diagnóstico, aconselhamento médico ou dispensa clínica. Não emite documentos fiscais nem substitui as obrigações da farmácia perante a AGT ou as autoridades de saúde.',
  ],
  [
    'Conta e acesso',
    'Cada utilizador deve ter credenciais próprias. A farmácia é responsável por indicar quem pode aceder e por solicitar a desactivação de contas quando necessário. As credenciais não devem ser partilhadas.',
  ],
  [
    'Utilização permitida',
    'A aplicação deve ser utilizada apenas para gestão interna e legítima do inventário da farmácia. É proibido introduzir dados de pacientes, receitas médicas, diagnósticos ou outra informação clínica.',
  ],
  [
    'Responsabilidade pelos dados',
    'A farmácia é responsável pela exactidão das quantidades, lotes, datas e demais dados que introduz. O sistema facilita a organização e não substitui a verificação física nem o julgamento profissional do farmacêutico.',
  ],
  [
    'Operações de stock',
    'Cada entrada, saída ou ajuste deve ser registado por um utilizador autorizado. Os movimentos históricos são mantidos para auditoria e não devem ser apagados para ocultar erros. As correcções são feitas por movimentos correctivos.',
  ],
  [
    'Disponibilidade e manutenção',
    'O fornecedor fará esforços razoáveis para manter o serviço disponível, mas podem ocorrer interrupções por manutenção, falhas de conectividade, indisponibilidade dos fornecedores cloud ou incidentes.',
  ],
  [
    'Segurança e cópias de segurança',
    'O fornecedor aplica medidas de segurança e executa cópias de segurança nos termos do plano contratado. As cópias reduzem o risco de perda, mas não representam garantia absoluta de recuperação.',
  ],
  [
    'Suporte',
    'O suporte incluído limita-se a dúvidas de utilização e problemas técnicos relacionados com o serviço, dentro do horário e canal indicados no contrato.',
  ],
  [
    'Suspensão',
    'O fornecedor pode suspender o acesso em caso de incumprimento contratual grave, risco de segurança ou utilização ilícita, devendo informar a farmácia e permitir, quando possível, a exportação dos seus dados.',
  ],
  [
    'Propriedade intelectual',
    'O código, desenho e componentes genéricos da plataforma pertencem ao fornecedor, salvo acordo escrito diferente. Os dados de inventário introduzidos pela farmácia permanecem sob controlo da farmácia.',
  ],
  [
    'Limitação de responsabilidade',
    'O sistema é uma ferramenta de apoio à gestão do inventário. A limitação de responsabilidade não pode excluir direitos ou responsabilidades que a lei não permita excluir. Os limites concretos devem ser revistos por jurista.',
  ],
  [
    'Cancelamento e saída',
    'A farmácia pode cancelar nos termos do contrato. O fornecedor disponibiliza uma exportação dos dados num formato comum dentro do prazo contratual; depois, os dados são eliminados segundo a política de retenção.',
  ],
  [
    'Lei aplicável',
    'Aplicam-se as leis da República de Angola. O foro deve ser definido no contrato definitivo.',
  ],
];

export function TermsText() {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
      <DraftBanner />
      <p>
        <strong>Fornecedor:</strong> <Todo>NOME LEGAL DO FORNECEDOR</Todo> · <strong>Cliente:</strong> cada
        farmácia que contrata o serviço · <strong>Versão/Data:</strong> <Todo>VERSÃO E DATA</Todo>
      </p>
      {TERMS.map(([title, body], i) => (
        <div key={title}>
          <H>
            {i + 1}. {title}
          </H>
          <p>{body}</p>
        </div>
      ))}
      <H>Contacto</H>
      <p>
        <Todo>EMAIL E MORADA DO FORNECEDOR</Todo>
      </p>
    </div>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-8">
      <article className="mx-auto max-w-3xl rounded-xl border border-line bg-surface px-6 py-6">
        <Link to="/" className="text-sm text-brand-700 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mb-4 mt-3 text-xl font-semibold">
          {kind === 'privacy' ? 'Aviso de Privacidade — FarmaStock' : 'Termos de Utilização — FarmaStock'}
        </h1>
        {kind === 'privacy' ? <PrivacyNoticeText /> : <TermsText />}
      </article>
    </div>
  );
}
