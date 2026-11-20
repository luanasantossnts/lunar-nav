<!-- AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md. -->
# Publicar o Lunar Nav Kids em kids.lunarnav.space (Hostinger)

O Lunar Nav Kids é um **site estático**: só HTML, JavaScript, CSS, fontes e desenhos SVG.
- Não tem PHP, banco de dados, chaves nem cache.
- Não faz nenhuma chamada de rede depois de carregar.
- Não depende do site principal: publicar ou atualizar um não mexe no outro.

## 0. Gerar o pacote (no computador)

```bash
cd kids && npm install && npm run build && cd ..
python3 -I deploy/kids/build-zip.py      # → deploy/kids/kids-deploy.zip
```

O zip contém só o conteúdo da pasta do subdomínio:
- `index.html`, `favicon.svg` e `assets/` (JavaScript, CSS e as fontes Nunito e Baloo 2);
- `.htaccess`: força HTTPS, faz o fallback do SPA, aplica a CSP estrita e os cabeçalhos de segurança;
- `assets/.htaccess`: cache longo para os arquivos com hash.

## 1. Criar o subdomínio

1. **hPanel → Domínios → Subdomínios** (em alguns painéis: *Sites → lunarnav.space → Domínios → Subdomínios*).
2. Em **Nome do subdomínio**, escreva `kids`. O domínio é `lunarnav.space`.
3. **Pasta do subdomínio:** marque a opção de pasta personalizada e use uma pasta **fora** do `public_html` do site principal, por exemplo `/domains/lunarnav.space/kids` ou a sugerida `domains/kids.lunarnav.space/public_html`.
   - **Se o painel só permitir `public_html/kids`, funciona também.** O `.htaccess` do Kids tem regras próprias e substitui as do site principal nessa pasta.
   - **Efeito colateral dessa opção:** o Kids também abrirá em `https://lunarnav.space/kids/`.
4. Clique em **Criar** e anote o caminho da pasta mostrado na lista de subdomínios.

O DNS do subdomínio é criado automaticamente quando o domínio usa os servidores de nome da Hostinger. Pode levar alguns minutos até a 1 hora para responder.

## 2. Ativar o SSL

1. **hPanel → Segurança → SSL**.
2. Escolha **kids.lunarnav.space** e clique em **Instalar** (SSL gratuito).
3. Espere o status **Ativo** antes de testar.

O `.htaccess` do pacote força HTTPS e envia `Strict-Transport-Security` (1 ano). Por isso, só envie os arquivos depois que o SSL estiver ativo.

## 3. Enviar os arquivos

1. **Gerenciador de Arquivos** → abra a pasta do subdomínio (passo 1).
2. Apague o arquivo padrão que a Hostinger cria, se existir (`default.php` ou `index.php`).
3. Envie `kids-deploy.zip` → botão direito → **Extrair** → na própria pasta, sem subpasta.
4. Ative **"Mostrar arquivos ocultos"** e confira que existem `.htaccess` e `assets/.htaccess`.
5. Apague o `kids-deploy.zip` da pasta.

Estrutura final:

```
<pasta do subdomínio>/
  .htaccess  index.html  favicon.svg
  assets/   (.htaccess, index-….js, index-….css, fontes nunito-… e baloo-2-… .woff2/.woff)
```

Permissões: pastas `755` e arquivos `644`. Nada precisa de escrita.

## 4. Checklist de teste

**Telas:**
- [ ] `https://kids.lunarnav.space` abre em **inglês** numa aba anônima.
- [ ] O mascote Lumi acena; ES e PT trocam o idioma; recarregando, o idioma escolhido continua.
- [ ] `https://kids.lunarnav.space/?lang=pt` abre em português (o `?lang=` some do endereço).
- [ ] **Missão 1:** os três locais; tocar e arrastar o tempo; o Sol some atrás das montanhas; barras de 30, 15 e 6 dias.
- [ ] **Missão 2:** a Terra sobe e desce; "Dá para ligar para casa!" muda com o tempo; cerca de 13 de 30 dias em Shackleton.
- [ ] **Missão 3:** "Passar a noite"; com "Metade do tamanho" a bateria acaba no meio da noite.
- [ ] **Quiz:** 5 perguntas; com 5 de 5 o certificado Cadete libera, e "Imprimir" mostra só o certificado na prévia de impressão.
- [ ] **Fases:** na Home, a Fase 2 aparece trancada até a Fase 1 ter estrelas nas 3 missões; "Jogar mesmo assim" abre na hora.
- [ ] **Missões 4–9:**
  - escolher 1/7 e 11/7;
  - pousar no mapa com as setas + Enter e também tocando;
  - deslizar os meses;
  - escolher um ponto no gelo;
  - trocar o céu Apollo 11 / Shackleton;
  - montar um plano com 3 estrelas (Mons Mouton, 11 de julho, bateria grande).
- [ ] **Progresso:** recarregue a página e as estrelas continuam; "Apagar progresso" (rodapé) zera tudo.
- [ ] No celular e no tablet: sem rolagem para os lados, botões fáceis de tocar.

**Segurança e privacidade:**
- [ ] `http://kids.lunarnav.space` redireciona (301) para `https://`.
- [ ] F12 → **Console**: nenhum erro, incluindo "Content Security Policy".
- [ ] F12 → **Rede**: todas as requisições são para `kids.lunarnav.space`, nenhuma para fora.
- [ ] F12 → **Aplicativo → Cookies**: nenhum cookie. **Armazenamento local**: só `lunarnav.lang` e `lunarnav.kids.progress` (estrelas e quiz, nada pessoal).
- [ ] `https://kids.lunarnav.space/.htaccess` → **403**.
- [ ] `https://kids.lunarnav.space/qualquer-coisa` (sem extensão) abre o site; `https://kids.lunarnav.space/nao-existe.js` → **404**.
- [ ] O rodapé mostra "Independent project, not endorsed by NASA", "Built on NASA/JPL Horizons and NASA LOLA data" e o link "For grown-ups: lunarnav.space".

## 5. Atualizar depois

Gere um zip novo. Envie `index.html` e os arquivos novos de `assets/`, depois apague os antigos de `assets/`. Se a CDN da Hostinger estiver ativa para o subdomínio, limpe o cache dela.

## Verificado antes de entregar

O pacote foi testado num Apache 2.4 com HTTPS:
- **Redirecionamento e bloqueios:** HTTP → HTTPS, `.htaccess` com 403 e fallback do SPA funcionando.
- **Navegador:** as seis telas nas três línguas carregaram com a CSP estrita, **sem violações**, sem erros no console e **sem requisições externas**.
