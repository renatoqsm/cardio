# Pulso

Aplicativo de desafios de cardio e musculação com amigos, feito com Next.js, React,
Better Auth, Drizzle e PostgreSQL. Não depende de serviços da Vercel.

Para publicar na Cloudflare Workers com banco e fotos no Supabase, siga
[CLOUDFLARE.md](CLOUDFLARE.md). Desenvolvimento local continua disponível.

URL publicada: https://cardio.renatoqsousam.workers.dev

## Início e navegação

Ao entrar, o Pulso abre o resumo pessoal: check-ins gerais de musculação,
tempo e distância gerais de cardio e desafios em andamento. Os totais são
calculados diretamente dos registros pessoais, sem multiplicar um treino
por seu número de desafios e incluindo o histórico preservado.

O calendário mensal mostra dias com treino, distinguindo cardio e musculação;
permite navegar entre meses e voltar ao atual. A data de referência é Brasília.
O menu lateral reúne Início, Desafios atuais (incluindo os que ainda vão começar),
Criar desafio, Desafios concluídos e entrada com chave. No celular, use o botão
de menu no topo. O botão flutuante **+** abre o registro global.

A identidade padrão usa verde/preto. A preferência de tema anterior é preservada;
a troca de tema e a instalação do aplicativo ficam no menu. Os desafios mantêm
suas abas de feed, ranking e membros. As cobranças/restrições Premium continuam
desativadas até a configuração financeira estar completa.

`node scripts/test-summary.cjs` executa 11 verificações do resumo autenticado,
totais únicos, privacidade e calendário mensal contra o ambiente local.

## Excluir registro

No próprio registro do feed, **Excluir registro** pede confirmação e permite
remover apenas treinos da conta autenticada. A exclusão remove o treino e suas
associações aos desafios na mesma transação. Feed, ranking, totais gerais e
calendário são recalculados dos registros restantes. Excluir musculação libera
novo check-in na data. Fotos eventualmente usadas no perfil/capa são preservadas.
`node scripts/test-delete-record.cjs` executa 13 verificações locais de exclusão,
autorização, pontuação em múltiplos desafios e totais pessoais.

## Compartilhar treino

No próprio registro do feed, **Compartilhar no Instagram** gera uma imagem PNG
vertical de 1080×1920 com foto, nome, data, modalidade, descrição e a marca Pulso.
Cardio inclui tempo/distância e pace quando preenchido; musculação mostra o check-in.
O processamento ocorre no navegador, usando a foto autenticada; a imagem gerada
não é publicada nem enviada automaticamente a terceiros.

**Compartilhar** abre o menu nativo do celular quando o navegador aceita arquivos;
o usuário escolhe o Instagram quando disponível. **Baixar imagem** permite salvar
e selecionar o PNG na galeria ao criar um Story. A publicação depende da ação do
usuário no Instagram. O botão aparece somente nos registros do próprio usuário.

## Perfil

No menu lateral, **Meu perfil** permite editar nome, foto, idade (anos) e peso
(kg, aceitando vírgula ou ponto). Idade e peso são opcionais e ficam em uma tabela
privada separada do nome/avatar públicos. A API retorna somente o perfil da conta
autenticada. Nome e foto são atualizados na home, no feed e no ranking.

A foto aceita câmera ou galeria (até 8 MB); mantém armazenamento privado no
Supabase. Apenas o dono e participantes de desafios compartilhados podem vê-la.
Remover a foto retorna ao avatar com iniciais, sem apagar imagens eventualmente
utilizadas em registros antigos. Apagar os campos opcionais remove idade/peso.
`node scripts/test-profile.cjs` executa 18 verificações locais de persistência,
validação, autorização e privacidade.

## Desafios e feed

Cada desafio tem modalidade (Cardio ou Musculação), capa, foto de perfil,
descrição e abas Feed, Ranking e Membros. A modalidade é escolhida na criação
e preservada ao editar. O administrador personaliza a identidade em
**Personalizar**.

**Adicionar registro** fica no botão flutuante **+**, disponível mesmo sem
participar de desafios. Primeiro você escolhe a modalidade. Cardio pede foto,
data, minutos, distância e pace/descrição opcionais; Musculação pede foto,
data e descrição opcional. O formulário mostra todos os desafios elegíveis.
Cada registro conta automaticamente em todos os desafios da mesma modalidade
em que a pessoa participa, dentro do período de cada um, incluindo início e
fim. Fora desses períodos, o registro é salvo sem alterar esses rankings.

Cardio aceita vários registros no mesmo dia, com ranking por distância,
tempo ou pace. Musculação aceita um único check-in por pessoa/data, garantido
por índice único no banco mesmo com envios simultâneos. Reenvios da mesma
publicação preservam o registro existente. Ao tentar
adicionar outro treino de musculação na mesma data, o app pergunta se você
deseja substituí-lo. Cancelar mantém o anterior; confirmar permite trocar
foto e descrição, mantendo um único check-in nos desafios. Uma alteração em
outra aba exige nova confirmação. Seu ranking usa somente o total de check-ins diários;
empates têm a mesma posição. Após o fim, o ranking mostra o vencedor ou os
líderes empatados. Feed, fotos privadas e estatísticas respeitam a modalidade.

O feed mostra cada treino com foto e pode ser filtrado para seus próprios
registros. Os membros têm busca, indicação do administrador e resumo da
participação. Os desafios e treinos antigos permanecem como Cardio.

O pace médio é ponderado pela distância, usando minutos/distância quando o
pace não foi preenchido. Registros anteriormente substituídos pela antiga
regra de um cardio por dia não podem ser recuperados automaticamente.

## Desenvolvimento local

Requisitos: Linux x64 e Node.js 22 ou superior (ambiente validado com Node 24).

```sh
bash scripts/install-local.sh
node scripts/setup-local.cjs
.local/tools/node_modules/.bin/pnpm dev:local
```

A instalação utiliza pnpm 12.3.4 e o lockfile. O script prepara PostgreSQL
17.10 em `.local/postgres`, na porta 54329, acessível apenas em 127.0.0.1.
Cria as sete tabelas do schema e gera credenciais aleatórias em `.env.local`.
Repetir o setup preserva configurações, tabelas e dados existentes.
O setup aplica as migrações SQL de `supabase/migrations` em ordem, de forma
repetível, preservando registros existentes.

O app utiliza a porta 3000. Os processos precisam ser iniciados novamente
quando o ambiente for restaurado; os arquivos e dados permanecem no disco.
Cada tarefa na nuvem já é isolada; utilize este checkout, sem criar worktrees.

## Verificação

Com o servidor ativo:

```sh
.local/tools/node_modules/.bin/pnpm typecheck
.local/tools/node_modules/.bin/pnpm test:smoke
```

O teste funcional cria contas temporárias, testa login, desafios, ranking,
upload, leitura autorizada de fotos e logout, e remove seus próprios dados.
Para validar a compilação, pare o servidor de desenvolvimento e execute
`.local/tools/node_modules/.bin/pnpm build`.

## Banco e fotos

As fotos ficam em `.data/uploads`, fora do diretório público. PNG, JPEG, GIF
e WebP são aceitos até 8 MB. A API exige login; fotos registradas são visíveis
para o autor e participantes de desafios que incluem a data do treino.
Fotos de perfil e capa do desafio são privadas e visíveis aos membros.
O banco e os uploads devem ser incluídos nos backups.

Variáveis lidas pelo app:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL |
| `BETTER_AUTH_SECRET` | Segredo da autenticação |
| `BETTER_AUTH_URL` | URL base do app e origem permitida |
| `UPLOAD_DIR` | Diretório absoluto opcional das fotos |

Nunca versionar `.env.local`, `.local` ou `.data`. Para usar PostgreSQL externo,
configure `DATABASE_URL` antes do setup; a inicialização automática do servidor
é reservada à conexão local 127.0.0.1:54329.

## Hospedagem

Este setup prepara desenvolvimento, não publica um site. Para hospedar, use
um servidor com Node.js, PostgreSQL e disco persistente para as fotos, configure
`BETTER_AUTH_URL` com a URL HTTPS real e um segredo próprio, execute o build
e inicie com `pnpm start`. Em várias instâncias, compartilhe banco e armazenamento.
Não use disco efêmero para fotos ou dados do banco.

## Câmera e gesto do dia

Novos registros de cardio e musculação usam a câmera dentro do site, sem seletor
da galeria. Permita o acesso à câmera no navegador; a captura exige HTTPS
(localhost também funciona). É possível trocar entre câmeras disponíveis e
refazer a foto. A câmera é desligada ao capturar ou fechar o formulário.

Um gesto de mão é escolhido para todos a cada dia, no horário de Brasília.
Faça o gesto fisicamente na foto. O feed mostra o gesto e a data da captura,
para os membros conferirem. A data informada do treino continua editável.
Fotos antigas permanecem visíveis sem receber indicação de gesto retroativa.

O servidor vincula a foto enviada ao autor e ao gesto vigente usando uma
assinatura com `BETTER_AUTH_SECRET`; não é necessário outro segredo. Isso
não reconhece o gesto automaticamente nem comprova que houve exercício ou
que o dispositivo usou uma câmera real. A conferência da foto é visual.

## Participação e instalação

Abaixo da apresentação do desafio, o administrador pode excluir o desafio e
os participantes podem sair dele. Ambas as ações pedem confirmação. Sair retira
a pessoa do ranking e dos membros; ela pode voltar com a chave. Excluir remove
o desafio para todos. Treinos e fotos pessoais permanecem salvos, inclusive os
registros antigos que ainda estavam vinculados diretamente ao desafio.
O administrador precisa excluir seu desafio, pois não pode abandoná-lo.

O botão **Instalar aplicativo** abre o pedido de instalação nos navegadores
compatíveis. Se o navegador não disponibilizar esse pedido, o botão mostra os
passos para instalar pelo menu do Chrome/Samsung Internet ou pelo Safari no
iPhone. O Pulso abre como aplicativo, mantém a conta e recebe as atualizações
do site. Não requer APK nem publicação em loja.

O manifesto inclui ícones normais, adaptável para Android e para a tela inicial
do iPhone. O service worker armazena somente a página pública de falta de conexão
e os ícones. Desafios, fotos privadas e respostas de autenticação não são
armazenados nesse cache. É necessário internet para acessar e publicar treinos;
não há envio de registros offline.

## Temas

O botão de lua/sol no topo alterna entre o tema claro original e o tema escuro,
com superfícies grafite e detalhes em verde neon. Também está disponível antes
do login. A preferência fica em `localStorage` (`pulso-theme`), no navegador
ou aplicativo em uso, e é aplicada antes da primeira pintura da página.
A opção inicial continua sendo o tema claro. Abas do mesmo navegador sincronizam
a alteração; se o navegador bloquear armazenamento, a troca ainda funciona
na visita atual. A tela sem conexão também respeita o tema escolhido.

### Histórico, metas e comunidade

- “Meus registros” reúne todos os treinos pessoais, com filtros de modalidade/mês,
  paginação, compartilhamento e exclusão que recalcula os totais.
- “Minhas metas” configura objetivos semanais opcionais. A home mostra apenas um
  cartão compacto; a sequência considera semanas ativas e permite dias de descanso.
- Reações e comentários pertencem ao desafio e exigem participação tanto do autor
  do treino quanto de quem interage. Autores e administradores podem remover comentários.
- Convites `/?join=CHAVE` permanecem disponíveis após o login e pedem confirmação
  para entrar. Desafios encerrados mostram vencedores/empates e geram um Story PNG.
- Publicações usam a mesma chave em confirmação e repetição. Após falha de rede, o
  cliente verifica o registro salvo antes de repetir uma única vez. Exclusões guardam
  a chave para impedir que uma repetição antiga recrie o treino.

A migração `20261013_community.sql` é aditiva e deve ser aplicada antes de publicar.
Testes locais: `node scripts/test-community.cjs` e `node scripts/test-publication.cjs`,
com o servidor iniciado para o primeiro. A cobrança continua dependente da flag
`BILLING_ENABLED`; esta atualização não a ativa.

### Certificações e notificações

O perfil reúne 40 certificações em cinco trilhas com oito níveis: Primeiro passo,
Bronze, Prata, Ouro, Platina, Diamante, Elite e Lenda. Musculação acompanha
check-ins e semanas ativas; cardio acompanha distância, tempo e sessões. Cada
nome mostra somente a medalha de maior nível de cada modalidade. Treinos fora
dos desafios também contam; datas futuras não contam e exclusões recalculam as
certificações. A galeria mostra destaques/próximos passos e permite explorar todos
os níveis por modalidade.

O app instalado pode receber Web Push após ativação explícita em “Meu perfil”.
A inscrição é por dispositivo, com preferências de cardio/musculação por conta.
Sair da conta limpa a identificação no service worker e remove a inscrição deste
aparelho. No iPhone, é necessário iOS 16.4+ e instalação pela tela inicial do Safari.

A migração `20261013_notifications.sql` cria inscrições privadas, preferências e
uma fila transacional. Um treino gera no máximo um aviso por dispositivo, mesmo
em vários desafios; substituições e repetições de publicação não geram novos
avisos. O envio ocorre após a resposta e um cron a cada minuto recupera pendências.
A entrega revalida membros e preferências. Inscrições expiradas são removidas e
falhas temporárias têm repetição limitada, com a mesma identificação de aviso.

Configure `VAPID_PUBLIC_KEY` e `VAPID_SUBJECT` como variáveis do Worker;
`VAPID_PRIVATE_KEY` e `PUSH_JOB_SECRET` são segredos exclusivos do servidor.
Preserve o par VAPID existente: trocá-lo exige nova inscrição nos dispositivos.
Não publique o segredo de assinatura nem o segredo do job. O wrapper `worker.mjs`
preserva o OpenNext e executa o cron pelo contexto normal das rotas.

Para testar localmente, use chaves VAPID de desenvolvimento e defina
`PUSH_DELIVERY_ENABLED=false` no servidor para impedir envio aos endpoints fictícios.
Execute `node scripts/test-achievements-notifications.cjs`,
`node scripts/test-push-delivery.cjs` e `node scripts/test-push-worker.cjs`.
Os testes de entrega usam transporte simulado e banco isolado; não exigem um celular.

### Site público e aplicativo instalado

`/` apresenta o Pulso para divulgação, com recursos, prévia ilustrativa, passo a
passo, instalação e dúvidas frequentes. `/app` abre o login/cadastro ou a home da
conta conectada. O site público não consulta os dados privados dos usuários.

O manifesto inicia novas instalações em `/app` e preserva a identidade `id: /`
e o escopo `/`. Instalações antigas que ainda iniciam em `/` são encaminhadas
antes da apresentação. Links antigos de convite, desafio, notificação e retorno
do checkout também redirecionam para `/app`, preservando os parâmetros. Novos
convites já apontam para `/app`; URLs de push continuam compatíveis com versões
anteriores do service worker.

Os botões “Começar agora” e “Acessar e instalar” abrem, respectivamente,
`/app?signup=1` e `/app?install=1`. O segundo mostra as instruções de instalação;
a confirmação nativa permanece dependente do navegador e da escolha do usuário.
O site tem metadados para busca e compartilhamento, enquanto `/app` usa `noindex`.
Validação local: `node scripts/test-app-entry.cjs` com o servidor iniciado.

### Domínio próprio preparado

O login aceita somente o endereço original e os hosts `www.desafiopulso.online`
e `desafiopulso.online`, além do endereço local configurado no desenvolvimento.
Better Auth resolve a base conforme o host aprovado da requisição, sem confiar
em `x-forwarded-host`. O endereço original permanece disponível para instalações
existentes. Contas e treinos usam o mesmo banco nos diferentes endereços.

Para ativar, adicione `desafiopulso.online` como zona gratuita na Cloudflare,
confira os registros DNS importados e use os dois nameservers fornecidos pela
Cloudflare nas configurações do domínio na Homehost. Após a zona ficar ativa,
associe `www.desafiopulso.online` (e, se desejado, o domínio sem www) ao Worker
`cardio` como Custom Domain. Não basta apontar um CNAME para o endereço workers.dev.

Depois de validar DNS, HTTPS e login, registre os Custom Domains em `wrangler.jsonc`
e configure `SITE_URL=https://www.desafiopulso.online` para os links canônicos e
metadados. Até essa ativação, o site mantém o endereço público já funcional.
As imagens de compartilhamento mostram o hostname em que o usuário está usando
o app. As instalações no endereço antigo continuam funcionando; a instalação
pelo domínio novo precisa ser feita nesse novo endereço.

Validação das origens: `node scripts/test-domain-addresses.cjs`.

A zona `desafiopulso.online` foi ativada na Cloudflare e os dois Custom Domains
foram associados ao Worker `cardio`. As rotas estão declaradas em `wrangler.jsonc`
para preservar as associações nas próximas publicações. `SITE_URL` define
`https://www.desafiopulso.online` como endereço canônico; o endereço workers.dev
continua disponível para instalações e sessões existentes. O acesso de rede do
ambiente de desenvolvimento precisa permitir os dois novos hosts para testes
HTTPS diretos, independentemente da configuração do DNS público.
