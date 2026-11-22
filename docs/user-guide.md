# Guia do utilizador

O FarmaStock regista o **stock interno** da farmácia. Não emite facturas nem substitui o software fiscal. Não registe aqui dados de doentes ou receitas.

## Entrar

1. Abra o convite recebido por email e defina a palavra-passe (mínimo 12 caracteres).
2. Entre com email e palavra-passe. Na primeira entrada, leia o aviso de privacidade e confirme.
3. Esqueceu-se? Use "Recuperar palavra-passe" no ecrã de entrada.

Pode instalar a aplicação no computador ou telemóvel (opção "Instalar" do navegador). Precisa sempre de Internet: **sem ligação, a aplicação mostra um aviso e não deixa registar nada.**

## O que cada perfil pode fazer

- **Consulta:** ver stock, lotes, movimentos, alertas e relatórios; exportar CSV.
- **Funcionário de stock:** o anterior + entradas, saídas e contagens.
- **Gestor / farmacêutico:** o anterior + produtos, fornecedores, ajustes, correcções, bloquear lotes, aprovar contagens, histórico de auditoria.
- **Administradora:** tudo, incluindo equipa e definições da farmácia.

## Tarefas do dia-a-dia

**Registar uma entrada (recepção de mercadoria)**
Movimentos → Entrada. Escolha o produto, indique o número do lote, a validade (dd/mm/aaaa), a quantidade e, se quiser, fornecedor, custo e referência da guia. Confirme. Se o lote já existir, a quantidade é somada.

**Registar uma saída**
Movimentos → Saída. Escolha o produto; os lotes aparecem por ordem de validade (o que expira primeiro em cima). Tipos: venda/consumo, devolução ao fornecedor, quebra/dano, eliminação de expirado, transferência. Quebras, devoluções e eliminações pedem um motivo. Não é possível tirar mais do que existe, nem usar lotes bloqueados; lotes expirados só aceitam "eliminação de expirado".

**Enganou-se?**
Os movimentos não se apagam. Um gestor abre o movimento e escolhe "Corrigir": é criado o movimento inverso, ligado ao original, com o motivo.

**Clicou duas vezes ou a rede falhou?**
Pode repetir: a aplicação reconhece o mesmo pedido e não duplica o movimento.

**Alertas**
O painel e o ecrã Alertas mostram produtos esgotados, abaixo do mínimo, lotes expirados e a expirar dentro das janelas definidas (por defeito 90, 60 e 30 dias).

**Contagem física**
Contagens → Iniciar contagem. Conte as prateleiras e introduza as quantidades lote a lote; as diferenças aparecem logo. Envie para revisão. O gestor aprova (gera os ajustes) ou cancela.

**Relatórios e exportação**
Produtos → Exportar CSV para o inventário; Relatórios para movimentos por período, validade e stock baixo. Os ficheiros abrem no Excel (separador `;`).

## Administradora

- **Equipa:** convidar por email, mudar o perfil, desactivar quem saiu (o acesso é cortado de imediato). Não pode alterar o seu próprio perfil, e tem de existir sempre uma administradora activa.
- **Definições:** dados da farmácia e janelas de alerta de validade.
- **Segurança:** estado dos últimos backups e histórico de auditoria.

## Boas práticas

- Cada pessoa usa a sua própria conta. Não partilhe palavras-passe.
- Termine a sessão em computadores partilhados.
- Faça uma contagem física pelo menos uma vez por mês nos produtos de maior rotação.
