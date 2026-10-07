# Publicar na Cloudflare Workers com Supabase

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
4. Em Connect, copie a conexão PostgreSQL do **Session pooler** com SSL.
   Substitua o marcador de senha e use `sslmode=require`. Não desative TLS.
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
O build remove os valores de arquivos `.env` copiados pelo adaptador; os
segredos devem ser configurados exclusivamente no runtime do Worker.
Next.js 16.3.8 e OpenNext 1.20.9 estão fixados e foram testados juntos.
Valide novamente o runtime ao atualizar essas versões.

Nas configurações do Worker, registre os seguintes valores **em tempo de
execução**; variáveis apenas do processo de build não são suficientes:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Conexão PostgreSQL SSL do Session pooler |
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

O login usa hashing de senha e pode exceder a CPU permitida no plano gratuito
do Workers. Valide cadastro/login na conta gratuita antes de assumir que esse
plano atende ao app. Não altere a segurança das senhas para caber no limite.
Confira também o tamanho comprimido do Worker e as cotas vigentes dos serviços.
Build local aprovado não demonstra aprovação das cotas nem publicação real.

## Desenvolvimento e testes

O desenvolvimento local continua com PostgreSQL local e fotos em disco,
desde que as variáveis Supabase não estejam configuradas. `pnpm test:smoke`
testa esse fluxo. `node scripts/test-storage.cjs` testa o protocolo de Storage
contra um mock local; não verifica um projeto Supabase real.

Depois do build, `pnpm preview:cloudflare` inicia o runtime local Workers.
Use `.dev.vars` ignorado pelo Git para os valores de teste. Não publique as
credenciais de desenvolvimento. Para testar banco local nesse runtime,
use `127.0.0.1:54329`; para fotos, use um Supabase de teste.
