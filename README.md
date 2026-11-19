# ELI Pouso Alegre — site do Ecossistema Local de Inovação

Versão mínima (MVP) do site do ELI Pouso Alegre, feita pelo Grupo 2 (Ambientes de Inovação e Programas e Ações).

O site tem três páginas:

| Página | Endereço | Conteúdo |
|---|---|---|
| O ELI | `#inicio` | O que é o ELI, etapa da metodologia, os três grupos, referências, próximos eventos |
| Agenda Única | `#agenda` | Lista e calendário de eventos, filtros, radar de datas, formulário de cadastro, Grupo 2 |
| Governança | `#governanca` | Sobre nós, visão, missão, princípios, estrutura, regras e primeiros 90 dias |

É um site estático: HTML, CSS e JavaScript puros, sem framework e sem etapa de build. Qualquer hospedagem gratuita serve.

## Onde está no ar

| O quê | Onde |
|---|---|
| Site público | https://eli-pouso-alegre.vercel.app |
| Código | https://github.com/necohope/eli-pouso-alegre (público) |
| Hospedagem | Vercel, projeto `eli-pouso-alegre` no time Deep Tree |
| Planilha da agenda | A definir na Etapa 4 (registrar aqui quem tem acesso) |

Cada `git push` na branch `main` publica o site sozinho, pelo GitHub Actions (`.github/workflows/publicar-vercel.yml`). O acompanhamento fica na aba **Actions** do repositório. Para isso funcionar, o repositório precisa do segredo `VERCEL_TOKEN` e das variáveis `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.

Arquivos listados em `.vercelignore` (este README, o prompt de trabalho, a pasta `.github`) ficam no repositório, mas não vão para o site.

## Estrutura das pastas

```
index.html                 Todas as páginas (troca por âncora)
assets/css/styles.css      Estilos. Cores tiradas do símbolo do ELI
assets/js/config.js        Configurações: endereço da planilha, exemplos ligados ou não
assets/js/eventos.js       Tipos de evento, eventos iniciais e membros do Grupo 2
assets/js/app.js           Comportamento do site
assets/img/                Logos do ELI e fotos de Pouso Alegre (licenças abaixo)
assets/fonts/              Fonte Saira (licença SIL Open Font License)
apps-script/Code.gs        Backend gratuito: Google Planilha + Apps Script
404.html                   Página de "não encontrado"
robots.txt, sitemap.xml    Orientação para buscadores
vercel.json                Cabeçalhos de segurança e cache na Vercel
.github/workflows/         Publicação automática a cada git push
```

As fotos têm versão `.webp` (tamanho cheio e `-800` para celular), usadas via `<picture>`. Os `.jpg` continuam como alternativa. A imagem de compartilhamento em redes sociais é `assets/img/og-eli-pouso-alegre.jpg` (1200×630).

## Ver o site no computador

No Terminal do Mac, um comando por vez:

```
cd caminho/da/pasta/eli-pouso-alegre
```

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. Para parar, aperte Ctrl + C.

## Ligar a agenda à planilha

Enquanto `ENDPOINT` estiver vazio em `assets/js/config.js`, o formulário roda em modo de demonstração e não envia nada.

1. Crie uma Planilha Google com o nome "Agenda ELI Pouso Alegre", numa conta do ELI ou de uma instituição parceira.
2. Na planilha, abra **Extensões > Apps Script**.
3. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de `apps-script/Code.gs`.
4. Salve, escolha a função `configurar` no menu de cima e clique em **Executar**. Autorize o acesso quando o Google pedir. A aba "Eventos" será criada.
5. (Opcional) Em **Configurações do projeto > Propriedades do script**, crie `EMAIL_AVISO` com o e-mail que deve ser avisado a cada novo cadastro.
6. Clique em **Implantar > Nova implantação > Tipo: App da Web**. Em "Executar como", escolha **Eu**. Em "Quem pode acessar", escolha **Qualquer pessoa**. Clique em Implantar e copie a URL que termina em `/exec`.
7. Cole essa URL em `ENDPOINT`, dentro de `assets/js/config.js`, e publique o site de novo.

Para aprovar um evento: na aba "Eventos", troque a coluna `status` de `pendente` para `aprovado`. Para recusar, use `recusado`.

Nome e e-mail de quem cadastrou ficam só na planilha. O site nunca recebe esses dados.

## Antes de publicar

- [ ] Grupo de Governança validou visão, missão, princípios e regras (a página marca tudo como proposta).
- [ ] Os membros do Grupo 2 concordaram em ter nome e instituição no site.
- [ ] `CONTATO_GRUPO2` preenchido em `assets/js/config.js`.
- [ ] Quando houver eventos reais, `MOSTRAR_EXEMPLOS: false` e remover os exemplos de `eventos.js`.
- [ ] Confirmar a data do II Seminário INOVA SUL (hoje marcado como "agosto de 2027, a confirmar").
- [ ] Confirmar com o Sebrae Minas o uso da marca ELI no site.

## Editar textos e dados

- Textos das páginas: `index.html`.
- Eventos iniciais, tipos de evento e membros do Grupo 2: `assets/js/eventos.js`.
- Referências nacionais e mundiais e o organograma: `assets/js/app.js`, procure por `REFS` e `function org`.

## Créditos e licenças

Fotos do Wikimedia Commons, usadas com atribuição:

- Vista aérea de Pouso Alegre: ASCOM Pouso Alegre, CC BY 4.0
- Reitoria do IFSULDEMINAS: Ifsuldeminas, CC BY-SA 4.0
- Theatro Municipal de Pouso Alegre: HVL, CC BY 4.0
- Centro de Pouso Alegre (2021): Madu Macedo, CC BY-SA 4.0
- Centro Cultural Cleonice Bonillo Fernandes: HVL, CC BY 4.0 (reserva, não usada nas páginas)
- Vista aérea 2: ASCOM Pouso Alegre, CC BY 4.0 (reserva)

Marca ELI: Sebrae, programa Ecossistemas Locais de Inovação. Fonte Saira: SIL Open Font License 1.1 (`assets/fonts/OFL-Saira.txt`).
