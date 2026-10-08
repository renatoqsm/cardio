# Pulso

Aplicativo de desafios de cardio e musculação com amigos, feito com Next.js, React,
Better Auth, Drizzle e PostgreSQL. Não depende de serviços da Vercel.

Para publicar na Cloudflare Workers com banco e fotos no Supabase, siga
[CLOUDFLARE.md](CLOUDFLARE.md). Desenvolvimento local continua disponível.

URL publicada: https://cardio.renatoqsousam.workers.dev

## Desafios e feed

Cada desafio tem modalidade (Cardio ou Musculação), capa, foto de perfil,
descrição e abas Feed, Ranking e Membros. A modalidade é escolhida na criação
e preservada ao editar. O administrador personaliza a identidade em
**Personalizar**.

**Adicionar registro** fica na navegação global, disponível mesmo sem
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
