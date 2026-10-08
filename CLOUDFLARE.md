# Publicar na Cloudflare Workers com Supabase

URL publicada: https://cardio.renatoqsousam.workers.dev

Projeto Supabase: `qysdfwnbrsllrdjrmwgl` (`cardio-proofs`). As sete tabelas
estão inicializadas com RLS; o bucket privado `cardio-proofs` aceita imagens
até 8 MB. A aplicação usa o papel PostgreSQL `cardio_app`, com acesso somente
às tabelas do app. A senha principal do projeto foi preservada.
As credenciais estão configuradas como secrets no Worker e não no repositório.

O deploy e os bindings foram confirmados pela API da Cloudflare, e upload,
download autenticado e bloqueio de acesso público foram verificados no Storage.
A conexão PostgreSQL do Worker usa Hyperdrive com cache desativado, limite de
cinco conexões à origem e TLS `verify-full`, confiando no certificado oficial
Supabase Root 2021 CA. Isso corrige a falha `TLS Handshake Failed` da conexão
direta pelo cliente do Worker. O binding `HYPERDRIVE` está em `wrangler.jsonc`.
Em 08/10/2026, 26 verificações funcionais passaram na URL pública, incluindo
cadastro, login, saída, desafios, registros, placar e acesso privado às fotos.
Os dados temporários desse teste foram removidos do banco e do Storage.

Use **Workers**, não uma publicação estática do Pages. O app possui APIs,
autenticação, PostgreSQL e fotos privadas. O repositório contém o adaptador
OpenNext e a configuração Wrangler; o nome do Worker é `cardio`.

## 1. Supabase

1. Crie um projeto. Guarde a senha do banco em um gerenciador de senhas.
2. No SQL Editor, execute `supabase/init.sql` para criar as sete tabelas.
   O script ativa RLS sem políticas públicas, impedindo acesso anônimo via
   Data API. A conexão PostgreSQL do servidor deve ter acesso às tabelas.
3. Em Storage, crie o bucket **privado** `cardio-proofs`. Permita imagens
   PNG, JPEG, GIF e WebP até 8 MB. Não crie políticas de leitura pública.
4. Em Connect, copie a conexão PostgreSQL do **Session pooler**. Configure essa
   origem no Hyperdrive com o usuário do servidor e sua senha, cache desativado
   e TLS `verify-full`. Cadastre a CA oficial disponibilizada no
   [Supabase CLI](https://github.com/supabase/cli/blob/main/apps/cli-go/internal/gen/types/templates/prod-ca-2021.crt).
   SHA-256 da CA: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
5. Guarde a URL HTTPS do projeto e a chave secreta `service_role`, usada
   somente pelo servidor para acessar Storage. Não use a chave anônima.

## 2. Cloudflare

Crie um Worker ligado ao repositório GitHub `renatoqsm/cardio`, branch `main`.
Configure a pasta raiz do projeto e Node.js 24.

- Build: `pnpm run build:cloudflare`
- Deploy: `pnpm run deploy:cloudflare`
- Instalação, se o painel pedir um comando: `pnpm install --frozen-lockfile`

O `packageManager` fixa pnpm 12.3.4. O resultado do build é `.open-next`;
Wrangler publica o Worker e seus assets. Não use um diretório estático do Pages.
Se o nome escolhido no painel for outro, ajuste `name` em `wrangler.jsonc`.
Para outra conta Cloudflare, crie sua configuração Hyperdrive e substitua o ID
em `wrangler.jsonc`. O token de configuração precisa de Conta → Hyperdrive →
Editar e Conta → SSL e Certificados → Editar, além das permissões do Worker.
O build remove os valores de arquivos `.env` copiados pelo adaptador; os
segredos devem ser configurados exclusivamente no runtime do Worker.
Next.js 16.3.8 e OpenNext 1.20.9 estão fixados e foram testados juntos.
Valide novamente o runtime ao atualizar essas versões.

Nas configurações do Worker, registre os seguintes valores **em tempo de
execução**; variáveis apenas do processo de build não são suficientes:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Fallback PostgreSQL; em produção o binding Hyperdrive tem prioridade |
| `BETTER_AUTH_SECRET` | Secret | Segredo aleatório novo, com pelo menos 32 caracteres |
| `BETTER_AUTH_URL` | Variable | URL HTTPS real do Worker, sem barra final |
| `SUPABASE_URL` | Variable | URL HTTPS do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Secret | Chave `service_role`, somente do servidor |

`STORAGE_BACKEND=supabase` e `SUPABASE_STORAGE_BUCKET=cardio-proofs` já estão
em `wrangler.jsonc`. Essas opções impedem usar disco efêmero como fallback.
Nunca colocar credenciais no GitHub, no arquivo Wrangler ou no chat. As fotos
continuam passando pelas APIs autenticadas do app; o bucket não é público.

## 3. Verificar a publicação

Abra a URL pública, cadastre uma conta, saia e entre novamente. Crie um
desafio, envie uma foto, registre um treino e confira o placar. Teste outra
conta entrando pela chave e visualizando a foto. Uma conta fora do desafio
não deve conseguir ler a imagem.

Cadastro/login passaram na conta atual, mantendo o hashing original das senhas.
Monitore o consumo de CPU e as cotas dos serviços conforme o uso crescer.
O teste funcional não é um teste de carga.

## Desenvolvimento e testes

O desenvolvimento local continua com PostgreSQL local e fotos em disco,
desde que as variáveis Supabase não estejam configuradas. `pnpm test:smoke`
testa esse fluxo. `node scripts/test-storage.cjs` testa o protocolo de Storage
contra um mock local; não verifica um projeto Supabase real.

Depois do build, `pnpm preview:cloudflare` inicia o runtime local Workers.
Use `.dev.vars` ignorado pelo Git para os valores de teste. Não publique as
credenciais de desenvolvimento. Para testar banco local nesse runtime,
use `127.0.0.1:54329` e configure
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` com a conexão local;
para fotos, use um Supabase de teste. O preview precisa de seus próprios
bindings de autenticação e Storage; as credenciais de produção não são copiadas.
