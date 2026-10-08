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

## Pré-requisitos pendentes

A conta de produção foi criada. Ainda é necessário salvar a chave da API no
campo seguro `ASAAS_API_KEY`, publicar a configuração e validar o cadastro
comercial, as taxas e os métodos disponíveis. `ASAAS_ENVIRONMENT=production`
foi preparado como variável de ambiente não secreta. Os destinos do Asaas foram
adicionados à rede, preservando os destinos anteriores.

A documentação oficial foi consultada após a configuração da rede. O checkout
recorrente usa `POST /v3/checkouts`, `billingTypes=[CREDIT_CARD]`,
`chargeTypes=[RECURRENT]` e `subscription.cycle=MONTHLY` ou `YEARLY`. A URL de
retorno não comprova pagamento. Checkout, assinatura e cada cobrança recorrente
têm eventos distintos; a implementação completa precisa acompanhar os três.

Fontes verificadas:
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://docs.asaas.com/reference/criar-novo-checkout
- https://docs.asaas.com/docs/eventos-para-checkout
- https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente

A base em `lib/billing` define preços, períodos pagos e limites, e implementa o
cliente de checkout recorrente do Asaas. `node scripts/test-billing.cjs` valida
25 casos com respostas simuladas, sem chamadas reais ao provedor. Ela ainda não
está ligada aos controles do aplicativo, à persistência de assinaturas ou aos
webhooks; não foi publicada uma restrição sem checkout funcional.

Configurar credenciais somente em configurações seguras, sem versioná-las:
`ASAAS_API_KEY`, ambiente de testes/produção e token de autenticação dos webhooks.
Não reutilizar chave de testes em produção. Validar primeiro no ambiente de testes:
primeiro pagamento, renovação, falha, cancelamento, webhook repetido, concorrência
na última vaga e preservação dos dados existentes. Depois habilitar a cobrança
real e as restrições em conjunto.
