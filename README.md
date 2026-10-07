# Pulso

Aplicativo de desafios de cardio com amigos, feito com Next.js, React,
Better Auth, Drizzle e PostgreSQL. Não depende de serviços da Vercel.

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
Os scripts não alteram tabelas existentes: mudanças futuras no schema precisam
de migrações próprias.

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
