<!-- AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md. -->
# Publicar o Lunar Nav na Hostinger

Guia para colocar o pacote `deploy/lunarnav-deploy.zip` em **https://lunarnav.space**, numa hospedagem compartilhada da Hostinger (hPanel, PHP 8.3, LiteSpeed com `.htaccess`). O site fica na raiz do `public_html`.

Nenhuma chave está dentro do zip. As chaves só entram no passo 5, direto no servidor.

## 0. Antes de começar

- **Gerar o pacote no computador.** Rode `npm run build` em `frontend/` e depois `python3 -I deploy/build-zip.py` na raiz do projeto. O zip sai em `deploy/lunarnav-deploy.zip`.
- **Ter à mão:**
  - a chave da Anthropic;
  - a chave da ElevenLabs;
  - o ID da voz (`EXAVITQu4vr4xnSDxMaL`, já preenchido no exemplo).
- **Saber o usuário da conta Hostinger** (algo como `u123456789`). Ele aparece no caminho do Gerenciador de Arquivos (`/home/u123456789/...`) ou em *hPanel → Avançado → Acesso SSH*. Neste guia ele aparece como `USUARIO`.

### O que tem no zip

| Pasta | Conteúdo |
|---|---|
| raiz (`index.html`, `assets/`, `404.html`, ícones, `.htaccess`) | o build do site, com cache longo para os arquivos com hash |
| `api/` (`index.php`, `.htaccess`, `config.example.php`, `src/`) | o código PHP da API |
| `api/bin/` | `privacy-cleanup.php` e `usage.php` (manutenção, só pela linha de comando) |
| `api/data/` | locais, DSN, glossário, lista SVS, `validation.json`, referência PGDA e máscaras de horizonte (`terrain/`) |
| `api/data/cache/` | efemérides do Horizons, resultados já calculados, SVS, as respostas do Analista em cache e os áudios TTS |

**Não está no zip:**
- `config.php` e chaves;
- testes, `node_modules`, Python;
- DEMs e recortes, e a máscara de 60 m (só usada na validação);
- o roteador de desenvolvimento;
- registros de limite por IP e contadores de uso.

## 1. Versão do PHP e opções

Em **hPanel → Sites → lunarnav.space → Avançado → Configuração do PHP**:

1. **Versão do PHP:** escolha **8.3** e salve.
2. **Extensões:** confirme que estão ligadas `curl`, `mbstring` e `json` (já vêm ligadas por padrão). `pdo_mysql` só é necessária se você trocar o cache para MySQL; não é o caso.
3. **Opções do PHP:**

   | Opção | Valor | Por quê |
   |---|---|---|
   | `max_execution_time` | `150` | uma pergunta ao Analista pode fazer várias chamadas ao Claude e ao Horizons |
   | `memory_limit` | `256M` | cálculos de um ano inteiro |
   | `upload_max_filesize` | `8M` | entrada de voz (clipes de até 2 MB) |
   | `post_max_size` | `8M` | idem |
   | `display_errors` | `Off` | avisos nunca devem aparecer no meio do JSON |

O `api/index.php` também tenta aplicar `display_errors = Off` e 150 s de tempo-limite. Onde a hospedagem não deixa, vale o que estiver no hPanel.

## 2. SSL (HTTPS)

1. Em **hPanel → Segurança → SSL**, instale o certificado gratuito para `lunarnav.space` (e `www.lunarnav.space`). Espere ficar **Ativo**.
2. O `.htaccess` do pacote já força HTTPS e manda `www` para `lunarnav.space`. A opção "Forçar HTTPS" do hPanel pode ficar ligada ou desligada; as duas convivem.
3. **Só depois de o HTTPS funcionar**, siga para o upload. O pacote envia `Strict-Transport-Security` (1 ano): depois da primeira visita, os navegadores só aceitarão HTTPS neste domínio.

## 3. Pasta privada (fora do `public_html`)

No **Gerenciador de Arquivos**, vá até `/home/USUARIO/` (um nível acima de `domains/`) e crie a pasta **`lunarnav-private`**.

Ela guarda o arquivo de *salt* usado para anonimizar os IPs nos limites por hora. Fica fora do site, então nunca é servida.

## 4. Upload e extração do zip

1. No Gerenciador de Arquivos, abra `/home/USUARIO/domains/lunarnav.space/public_html/`.
2. Se houver uma página padrão da Hostinger (`default.php`, `index.php` ou `index.html` antigos), **baixe uma cópia** e apague. A pasta `.well-known/`, se existir, deve ficar.
3. Envie `lunarnav-deploy.zip` (≈ 34 MB) para `public_html`.
4. Clique com o botão direito no zip → **Extrair** → destino: `public_html` (a própria pasta, sem subpasta).
5. Ative **"Mostrar arquivos ocultos"** e confira que existem `public_html/.htaccess`, `public_html/assets/.htaccess`, `public_html/api/.htaccess`, `api/data/.htaccess`, `api/bin/.htaccess` e `api/src/.htaccess`.
6. Apague o `lunarnav-deploy.zip` de dentro do `public_html` (o `.htaccess` já bloqueia `.zip`, mas não há motivo para deixá-lo lá).

A estrutura final deve ser:

```
public_html/
  .htaccess  index.html  404.html  favicon.svg  apple-touch-icon-180.png
  assets/            (.htaccess + arquivos com hash)
  api/
    .htaccess  index.php  config.example.php  config.php (passo 5)
    bin/  src/
    data/  (cache/, pgda/, terrain/, *.json)
```

## 5. Criar o `config.php`

1. Em `public_html/api/`, copie `config.example.php` para **`config.php`** (botão direito → Copiar, e renomeie a cópia).
2. Edite `config.php` e preencha só o bloco do topo:

   ```php
   $ANTHROPIC_API_KEY  = 'sua chave da Anthropic';
   $ELEVENLABS_API_KEY = 'sua chave da ElevenLabs';
   $ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
   $IP_SALT = '';   // pode deixar vazio: o app cria o salt na pasta privada
   $PRIVATE_DIR = '/home/USUARIO/lunarnav-private';   // troque USUARIO
   ```

   - **`$IP_SALT`:** se preferir definir o valor você mesmo, gere 64 caracteres aleatórios (por SSH: `php -r 'echo bin2hex(random_bytes(32)), "\n";'`). Não reutilize o salt de outro lugar.
   - **Não mude** `'model' => 'claude-opus-5-5'`. As respostas do Analista no cache foram geradas com esse modelo; com outro, elas deixam de ser encontradas e cada pergunta vira uma chamada paga.
3. **Permissões do `config.php`:** `600` (botão direito → Permissões). Na Hostinger o PHP roda com o seu próprio usuário, então ele continua lendo o arquivo.
4. **Teste rápido:** abra `https://lunarnav.space/api/config.php`. Precisa dar **403**.

O `config.php` nunca vai para o Git nem para o zip. Se precisar trocar uma chave, edite só esse arquivo.

## 6. Permissões de escrita (cache)

O PHP precisa gravar em:

- `public_html/api/data/cache/`, para novas efemérides, novas respostas do Analista e os limites por hora;
- `public_html/api/data/cache/tts/`, para novos áudios;
- `/home/USUARIO/lunarnav-private/`, para o arquivo de salt (se `$IP_SALT` estiver vazio).

Na Hostinger, pastas com **755** e arquivos com **644** bastam, porque o PHP roda com o dono dos arquivos. Não use 777.

## 7. Manutenção: privacidade e contadores

Os scripts ficam em `api/bin/`. A web não os alcança (o `.htaccess` devolve 403); eles só rodam pela linha de comando.

**Por SSH** (planos com acesso SSH):

```bash
cd ~/domains/lunarnav.space/public_html
php api/bin/privacy-cleanup.php --scan   # apaga registros de limite com mais de 48 h e procura IPs no cache (deve dar 0)
php api/bin/usage.php 7                  # uso dos serviços pagos nos últimos 7 dias (UTC)
php api/bin/usage.php --reset            # zera os contadores de hoje (os limites diários recomeçam)
```

- Os contadores são por dia (UTC) e **recomeçam sozinhos à 0h UTC**. O `--reset` só é necessário para liberar os limites antes disso. Para outro dia, use `--reset=AAAA-MM-DD`.

**Pelo cron do hPanel** (sem SSH): em **hPanel → Avançado → Cron Jobs**, crie:

| Comando | Quando |
|---|---|
| `/usr/bin/php /home/USUARIO/domains/lunarnav.space/public_html/api/bin/privacy-cleanup.php` | a cada hora |

- Se o hPanel oferecer o tipo de comando **"PHP"**, escolha-o e informe só o caminho do script.
- Para zerar os contadores sem SSH, crie um cron de uma vez com `.../api/bin/usage.php --reset` e apague-o depois de rodar.
- A saída do cron fica no registro do próprio hPanel.

## 8. Checklist de teste

**Telas (8):**
- [ ] Briefing (`/`) abre, com as imagens da NASA SVS.
- [ ] Explorador (`/#/planner`): mapa polar, leituras de A e B, energia, linha do tempo.
- [ ] Comparar (`/#/compare`): gráficos, tabela, busca de datas, mapa de sensibilidade.
- [ ] Vista do céu (`/#/sky`): panorama e **3D** (botão "Relevo 3D"; o relevo aparece e gira).
- [ ] Gráficos (`/#/charts`): os seis gráficos e suas tabelas.
- [ ] Analista (`/#/analyst`): uma pergunta sugerida responde na hora (vem do cache, selo "em cache").
- [ ] Relatório (`/#/report`): exportar JSON, CSV e Markdown; imprimir.
- [ ] Metodologia (`/#/methodology`): tabela de validação (19 checagens, incluindo a do DEM de 60 m) e a tabela PGDA.

**Idiomas e tema:**
- [ ] Primeira visita (aba anônima) abre em **inglês**, mesmo num navegador em português.
- [ ] `https://lunarnav.space/?lang=pt` abre em português e a escolha fica salva (o `?lang=` some da barra de endereço).
- [ ] EN, ES e PT no topo: textos, números com vírgula em PT/ES e nomes dos locais traduzidos; a escolha continua depois de recarregar.
- [ ] Tema claro e escuro (botão do sol/lua); a escolha é lembrada.
- [ ] Técnico / Aprender: aparece o aviso curto, e as notas do Aprender aparecem no Explorador, Comparar, Vista do céu e Gráficos.

**Analista e áudio:**
- [ ] Uma pergunta **sugerida** responde sem custo (selo de cache).
- [ ] "Ouvir resumo" toca o áudio (das perguntas sugeridas, ele já está no cache).
- [ ] Uma pergunta nova responde em até cerca de 1 minuto. Se der erro de tempo-limite, aumente `max_execution_time` (passo 1).
- [ ] Entrada de voz (microfone): o navegador pede permissão e a transcrição aparece.

**Segurança e erros:**
- [ ] `http://lunarnav.space` e `https://www.lunarnav.space` redirecionam (301) para `https://lunarnav.space/`.
- [ ] `https://lunarnav.space/nao-existe.js` → **404** com a página "Page not found".
- [ ] `https://lunarnav.space/qualquer-rota` (sem extensão) → abre o app (fallback do SPA).
- [ ] `https://lunarnav.space/api/` → **404** em JSON (`No route for GET /`), sem listagem de pasta.
- [ ] **403** em cada um destes: `/api/config.php`, `/api/config.example.php`, `/api/data/validation.json`, `/api/data/cache/`, `/api/bin/usage.php`, `/api/src/bootstrap.php`, `/.htaccess`, `/api/.htaccess`.
- [ ] `https://lunarnav.space/api/health` → `{"ok":true,…,"providers":{"claude":true},"voice":{"tts":true,"stt":true}}`. Esse endpoint mostra só se cada serviço está ativo, nunca as chaves.
- [ ] Nas ferramentas do navegador (F12 → Console), nenhum erro de "Content Security Policy" em nenhuma tela.
- [ ] Depois de algumas perguntas, `php api/bin/privacy-cleanup.php --scan` informa **0** arquivos com texto parecido com IP.

## 9. Atualizar depois

- **Só o site:** gere um novo zip e envie apenas `index.html`, `404.html`, `.htaccess` e `assets/`. Os arquivos antigos de `assets/` podem ser apagados.
- **Não sobrescreva** `api/config.php` nem `api/data/cache/`, que guarda o que o servidor já calculou e as respostas novas.
- **CDN da Hostinger:** se estiver ativa, limpe o cache dela depois de cada atualização (*hPanel → Desempenho → CDN → Limpar cache*).

## Verificado para hospedagem compartilhada

- **Nada de `exec`, `shell_exec`, `proc_open` etc.** O PHP só usa as extensões `curl`, `mbstring` e `json`.
- **Gravação só em lugares permitidos:** `api/data/cache/` e a pasta privada. Com `open_basedir`, um caminho fora das pastas permitidas falha em silêncio e não suja o JSON.
- **Conexões de saída por HTTPS:** `api.anthropic.com`, `api.elevenlabs.io`, `ssd.jpl.nasa.gov` (Horizons) e `svs.gsfc.nasa.gov`. A Hostinger permite.
- **Teste local:** o pacote foi testado num Apache 2.4 com PHP 8.3 e HTTPS:
  - redirecionamentos, bloqueios (403), 404, fallback do SPA, cabeçalhos de segurança e cache;
  - as 10 rotas nas 3 línguas, sem nenhuma violação de CSP, incluindo o 3D (worker) e um áudio do cache;
  - o salt criado só na pasta privada, com permissão 600.
