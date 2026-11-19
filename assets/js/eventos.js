/* ==========================================================
   Dados iniciais da Agenda Única
   - "exemplo: true" marca eventos fictícios, só para mostrar
     como a agenda funciona. Eles aparecem com o selo "Exemplo".
   - Quando o ENDPOINT da planilha estiver configurado, os eventos
     aprovados na planilha são somados a esta lista.
   Formato de data: AAAA-MM-DD. Horário: HH:MM (24h).
   ========================================================== */

window.ELI_TIPOS = [
  { id: "evento",       nome: "Evento e encontro",        cor: "var(--coral)" },
  { id: "capacitacao",  nome: "Capacitação e oficina",    cor: "var(--mint)"  },
  { id: "edital",       nome: "Edital e chamada",         cor: "var(--sun)"   },
  { id: "programa",     nome: "Programa",                 cor: "var(--blue)"  },
  { id: "competicao",   nome: "Hackathon e competição",   cor: "var(--rose)"  },
  { id: "ecossistema",  nome: "Reunião do ecossistema",   cor: "var(--peach)" }
];

window.ELI_PUBLICOS = [
  "Estudantes", "Empreendedores", "Empresas", "Pesquisadores", "Poder público", "Comunidade"
];

window.ELI_EVENTOS = [
  {
    id: "ex-01",
    titulo: "Café com inovação: encontro aberto do ecossistema",
    tipo: "evento",
    data: "2026-12-03", hora: "08:00", horaFim: "10:00",
    local: "Local a definir, Pouso Alegre",
    formato: "presencial",
    organizador: "Exemplo",
    publicos: ["Empreendedores", "Empresas", "Comunidade"],
    gratuito: true,
    descricao: "Exemplo de evento para mostrar como a agenda funciona. Um café da manhã mensal e aberto, para quem faz inovação na cidade se conhecer.",
    exemplo: true
  },
  {
    id: "ex-02",
    titulo: "Oficina: como validar uma ideia de negócio em duas semanas",
    tipo: "capacitacao",
    data: "2026-12-03", hora: "19:00", horaFim: "22:00",
    local: "Local a definir, Pouso Alegre",
    formato: "presencial",
    organizador: "Exemplo",
    publicos: ["Estudantes", "Empreendedores"],
    gratuito: true,
    descricao: "Exemplo propositalmente marcado no mesmo dia do anterior, para mostrar o radar de datas em ação.",
    exemplo: true
  },
  {
    id: "ex-03",
    titulo: "Chamada para startups locais apresentarem soluções",
    tipo: "edital",
    data: "2026-12-14", dataFim: "2027-01-31",
    local: "Online",
    formato: "online",
    organizador: "Exemplo",
    publicos: ["Empreendedores", "Empresas"],
    gratuito: true,
    descricao: "Exemplo de edital com período de inscrição. Editais aparecem na data de abertura e mostram o prazo final.",
    exemplo: true
  },
  {
    id: "ex-04",
    titulo: "Reunião do Grupo de Governança do ELI",
    tipo: "ecossistema",
    data: "2026-12-10", hora: "18:30", horaFim: "20:00",
    local: "Local a definir, Pouso Alegre",
    formato: "hibrido",
    organizador: "Exemplo",
    publicos: ["Poder público", "Empresas", "Pesquisadores"],
    gratuito: true,
    descricao: "Exemplo de reunião interna do ecossistema. Reuniões abertas à escuta da comunidade também podem entrar na agenda.",
    exemplo: true
  },
  {
    id: "ex-05",
    titulo: "Hackathon universitário de soluções para a cidade",
    tipo: "competicao",
    data: "2027-01-22", dataFim: "2027-01-24",
    local: "Local a definir, Pouso Alegre",
    formato: "presencial",
    organizador: "Exemplo",
    publicos: ["Estudantes", "Pesquisadores", "Poder público"],
    gratuito: true,
    descricao: "Exemplo de evento de vários dias.",
    exemplo: true
  },
  {
    id: "ex-06",
    titulo: "Plenária aberta do ELI Pouso Alegre",
    tipo: "ecossistema",
    data: "2027-02-25", hora: "19:00", horaFim: "21:30",
    local: "Local a definir, Pouso Alegre",
    formato: "presencial",
    organizador: "Exemplo",
    publicos: ["Estudantes", "Empreendedores", "Empresas", "Pesquisadores", "Poder público", "Comunidade"],
    gratuito: true,
    descricao: "Exemplo da plenária trimestral proposta na governança: prestação de contas e lançamento da agenda do período.",
    exemplo: true
  },
  {
    id: "ex-07",
    titulo: "Programa de mentorias para negócios em fase inicial",
    tipo: "programa",
    data: "2027-03-08", dataFim: "2027-05-28",
    local: "Local a definir, Pouso Alegre",
    formato: "hibrido",
    organizador: "Exemplo",
    publicos: ["Empreendedores"],
    gratuito: true,
    descricao: "Exemplo de programa contínuo, com encontros ao longo de várias semanas.",
    exemplo: true
  },
  {
    id: "inova-sul-2027",
    titulo: "II Seminário INOVA SUL",
    tipo: "evento",
    data: "2027-08-01",
    dataAConfirmar: true,
    local: "UNIFEI, campus Pouso Alegre",
    formato: "presencial",
    organizador: "INOVA SUL",
    publicos: ["Estudantes", "Empreendedores", "Empresas", "Pesquisadores", "Poder público", "Comunidade"],
    gratuito: true,
    descricao: "Segunda edição do seminário de integração e promoção da inovação regional, reunindo as quatro hélices: governo, academia, empresas e sociedade. Data exata em agosto de 2027 a confirmar.",
    exemplo: false
  }
];

window.ELI_GRUPO2 = [
  { nome: "Mateus Hope", org: "NEMPA", papel: "Liderança e representante na Governança" },
  { nome: "Paulo Henrique Teodoro Junior", org: "NEMPA" },
  { nome: "Luciana Eruvio Nelles", org: "Sebrae" },
  { nome: "Paulo Sapo Neto", org: "Sebrae" },
  { nome: "Anderson Machado de Faria", org: "Sebrae" },
  { nome: "Davilo Lefol de Paiva", org: "Lefol e UNA" },
  { nome: "Telma Guerra Lefol", org: "Lefol e ACIPA Mulher" },
  { nome: "Marcelino Ribeiro Batista", org: "Simplifique" },
  { nome: "Mauro Gustavo Reis Balbino", org: "ACIPA" },
  { nome: "Rovilson Vieira", org: "Graduall" }
];
