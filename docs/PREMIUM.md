# Premium por desafio

## Regras definidas com o proprietário

- O administrador contrata para um desafio específico; os convidados não pagam.
- Mensal: R$ 9,90 (990 centavos), renovação mensal.
- Anual: R$ 49,90 (4.990 centavos), período de 12 meses.
- Gratuito: musculação, até 5 pessoas por desafio.
- Premium: cardio e musculação, até 200 pessoas por desafio.
- A assinatura de um desafio não concede Premium a outros desafios.
- Asaas foi escolhido; o proprietário criou uma conta de produção. A cobrança no Pulso ainda não está ativa.

## Padrões propostos para implementação

Os limites incluem o administrador, seguindo a contagem de membros existente.
O plano anual terá renovação anual; ambas as opções informarão a renovação e
permitirão cancelamento pelo administrador.

Cancelar a renovação mantém os benefícios até o fim do período já pago.
Depois desse período, desafios de cardio ou grupos de musculação com mais de
5 pessoas ficam disponíveis para consulta, sem novas entradas ou nova atividade
no desafio, até a regularização. Não apagar treinos, fotos ou membros existentes.
Grupos de musculação com até 5 pessoas continuam no plano gratuito.
Aplicar a mesma política aos desafios existentes ao lançar o Premium, com
comunicação prévia da transição; não bloquear o site antes do checkout funcional.

## Integração entre checkout e aplicativo

O checkout recebe o pagamento; o aplicativo controla os benefícios.

1. Administrador escolhe o plano na página do desafio.
2. Servidor identifica o administrador e cria uma contratação para aquele desafio,
   com preço e periodicidade definidos no servidor. Não aceitar preço do navegador.
3. Redirecionar para checkout hospedado no Asaas, sem receber ou guardar os dados
   do cartão no Pulso.
4. Receber a confirmação por webhook autenticado e conferir o pagamento no Asaas.
   Validar contratante, assinatura, desafio, valor, moeda e período contratado.
5. Registrar cada evento/pagamento uma única vez, tolerando repetição e chegada
   fora de ordem. O retorno do navegador do checkout não comprova pagamento.
6. Liberar o desafio pelo período efetivamente pago. Pagamento pendente mantém
   o Premium pendente; falhas futuras seguem o período já pago e a política definida.
7. Processar cancelamento, estorno, contestação e renovação. Manter histórico de
   cobrança separado dos treinos. Prever reconciliação para webhooks perdidos.

## Aplicação das regras no Pulso

- Validar benefícios na API, além de mostrar os estados na interface.
- Entrada com chave: bloquear a linha do desafio na transação, conferir acesso
  e contar membros antes de inserir. Entradas simultâneas não podem ultrapassar
  5 ou 200; quem já participa não deve consumir uma nova vaga.
- Registro global: continuar salvando um único treino e contabilizar somente nos
  desafios elegíveis da mesma modalidade, no período, com acesso ativo.
- Cardio exige participação em um desafio de cardio com Premium ativo.
- Musculação continua com um único check-in diário por pessoa, incluindo a
  possibilidade de substituir; regras de contratação não duplicam registros.
- Preservar o histórico de desafios bloqueados. Sair e excluir continuam
  disponíveis. Excluir um desafio não deve deixar renovação de cobrança esquecida:
  coordenar cancelamento da assinatura e exclusão, com confirmação clara.
- Exibir status, período pago, quantidade de membros, limite e botão de assinatura
  no desafio, com ação de cobrança exclusiva do administrador.

## Implementação e ativação

A integração está implementada e protegida por `BILLING_ENABLED=false` no Worker.
Enquanto essa variável estiver falsa, o aplicativo preserva o comportamento
anterior e não oferece checkout nem impõe os limites comerciais. Ativar checkout
e restrições em conjunto somente depois dos pré-requisitos abaixo.

- `lib/billing/plans.ts`: preços fixos em centavos e limites por desafio.
- `lib/billing/asaas.ts`: checkout hospedado recorrente no cartão, consulta
  canônica de cobranças/assinaturas e cancelamento.
- `lib/billing/store.ts`: contratos, períodos efetivamente pagos, reconciliação,
  cancelamento e processamento durável/idempotente de eventos.
- `/api/billing`: contratação exclusiva do administrador, preço no servidor,
  proteção de origem, conferência de pagamento e cancelamento.
- `/api/billing/webhook`: autenticação por `asaas-access-token`, confirmação
  canônica no Asaas e nova tentativa em caso de falha de processamento.
- `components/premium-panel.tsx`: mensal/anual, preço, renovação, período pago,
  limite, pagamento pendente e cancelamento; compatível com os dois temas.
- `20261008_billing.sql`: migração aditiva com políticas privadas para `cardio_app`.
- `record_challenge`: destinos elegíveis de cada publicação; um treino feito
  enquanto o desafio está bloqueado não passa a pontuar retroativamente após
  pagar. Registros legados foram preservados. As datas do desafio continuam
  delimitando o ranking. Novos registros exigem participação e elegibilidade
  do desafio no momento da publicação. Um único registro atende a vários destinos.

Entradas simultâneas bloqueiam a linha do desafio e respeitam 5/200 pessoas,
incluindo o administrador. Quem já participa pode repetir a entrada sem consumir
vaga. Cancelamento/exclusão e criação da contratação compartilham bloqueios para
não deixar uma renovação esquecida. O cancelamento mantém os períodos pagos;
estorno, contestação ou exclusão da cobrança revogam o período correspondente.

Períodos usam a data de vencimento canônica da fatura no calendário de Brasília;
o fim de mês é limitado ao último dia válido. Pagamentos futuros não concedem
acesso antes do período contratado. Um retorno de checkout nunca libera Premium.
Uma resposta ambígua ao criar checkout mantém a reserva durável e exige suporte,
em vez de abrir outra assinatura silenciosamente. A página permite reconciliação
manual pelo administrador para eventos perdidos. Não armazenar dados de cartão
nem o corpo completo dos webhooks no aplicativo.

### Pré-requisitos para cobrar

1. Configurar `ASAAS_API_KEY` como segredo seguro de produção e
   `ASAAS_ENVIRONMENT=production` como variável sem segredo; conferir autenticação.
2. Regularizar o cadastro comercial/bancário/documental no Asaas e confirmar
   habilitação do checkout recorrente. Na consulta inicial de 08/10/2026,
   `commercialInfo=APPROVED`, `bankAccountInfo=PENDING`,
   `documentation=REJECTED`, `general=PENDING`; isso pode mudar após a revisão.
3. Gerar um token forte e independente para `ASAAS_WEBHOOK_TOKEN`, cadastrá-lo
   como segredo no Worker e no webhook Asaas. Endpoint:
   `https://cardio.renatoqsousam.workers.dev/api/billing/webhook`.
4. Cadastrar webhook API v3, `enabled=true`, `interrupted=false`,
   `sendType=SEQUENTIALLY`, incluindo checkout, assinatura, confirmação/recebimento,
   estorno, contestação e exclusão de pagamentos. Validar entrega autenticada.
5. Validar primeiro no sandbox: checkout real, primeiro pagamento, renovação,
   falha, cancelamento e estorno. Os testes atuais simulam o provedor; não
   demonstram liquidação nem renovação real de cartão. Não cobrar alguém apenas
   para testar. Uma chave de produção não serve no sandbox.
6. Comunicar a transição aos desafios existentes e publicar
   `BILLING_ENABLED=true` junto do checkout funcional. Continuar preservando
   o histórico; cardio e grupos de musculação acima de 5 ficam para consulta
   até contratar. Convidados nunca precisam de assinatura própria.

Na sessão de configuração, a chave válida foi encontrada no campo errado
`ASAAS_ENVIRONMENT` e autenticou uma consulta somente de leitura. O binding
`ASAAS_API_KEY` retornou 401; a correção comunicada pelo proprietário ainda não
foi observada no processo desta sessão. Uma saída de diagnóstico mostrou
indevidamente o valor do campo errado; substituir essa chave antes de ativar a
cobrança. Não guardar nem versionar os valores das credenciais.

### Publicação preparada

Migração aplicada ao Supabase e Worker publicado com cobrança desativada:
versão `06a2ad8f-663e-4692-b8fb-6898007e7abe`, em 08/10/2026.
A verificação pública confirmou página 200, API anônima 401, login/cadastro,
criação e exclusão de desafio, acesso anterior preservado e checkout desativado
com 503. Somente os dados criados pela verificação foram removidos.
O build do Worker passou; os arquivos do bundle foram conferidos para não
conter os valores das credenciais locais. A autenticação inicial do Asaas foi
somente de leitura. Nenhuma cobrança real foi criada ou realizada.

### Validação executada

- `node scripts/test-billing.cjs`: 39 verificações de preços, período, acesso,
  payload, URL confiável, autenticação e privacidade de erros; provedor simulado.
- `node scripts/test-billing-lifecycle.cjs`: 17 verificações em PostgreSQL local,
  incluindo repetição concorrente, eventos fora de ordem, valor incorreto,
  vencimento futuro, estorno, exclusão, cancelamento e preservação do período;
  provedor simulado, sem cobranças reais.
- `node scripts/test-premium-gates.cjs`: 20 verificações HTTP com
  `BILLING_ENABLED=true`: última vaga simultânea em 5/200, autorização,
  webhook falso, cardio bloqueado, publicação global e histórico após expiração;
  somente banco/arquivos locais, sem chamadas reais ao provedor.
- `node scripts/smoke.cjs`: 149 verificações do aplicativo com cobrança desativada.
- Interface mobile: preços, retorno pendente, período pago, cancelamento,
  temas claro/escuro e ausência de transbordamento ou erro de navegador.

Não usar os scripts de teste contra o banco ou armazenamento de produção.
As credenciais simuladas nos testes não são credenciais reais.

Fontes verificadas:
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://docs.asaas.com/reference/criar-novo-checkout
- https://docs.asaas.com/docs/eventos-para-checkout
- https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente
- https://docs.asaas.com/reference/criar-novo-webhook
