/* ==========================================================
   Catálogos usados na Vitrine, em Programas e Ações e nos formulários.
   Textos em português; a tradução é feita por assets/i18n/*.js.
   ========================================================== */

// As quatro hélices da inovação (modelo da hélice quádrupla)
window.ELI_HELICES = [
  { id: "setor-produtivo", nome: "Setor Produtivo", resumo: "Empresas, comércio e indústrias", texto: "Quem transforma conhecimento em produtos, serviços, empregos e renda.", cor: "var(--coral)", icone: "fabrica" },
  { id: "academia", nome: "Academia e ICTs", resumo: "Universidades, institutos e centros de pesquisa", texto: "Quem forma pessoas e gera ciência, tecnologia e inovação.", cor: "var(--blue)", icone: "capelo" },
  { id: "setor-publico", nome: "Setor Público", resumo: "Prefeitura, Câmara, órgãos e conselhos", texto: "Quem cria políticas, regras e condições para o ecossistema crescer.", cor: "var(--sun)", icone: "predio" },
  { id: "sociedade-civil", nome: "Sociedade Civil Organizada", resumo: "Associações, entidades, Sistema S e coletivos", texto: "Quem mobiliza, conecta e representa as pessoas e os setores.", cor: "var(--mint)", icone: "pessoas" }
];

window.ELI_CATEGORIAS = {
  "setor-produtivo": ["Indústria", "Comércio", "Serviços", "Startup", "Agronegócio", "Cooperativa", "Outro"],
  "academia": ["Universidade", "Instituto federal", "Faculdade ou centro universitário", "Escola técnica", "Centro de pesquisa ou ICT", "Empresa júnior", "Outro"],
  "setor-publico": ["Prefeitura ou secretaria", "Câmara Municipal", "Órgão estadual", "Órgão federal", "Conselho", "Outro"],
  "sociedade-civil": ["Associação empresarial", "Entidade de classe", "Sistema S", "Ambiente de inovação (hub, incubadora, coworking)", "ONG ou OSCIP", "Coletivo ou comunidade", "Outro"]
};

window.ELI_TIPOS_PROGRAMA = [
  { id: "programa", nome: "Programa", cor: "var(--blue)" },
  { id: "projeto", nome: "Projeto", cor: "var(--coral)" },
  { id: "acao", nome: "Ação", cor: "var(--mint)" },
  { id: "servico", nome: "Serviço de apoio", cor: "var(--sun)" }
];

// As vertentes que a metodologia ELI observa
window.ELI_VERTENTES = [
  { id: "ambientes", nome: "Ambientes de inovação", cor: "var(--coral)" },
  { id: "programas", nome: "Programas e ações", cor: "var(--mint)" },
  { id: "ictis", nome: "ICTIs", cor: "var(--blue)" },
  { id: "politicas", nome: "Políticas públicas", cor: "var(--sun)" },
  { id: "capital", nome: "Capital", cor: "var(--peach)" },
  { id: "governanca", nome: "Governança", cor: "var(--rose)" }
];

window.ELI_STATUS_PROGRAMA = [
  { id: "ativo", nome: "Em andamento" },
  { id: "planejado", nome: "Planejado" },
  { id: "encerrado", nome: "Encerrado" }
];

window.ELI_PERIODICIDADE = ["Contínuo", "Anual", "Semestral", "Mensal", "Semanal", "Pontual"];
