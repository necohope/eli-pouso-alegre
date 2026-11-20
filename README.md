# ELI Pouso Alegre — site do Ecossistema Local de Inovação

Site do ELI Pouso Alegre, o Ecossistema Local de Inovação da cidade. HTML, CSS e JavaScript puros, sem framework e sem etapa de build. Os dados cadastrados pelos usuários ficam no Firebase (Google).

| Página | Endereço | Conteúdo |
|---|---|---|
| O ELI | `#inicio` | O que é o ELI, etapa da metodologia, os grupos, referências, próximos eventos |
| Agenda | `#agenda` | Calendário em Mês e Ano, com busca e filtros por tipo |
| Programas e Ações | `#programas` | Mapa vivo de programas, projetos, ações e serviços, cadastrados pelos atores |
| Vitrine | `#vitrine`, `#vitrine/<hélice>` | As 4 hélices e os atores ativos, com logo clicável para o site de cada instituição |
| Governança | `#governanca` | Sobre nós, visão, missão, princípios, estrutura, regras e primeiros 90 dias |
| Minha conta | `#conta`, `#conta/instituicao`, `#conta/eventos`, `#conta/programas` | Perfil da instituição, meus eventos e meus programas (criar, editar, excluir) |
| Área dos Atores | `#area`, `#area/indicadores`, `#area/documentos`, `#area/notas`, `#area/pedidos` | Restrita a membros aprovados: indicadores (KPIs das planilhas), relatórios e atas (links do Drive) e anotações |
| Painel Admin | `/admin` (link no rodapé) | Estatísticas de acesso e moderação. Demonstração: `/admin?demo` |

Idiomas: português, inglês, espanhol, francês e chinês (seletor no topo; textos em `assets/i18n/`).

## Onde está no ar

| O quê | Onde |
|---|---|
| Site público | https://eli-pouso-alegre.vercel.app (domínio próprio previsto: elipousoalegre.com.br) |
| Código | https://github.com/necohope/eli-pouso-alegre (público) |
| Hospedagem | Vercel, projeto `eli-pouso-alegre` no time Deep Tree |
| Contas e dados | Firebase, conta Google da Deep Tree Inovação (Authentication + Firestore, região São Paulo) |
| Admin | mateushope.oficial@gmail.com (lista em `config.js` > `ADMINS` e em `firestore.rules` > `isAdmin`) |

Publicação: cada `git push` na `main` publica o site pelo GitHub Actions (`.github/workflows/publicar-vercel.yml`), desde que o segredo `VERCEL_TOKEN` esteja configurado no repositório. Sem ele, a publicação é feita à mão com `vercel deploy --prod`.

## Estrutura das pastas

```
index.html                 Todas as páginas (troca por âncora)
admin.html                 Painel Admin (estatísticas e moderação)
404.html                   Página de "não encontrado"
assets/css/                styles.css (site) e admin.css (painel)
assets/js/config.js        Configuração: Firebase, Admins, fuso
assets/js/eventos.js       Tipos de evento, público-alvo e eventos curados (pesquisa)
assets/js/catalogos.js     Hélices, categorias, tipos de programa, vertentes
assets/js/i18n.js          Tradução e formatação de datas por idioma
assets/i18n/*.js           Dicionários EN, ES, FR, ZH (texto em português -> tradução)
assets/js/fb.js            Firebase: login, leitura (REST leve) e gravação
assets/js/app.js           Rotas, agenda (lista, mês, ano), PWA, estatísticas
assets/js/conta.js         Login (Google ou e-mail e senha) e Minha conta
assets/js/mapa.js          Vitrine e Programas e Ações
assets/js/area.js          Área dos Atores (restrita) e as partes públicas dela
assets/js/admin.js         Painel Admin
firestore.rules            Regras de segurança do banco (quem pode ler e gravar)
manifest.webmanifest, sw.js  App instalável (PWA)
vercel.json                Cabeçalhos de segurança e cache
apps-script/               Backend antigo em Google Planilha (não é mais usado)
```

## Ver o site no computador

No Terminal do Mac, um comando por vez:

```
cd caminho/da/pasta/eli-pouso-alegre
```

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`. Para parar, aperte Ctrl + C.

## Contas, cadastros e moderação

- Qualquer pessoa cria conta com Google ou com e-mail e senha. Contas de e-mail e senha precisam confirmar o e-mail (o Firebase envia o link) antes de publicar.
- Antes de publicar eventos e programas, o usuário completa o perfil da instituição (logo obrigatório, hélice, categoria, site, descrição). O perfil aparece na Vitrine se estiver marcado como ativo.
- Tudo publica na hora. O Admin oculta o que for indevido no Painel (moderação); o autor continua vendo o item em Minha conta.
- Cada usuário só edita e exclui o que é dele. Isso é garantido pelas regras do banco (`firestore.rules`), não só pelo site.
- O usuário pode excluir a própria conta e todos os seus dados em Minha conta (LGPD).
- Logos são reduzidos no próprio navegador (320 px, WebP) e guardados junto do perfil.

Atualizar as regras do banco: `firebase deploy --only firestore:rules --project <id do projeto>`.

## Área dos Atores (restrita)

- Quem tem conta pede acesso em `#area` (informa a instituição). O Admin aprova, recusa ou remove o acesso na aba "Pedidos de acesso". O Painel Admin mostra quantos pedidos estão aguardando.
- **Indicadores:** o Admin importa a planilha (.xlsx ou .csv exportado do Drive) pelo botão "Importar planilha". A leitura é feita no navegador, com a biblioteca SheetJS carregada só nessa hora. Cada aba vira um quadro, que pode ser mostrado como tabela ou como cartões de destaque. Para atualizar, basta importar de novo o mesmo arquivo: os quadros da mesma aba são substituídos e mantêm a configuração. Limite: 2.000 linhas e 40 colunas por aba.
- **Relatórios e atas:** ficam no Drive. O site guarda só o link e mostra uma prévia ("Ver aqui"). Para o membro ver o arquivo, ele precisa estar compartilhado com ele no Drive.
- **Anotações:** mural interno; cada membro edita as próprias anotações.
- **Público:** só o Admin marca um quadro ou documento como público. Quadros públicos aparecem em "O ELI em números" (página inicial) e documentos públicos em "Documentos públicos" (Governança). Documento público precisa estar no Drive como "qualquer pessoa com o link".
- A segurança fica nas regras do banco (`firestore.rules`): sem aprovação, nada é lido, nem por fora do site.
- Planilhas e arquivos internos para trabalhar no computador ficam na pasta `dados-privados/`, que não vai para o GitHub nem para o site.

## Estatísticas

Acessos anônimos ficam na coleção `acessos` do Firestore e só o Admin lê. Sem cookies e sem dados pessoais: página, aparelho, navegador, sistema, idioma, site de origem e ações (WhatsApp, evento aberto, salvar no calendário, inscrição, perfil aberto, visita ao site de um ator, app instalado). Visitantes são contados por um código aleatório que muda todo dia. Não são contados: aparelhos com login de Admin, prévias da Vercel, cópias locais, robôs e navegadores com "não rastrear".

## Tradução

Os textos são escritos em português no HTML e no JS. Ao mudar ou criar um texto, acrescente a tradução em `assets/i18n/en.js`, `es.js`, `fr.js` e `zh.js` (a chave é o texto exato em português). Textos montados no JS usam `t("texto com {marcador}", { marcador: valor })`. Conteúdo cadastrado por usuários fica no idioma original; marque com `data-no-i18n` o que não deve ser traduzido.

## Antes de publicar

- [ ] Grupo de Governança validou visão, missão, princípios e regras (a página marca tudo como proposta).
- [x] Decisão: o site não publica nomes de pessoas físicas, só de instituições.
- [x] Eventos reais de 2026 cadastrados em `eventos.js` (pesquisa de novembro de 2026, com link da fonte em cada evento).
- [ ] Confirmar a data do II Seminário INOVA SUL (hoje marcado como "agosto de 2027, a confirmar").
- [ ] Confirmar com o Sebrae Minas o uso da marca ELI no site.

## Editar textos e dados

- Textos das páginas: `index.html` (e as traduções em `assets/i18n/`).
- Eventos curados, tipos de evento e público-alvo: `assets/js/eventos.js`. Não use nomes de pessoas físicas.
- Hélices, categorias, tipos de programa e vertentes: `assets/js/catalogos.js`.
- Referências e organograma: `assets/js/app.js`, procure por `REFS` e `function org`.

## Créditos e licenças

Os créditos ficam no rodapé de todas as páginas ("Créditos das imagens"), não sobre as fotos. Fotos em uso (Wikimedia Commons):

- Vista aérea de Pouso Alegre (faixa da página inicial e imagem de compartilhamento): ASCOM Pouso Alegre, CC BY 4.0
- Laboratório de inovação (página inicial, imagem ilustrativa genérica): Oak Ridge National Laboratory, CC BY 2.0
- Centro de Pouso Alegre visto do alto, com a praça e a catedral (topo da Agenda): LuckMotoTrip, CC BY-SA 4.0
- Auditório em evento de tecnologia (topo de Programas e Ações, imagem ilustrativa genérica): Jorge Jaramillo, CC BY-SA 4.0
- Vista aérea do centro de Pouso Alegre (topo da Vitrine): fernando_lima, domínio público
- Centro de Pouso Alegre (2021) (topo da Governança): Madu Macedo, CC BY-SA 4.0

Fotos guardadas, fora de uso: coffee break em evento (Donatas Dabravolskas, CC BY-SA 4.0), Reitoria do IFSULDEMINAS, Theatro Municipal, Centro Cultural, Parque Zoobotânico, região central (HVL), ruas do centro (ASCOM) e a foto da Rodada de Negócios (Renan Bandana / Terra do Mandu, uso autorizado só para o site do ELI; não reutilizar sem nova autorização).

Marca ELI: Sebrae, programa Ecossistemas Locais de Inovação. Fonte Saira: SIL Open Font License 1.1 (`assets/fonts/OFL-Saira.txt`). Biblioteca Firebase (Google), carregada sob demanda de www.gstatic.com.
