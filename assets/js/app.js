/* ==========================================================
   ELI Pouso Alegre — comportamento do site
   Sem dependências de build. Rotas por âncora: #inicio, #agenda, #programas, #vitrine, #governanca, #conta
   ========================================================== */
(function () {
  "use strict";

  var CFG = window.ELI_CONFIG || {};
  var TIPOS = window.ELI_TIPOS || [];
  var PUBLICOS = window.ELI_PUBLICOS || [];
  var INSTITUICOES = window.ELI_INSTITUICOES_GRUPO2 || [];
  var BASE = (window.ELI_EVENTOS || []).slice();
  var remote = [];
  var previews = [];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var I = window.ELI_I18N;
  function t(pt, p) { return I ? I.t(pt, p) : pt; }
  function mesNome(i) { return I.mes(i, "long"); }
  function mesCurto(i) { return I.mes(i, "short").replace(".", ""); }
  function diaCurto(i) { return I.diaSemana(i, "short").replace(".", ""); }
  function mesTitulo(y, m) { return cap1(I.mesAno(new Date(y, m, 15))); }
  function hhmm(h) { return I.lang() === "pt" ? h.replace(":", "h") : h; }

  function safeUrl(u) { return typeof u === "string" && /^https?:\/\//i.test(u); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseD(s) { if (!s) return null; var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function tipo(id) { for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].id === id) return { id: id, nome: t(TIPOS[i].nome), cor: TIPOS[i].cor }; return { id: id, nome: id, cor: "var(--ink)" }; }
  function fmtLong(d) { return I.dataLonga(d); }
  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmtShort(d) { return I.dataCurta(d); }
  var FORMATOS_PT = { presencial: "Presencial", online: "Online", hibrido: "Híbrido" };
  function formato(f) { return t(FORMATOS_PT[f || "presencial"] || FORMATOS_PT.presencial); }
  function horario(e) { return e.hora ? hhmm(e.hora) + (e.horaFim ? " " + t("às") + " " + hhmm(e.horaFim) : "") : ""; }
  // Editais e programas duram semanas: não contam como "choque de data".
  var LONGOS = { edital: 1, programa: 1 };

  function allEvents() {
    var list = BASE.concat(remote);
    if (!CFG.MOSTRAR_EXEMPLOS) list = list.filter(function (e) { return !e.exemplo; });
    var seen = {};
    return list.filter(function (e) { if (seen[e.id]) return false; seen[e.id] = 1; return true; })
      .sort(function (a, b) { return (a.data + (a.hora || "")).localeCompare(b.data + (b.hora || "")); });
  }
  function endOf(e) {
    // "Data a confirmar" vale pelo mês inteiro: só vira "realizado" depois que o mês acaba.
    if (e.dataAConfirmar && !e.dataFim) { var d = parseD(e.data); return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
    return parseD(e.dataFim || e.data);
  }
  function upcoming(list) { var t = today(); return list.filter(function (e) { return endOf(e) >= t; }); }
  function daysCovered(e) {
    var out = [], d = parseD(e.data), end = endOf(e);
    if (LONGOS[e.tipo] || e.dataAConfirmar) return [iso(d)];
    while (d <= end && out.length < 31) { out.push(iso(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    return out;
  }
  function clashMap(list) {
    var m = {};
    list.forEach(function (e) {
      if (LONGOS[e.tipo] || e.dataAConfirmar) return;
      daysCovered(e).forEach(function (k) { (m[k] = m[k] || []).push(e); });
    });
    return m;
  }

  /* ---------------- rotas ---------------- */
  // #vitrine/academia, #conta/eventos etc.: a parte depois da barra fica em "sub".
  var VIEWS = ["inicio", "agenda", "programas", "vitrine", "governanca", "conta"];
  var TITULOS = { inicio: "ELI Pouso Alegre — Ecossistema Local de Inovação", agenda: "Agenda Única da Inovação — ELI Pouso Alegre", programas: "Programas e Ações — ELI Pouso Alegre", vitrine: "Vitrine do Ecossistema — ELI Pouso Alegre", governanca: "Governança — ELI Pouso Alegre", conta: "Minha conta — ELI Pouso Alegre" };
  var rotaAtual = { view: "", sub: [] };
  function route() {
    var partes = (location.hash || "").replace("#", "").split("/");
    var h = partes[0], sub = partes.slice(1).filter(Boolean);
    if (VIEWS.indexOf(h) === -1) h = "inicio";
    var trocou = h !== rotaAtual.view;
    rotaAtual = { view: h, sub: sub };
    $$("[data-view]").forEach(function (v) { v.hidden = v.getAttribute("data-view") !== h; });
    $$("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = t(TITULOS[h]);
    if (trocou || sub.length) hit("pagina", h + (sub[0] && h === "vitrine" ? "/" + sub[0] : ""));
    closeMenu(); fecharPops();
    document.dispatchEvent(new CustomEvent("eli:rota", { detail: rotaAtual }));
    if (trocou || h === "vitrine") window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* menus suspensos (idioma e conta) */
  function fecharPops(exceto) {
    $$("[data-pop-menu]").forEach(function (m) {
      if (m === exceto) return;
      m.hidden = true;
      var b = m.parentElement && m.parentElement.querySelector("[data-pop-btn]"); if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-pop-btn]");
    if (b) {
      var m = b.parentElement.querySelector("[data-pop-menu]"), abrir = m.hidden;
      fecharPops(m); m.hidden = !abrir; b.setAttribute("aria-expanded", String(abrir));
      if (abrir) { var f = m.querySelector("a, button"); if (f) f.focus(); }
      return;
    }
    if (!ev.target.closest("[data-pop-menu]") || ev.target.closest("a, button")) fecharPops();
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") fecharPops(); });

  /* menu lateral (gaveta) */
  var gaveta = $("[data-gaveta]"), menuBtn = $("[data-abrir-gaveta]");
  function closeMenu() { if (gaveta && gaveta.open) { gaveta.close(); } }
  function abrirGaveta() { if (!gaveta.open) { if (gaveta.showModal) gaveta.showModal(); else gaveta.setAttribute("open", ""); menuBtn.setAttribute("aria-expanded", "true"); } }
  menuBtn.addEventListener("click", abrirGaveta);
  gaveta.addEventListener("close", function () { menuBtn.setAttribute("aria-expanded", "false"); });
  gaveta.addEventListener("click", function (ev) {
    if (ev.target === gaveta || ev.target.closest("[data-fechar-gaveta]") || ev.target.closest("a[href^='#'], [data-acao], [data-entrar], [data-sair], [data-lang-set]")) closeMenu();
  });

  /* ---------------- rede do hero ---------------- */
  function network() {
    var svg = $("#network"); if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var cx = 320, cy = 280, R = 262;
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var palette = ["var(--coral)", "var(--mint)", "var(--sun)", "var(--blue)", "var(--rose)", "var(--peach)", "var(--ink)", "var(--mint)", "var(--sun)"];

    var hubs = [
      { x: 205, y: 150, label: "Universidades", c: "var(--blue)", txt: "Universidades e institutos formam gente e geram conhecimento. São o Grupo 3 do ELI." },
      { x: 420, y: 120, label: "Startups", c: "var(--coral)", txt: "Startups transformam conhecimento em negócio. Precisam de ambientes, mentores e capital." },
      { x: 505, y: 300, label: "Empresas", c: "var(--peach)", txt: "Empresas trazem problemas reais, mercado e investimento. Inovação aberta começa aqui." },
      { x: 395, y: 450, label: "Setor público", c: "var(--sun)", txt: "Prefeitura e Câmara criam políticas, conselhos e fundos. Tema do Grupo 1." },
      { x: 175, y: 420, label: "Ambientes", c: "var(--mint)", txt: "Incubadoras, coworkings e espaços maker são onde as conexões acontecem. Tema do Grupo 2." },
      { x: 110, y: 270, label: "Associações", c: "var(--rose)", txt: "Associações e entidades mobilizam o setor produtivo e dão escala às ações." },
      { x: 320, y: 285, label: "Investidores", c: "var(--ink)", txt: "Anjos, fundos e editais de fomento colocam combustível nas boas ideias." }
    ];
    var pts = hubs.map(function (h) { return { x: h.x, y: h.y, r: 19, c: h.c, hub: h }; });
    var tries = 0;
    while (pts.length < 72 && tries < 8000) {
      tries++;
      var a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
      var r = 5 + rnd() * 9;
      var ok = pts.every(function (p) { var dx = p.x - x, dy = p.y - y; return Math.sqrt(dx * dx + dy * dy) > p.r + r + 10; });
      if (ok) pts.push({ x: x, y: y, r: r, c: palette[Math.floor(rnd() * palette.length)] });
    }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
    var edges = [], key = {};
    function link(i, j) { var k = i < j ? i + "-" + j : j + "-" + i; if (i === j || key[k]) return; key[k] = 1; edges.push([i, j]); }
    pts.forEach(function (p, i) {
      var near = pts.map(function (q, j) { return { j: j, d: dist(p, q) }; }).sort(function (a, b) { return a.d - b.d; });
      var n = p.hub ? 6 : 2;
      for (var k = 1; k <= n; k++) link(i, near[k].j);
    });
    for (var i = 0; i < hubs.length; i++) for (var j = i + 1; j < hubs.length; j++) if ((i + j) % 2 === 0 || j === hubs.length - 1) link(i, j);

    var gE = document.createElementNS(NS, "g"), gN = document.createElementNS(NS, "g"), gL = document.createElementNS(NS, "g");
    svg.appendChild(gE); svg.appendChild(gN); svg.appendChild(gL);
    var edgeEls = edges.map(function (e) {
      var a = pts[e[0]], b = pts[e[1]], l = document.createElementNS(NS, "line");
      l.setAttribute("x1", a.x.toFixed(1)); l.setAttribute("y1", a.y.toFixed(1));
      l.setAttribute("x2", b.x.toFixed(1)); l.setAttribute("y2", b.y.toFixed(1));
      l.setAttribute("class", "net-edge");
      if (!reduceMotion) {
        var len = Math.ceil(dist(a, b));
        l.style.setProperty("--len", len); l.style.setProperty("--d", (0.5 + dist({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, { x: cx, y: cy }) / 260).toFixed(2) + "s");
        l.classList.add("is-draw");
      }
      gE.appendChild(l); return l;
    });
    var nodeEls = pts.map(function (p, i) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "net-node" + (p.hub ? " net-hub" : ""));
      if (!reduceMotion) { g.classList.add("is-pop"); g.style.setProperty("--d", (dist(p, { x: cx, y: cy }) / 420).toFixed(2) + "s"); }
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", p.x.toFixed(1)); c.setAttribute("cy", p.y.toFixed(1)); c.setAttribute("r", p.r.toFixed(1));
      c.setAttribute("fill", p.c);
      if (p.hub) {
        c.setAttribute("class", "ring"); c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", "4");
        g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", t(p.hub.label) + ": " + t(p.hub.txt)); g.setAttribute("data-no-i18n", "");
        var tx = document.createElementNS(NS, "text");
        var right = p.x < cx - 40, left = p.x > cx + 60;
        tx.setAttribute("x", (p.x + (right ? -26 : left ? 26 : 0)).toFixed(1));
        tx.setAttribute("y", (p.y + (p.y < cy - 60 ? -28 : 40)).toFixed(1));
        tx.setAttribute("text-anchor", right ? "end" : left ? "start" : "middle");
        tx.setAttribute("class", "net-label");
        tx.textContent = p.hub.label;
        gL.appendChild(tx);
        p.labelEl = tx;
      }
      g.appendChild(c); gN.appendChild(g); return g;
    });
    var cap = $("#net-caption");
    var toque = window.matchMedia && window.matchMedia("(hover: none)").matches;
    function capPadrao() { return t(toque ? "Cada ponto é um ator. Cada linha, uma conexão. Toque nos pontos maiores." : "Cada ponto é um ator. Cada linha, uma conexão. Passe o mouse sobre os pontos maiores."); }
    cap.setAttribute("data-no-i18n", "");
    cap.textContent = capPadrao();
    if (I) I.aoMudar(function () {
      cap.textContent = capPadrao();
      pts.forEach(function (p, i) { if (p.hub) nodeEls[i].setAttribute("aria-label", t(p.hub.label) + ": " + t(p.hub.txt)); });
    });
    function hot(i) {
      svg.classList.add("net-dim");
      nodeEls[i].classList.add("is-hot");
      edges.forEach(function (e, k) {
        if (e[0] === i || e[1] === i) { edgeEls[k].classList.add("is-hot"); nodeEls[e[0]].classList.add("is-hot"); nodeEls[e[1]].classList.add("is-hot"); }
      });
      cap.textContent = t(pts[i].hub.txt);
    }
    function cool() {
      svg.classList.remove("net-dim");
      $$(".is-hot", svg).forEach(function (el) { el.classList.remove("is-hot"); });
      cap.textContent = capPadrao();
    }
    pts.forEach(function (p, i) {
      if (!p.hub) return;
      var el = nodeEls[i];
      el.addEventListener("mouseenter", function () { hot(i); });
      el.addEventListener("mouseleave", cool);
      el.addEventListener("focus", function () { hot(i); });
      el.addEventListener("blur", cool);
      el.addEventListener("click", function () { cool(); hot(i); });
    });
  }

  /* ---------------- organograma ---------------- */
  function org() {
    var html =
      '<div class="org__top">' +
        '<div class="org__gov"><h3>Grupo de Governança</h3><p>Um representante de cada grupo de trabalho. Define prioridades, aprova o plano e acompanha a execução.</p></div>' +
        '<div class="org__sebrae"><strong>Consultoria Sebrae Minas</strong><span>Conduz a metodologia ELI: diagnóstico, maturidade e plano de intervenção.</span></div>' +
      '</div>' +
      '<div class="org__groups">' +
        '<article class="org__group" style="--c:var(--sun)"><span class="org__num">Grupo 1</span><h3>Políticas Públicas e Capital</h3><ul><li>Políticas públicas</li><li>Capital</li></ul><p>Leis, conselhos e fundos municipais, investidores, crédito e fomento.</p></article>' +
        '<article class="org__group is-ours" style="--c:var(--coral)"><span class="org__num">Grupo 2</span><h3>Ambientes de Inovação e Programas e Ações</h3><ul><li>Ambientes de inovação</li><li>Programas e ações</li></ul><p>Espaços onde a inovação acontece e as atividades que movimentam a rede.</p></article>' +
        '<article class="org__group" style="--c:var(--blue)"><span class="org__num">Grupo 3</span><h3>ICTIs</h3><ul><li>Instituições de ciência, tecnologia e inovação</li></ul><p>Universidades, institutos federais e centros de pesquisa.</p></article>' +
      '</div>';
    $$("[data-org]").forEach(function (el) { el.innerHTML = html; });
  }

  /* ---------------- referências ---------------- */
  var REFS = {
    br: [
      { p: "Pato Branco e Sudoeste do Paraná", w: "O ELI local organizou cada iniciativa com responsável, quem envolver, prazo e indicador. A região se articula num Sistema Regional de Inovação com cidades vizinhas.", t: "Toda ação tem um guardião.", c: "var(--coral)" },
      { p: "Maringá (PR)", w: "O Conselho de Desenvolvimento Econômico (CODEM) nasceu de um movimento da sociedade civil em 1996 e conduz planos de longo prazo, como o Masterplan 2047, com plenário e câmaras técnicas.", t: "Governança que atravessa gestões.", c: "var(--sun)" },
      { p: "Blumenau (SC)", w: "A Blusoft atua como entidade de governança do polo de tecnologia e realiza mais de 50 eventos por ano. O OktoberTech reúne um mês inteiro de programação num cronograma único.", t: "Alguém precisa operar a agenda.", c: "var(--mint)" },
      { p: "Santa Rita do Sapucaí (MG)", w: "O Vale da Eletrônica, aqui ao lado, reúne mais de 340 empresas de tecnologia. Dezenas nasceram na incubadora do Inatel, e o HackTown virou vitrine nacional.", t: "Cultura se constrói com décadas de constância.", c: "var(--blue)" }
    ],
    mundo: [
      { p: "Medellín, Colômbia", w: "A Ruta N, criada em 2009, é o centro de inovação e negócios da cidade e articula universidade, empresa e Estado como política de longo prazo.", t: "Um endereço claro para a inovação.", c: "var(--peach)" },
      { p: "Cambridge, Estados Unidos", w: "O Venture Café promove o Thursday Gathering: um encontro semanal, gratuito e aberto, onde empreendedores, pesquisadores e investidores se cruzam.", t: "Ritmo vence evento isolado.", c: "var(--rose)" },
      { p: "Boulder, Estados Unidos", w: "A Tese de Boulder resume quatro princípios: empreendedores na liderança, compromisso de longo prazo, portas abertas a todos e atividades contínuas que envolvam toda a comunidade.", t: "A agenda é parte da estratégia, não detalhe.", c: "var(--coral)" }
    ]
  };
  function refs() {
    var el = $("[data-refs]"); if (!el) return;
    function col(title, list) {
      return '<div class="refs__col"><h3>' + title + '</h3>' + list.map(function (r) {
        return '<div class="ref" style="--c:' + r.c + '"><span class="ref__place">' + esc(r.p) + '</span><p class="ref__what">' + esc(r.w) + '</p><p class="ref__take">' + esc(r.t) + '</p></div>';
      }).join("") + '</div>';
    }
    el.innerHTML = col("No Brasil", REFS.br) + col("No mundo", REFS.mundo);
  }

  /* ---------------- agenda: lista ---------------- */
  var state = { tipos: {}, q: "", mode: "mes", calMonth: null, past: false };

  // allDates: true no calendário (navega por qualquer mês); na lista, passados só com o botão ligado.
  function filtered(allDates) {
    var q = state.q.trim().toLowerCase();
    var anyTipo = Object.keys(state.tipos).some(function (k) { return state.tipos[k]; });
    var base = allDates || state.past ? allEvents() : upcoming(allEvents());
    return base.filter(function (e) {
      if (anyTipo && !state.tipos[e.tipo]) return false;
      if (q) {
        var hay = (e.titulo + " " + e.organizador + " " + e.local + " " + (e.descricao || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function eventRow(e, clashes, compact) {
    var d = parseD(e.data), tp = tipo(e.tipo);
    var dateHtml = e.dataAConfirmar
      ? '<div class="event__date event__date--tbd"><span class="event__day">' + mesCurto(d.getMonth()) + '</span><span class="event__wd">' + t("a confirmar") + '</span></div>'
      : '<div class="event__date"><span class="event__day">' + d.getDate() + '</span><span class="event__wd">' + (compact ? mesCurto(d.getMonth()) : diaCurto(d.getDay())) + '</span></div>';
    var when = [];
    if (e.dataFim && e.dataFim !== e.data) when.push(t("até {data}", { data: fmtShort(parseD(e.dataFim)) }));
    if (e.hora) when.push(horario(e));
    var isClash = !LONGOS[e.tipo] && !e.dataAConfirmar && clashes[e.data] && clashes[e.data].length > 1;
    var badges = [];
    var isPast = endOf(e) < today();
    if (isPast) badges.push('<span class="badge badge--past">Realizado</span>');
    if (e.exemplo) badges.push('<span class="badge badge--ex">Exemplo</span>');
    if (e.gratuito) badges.push('<span class="badge">Gratuito</span>');
    badges.push('<span class="badge">' + formato(e.formato) + '</span>');
    if (isClash && !isPast) badges.push('<span class="badge badge--clash">Mesmo dia de outro evento</span>');
    return '<li class="event' + (e.exemplo ? " is-example" : "") + (isPast ? " is-past" : "") + '">' + dateHtml +
      '<div><p class="event__type"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(tp.nome) + '</p>' +
      '<h3 class="event__title" data-no-i18n><button type="button" data-open="' + esc(e.id) + '">' + esc(e.titulo) + '</button></h3>' +
      '<p class="event__meta"><span data-no-i18n>' + esc(e.organizador) + '</span><span data-no-i18n>' + esc(e.local) + '</span>' + (when.length ? '<span>' + esc(when.join(", ")) + '</span>' : "") + '</p>' +
      (compact ? (e.exemplo ? '<div class="event__badges"><span class="badge badge--ex">Exemplo</span></div>' : "") : '<div class="event__badges">' + badges.join("") + '</div>') +
      '</div>' + (isPast ? "" : '<a class="btn btn--ghost btn--small event__go" href="' + gcal(e) + '" target="_blank" rel="noopener">Salvar no Google Agenda</a>') + '</li>';
  }

  function renderList() {
    var box = $("[data-list]"); if (!box) return;
    var list = filtered(), clashes = clashMap(allEvents());
    if (!list.length) {
      box.innerHTML = '<div class="empty"><strong>Nenhum evento encontrado com esses filtros.</strong>Limpe a busca ou os tipos selecionados. Conhece um evento que deveria estar aqui? <button class="btn btn--small" type="button" data-acao="novo-evento">Cadastre</button></div>';
      return;
    }
    function months(items, desc) {
      var groups = {};
      items.forEach(function (e) { var d = parseD(e.data); var k = d.getFullYear() + "-" + String(d.getMonth()).padStart(2, "0"); (groups[k] = groups[k] || []).push(e); });
      var keys = Object.keys(groups).sort(); if (desc) keys.reverse();
      return keys.map(function (k) {
        var y = k.split("-")[0], m = +k.split("-")[1], its = groups[k];
        if (desc) its = its.slice().reverse();
        return '<section class="month"><h3 class="month__title"><span>' + mesTitulo(+y, m) + '</span><span class="month__count">' + t(its.length === 1 ? "{n} item" : "{n} itens", { n: its.length }) + '</span></h3><ol class="event-list">' +
          its.map(function (e) { return eventRow(e, clashes, false); }).join("") + "</ol></section>";
      }).join("");
    }
    var hj = today();
    var fut = list.filter(function (e) { return endOf(e) >= hj; }), past = list.filter(function (e) { return endOf(e) < hj; });
    box.innerHTML = (fut.length ? months(fut, false) : '<div class="empty"><strong>Nenhum evento futuro com esses filtros.</strong></div>') +
      (past.length ? '<h3 class="past-title">Já realizados</h3><p class="note">Do mais recente para o mais antigo.</p>' + months(past, true) : "");
  }

  function renderNext() {
    var box = $("[data-next]"); if (!box) return;
    var list = upcoming(allEvents()).slice(0, 4);
    box.innerHTML = list.length ? list.map(function (e) { return eventRow(e, {}, true); }).join("") : '<li class="empty">Nenhum evento cadastrado ainda.</li>';
  }

  /* ---------------- agenda: calendário mês a mês ---------------- */
  function porDia(list) {
    var byDay = {};
    list.forEach(function (e) {
      daysCovered(e).forEach(function (k) { (byDay[k] = byDay[k] || []).push({ e: e, label: e.titulo, fim: false }); });
      if (LONGOS[e.tipo] && e.dataFim) (byDay[e.dataFim] = byDay[e.dataFim] || []).push({ e: e, label: e.titulo, fim: true });
    });
    return byDay;
  }
  function mesInicial() {
    var td = today(), first = upcoming(allEvents())[0], m = new Date(td.getFullYear(), td.getMonth(), 1);
    // Mês atual vazio? Abre direto no mês do próximo evento.
    if (first) { var fd = parseD(first.data); if (fd > new Date(td.getFullYear(), td.getMonth() + 1, 0)) m = new Date(fd.getFullYear(), fd.getMonth(), 1); }
    return m;
  }
  function renderCal() {
    var box = $("[data-cal]"); if (!box) return;
    if (!state.calMonth) state.calMonth = mesInicial();
    var m0 = state.calMonth, y = m0.getFullYear(), m = m0.getMonth();
    var byDay = porDia(filtered(true)), clashes = clashMap(allEvents());
    var start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    var cells = "", tIso = iso(today()), total = 0;
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i === 35 && d.getMonth() !== m) break;
      var k = iso(d), evs = byDay[k] || [];
      if (d.getMonth() === m) total += evs.filter(function (x) { return !x.fim; }).length;
      var cls = "cal__day" + (d.getMonth() !== m ? " is-out" : "") + (k === tIso ? " is-today" : "") + (k === state.calFoco ? " is-focus" : "") + (clashes[k] && clashes[k].length > 1 ? " is-clash" : "") + (evs.length ? " has-ev" : "");
      var mostra = evs.slice(0, 3), resto = evs.length - mostra.length;
      cells += '<div class="' + cls + '" data-dia="' + k + '"><span class="cal__n">' + d.getDate() + '</span>' + mostra.map(function (x) {
        var label = x.fim ? t("Encerra: {titulo}", { titulo: x.label }) : x.label;
        return '<button class="cal__ev" type="button" data-open="' + esc(x.e.id) + '" title="' + esc(label) + '" aria-label="' + esc(label + ", " + fmtShort(d)) + '" data-no-i18n><span class="dot" style="--c:' + tipo(x.e.tipo).cor + '"></span><span>' + esc(label) + '</span></button>';
      }).join("") + (resto > 0 ? '<span class="cal__mais">' + t("+{n} mais", { n: resto }) + '</span>' : "") + '</div>';
    }
    box.innerHTML = '<div class="cal__head"><h3>' + mesTitulo(y, m) + ' <span class="cal__total">' + t(total === 1 ? "{n} evento" : "{n} eventos", { n: total }) + '</span></h3><div class="cal__nav">' +
      '<button type="button" data-cal-nav="-1" aria-label="' + t("Mês anterior") + '">‹</button><button type="button" data-cal-nav="0">' + t("Hoje") + '</button><button type="button" data-cal-nav="1" aria-label="' + t("Próximo mês") + '">›</button></div></div>' +
      '<div class="cal__grid">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) { return '<div class="cal__wd">' + diaCurto(n) + '</div>'; }).join("") + cells + '</div>' +
      '<p class="note">' + t("Dias com contorno vermelho têm mais de um evento marcado.") + '</p>';
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-cal-nav]"); if (!b) return;
    var n = +b.getAttribute("data-cal-nav"), td = today();
    state.calFoco = null;
    if (n === 0) state.calMonth = new Date(td.getFullYear(), td.getMonth(), 1);
    else state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + n, 1);
    renderCal();
  });

  /* ---------------- agenda: visão do ano ---------------- */
  function renderYear() {
    var box = $("[data-year]"); if (!box) return;
    if (!state.ano) state.ano = (state.calMonth || mesInicial()).getFullYear();
    var y = state.ano, byDay = porDia(filtered(true)), tIso = iso(today()), totalAno = 0;
    var meses = "";
    for (var m = 0; m < 12; m++) {
      var first = new Date(y, m, 1), nDias = new Date(y, m + 1, 0).getDate(), cells = "", noMes = 0;
      for (var b = 0; b < first.getDay(); b++) cells += '<span class="ym__d is-pad" aria-hidden="true"></span>';
      for (var dd = 1; dd <= nDias; dd++) {
        var dt = new Date(y, m, dd), k = iso(dt), n = (byDay[k] || []).filter(function (x) { return !x.fim; }).length;
        noMes += n;
        var nivel = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3;
        var rot = fmtShort(dt) + (n ? ": " + t(n === 1 ? "{n} evento" : "{n} eventos", { n: n }) : "");
        cells += n
          ? '<button type="button" class="ym__d lv' + nivel + (k === tIso ? " is-today" : "") + '" data-ano-dia="' + k + '" aria-label="' + esc(rot) + '" title="' + esc(rot) + '">' + dd + '</button>'
          : '<span class="ym__d' + (k === tIso ? " is-today" : "") + '">' + dd + '</span>';
      }
      totalAno += noMes;
      meses += '<section class="ym"><h4><button type="button" class="ym__t" data-ano-mes="' + m + '">' + cap1(mesNome(m)) + '</button><span class="ym__n">' + (noMes ? noMes : "") + '</span></h4>' +
        '<div class="ym__g">' + [0, 1, 2, 3, 4, 5, 6].map(function (n) { return '<span class="ym__wd" aria-hidden="true">' + diaCurto(n).charAt(0) + '</span>'; }).join("") + cells + '</div></section>';
    }
    box.innerHTML = '<div class="cal__head"><h3>' + y + ' <span class="cal__total">' + t(totalAno === 1 ? "{n} evento" : "{n} eventos", { n: totalAno }) + '</span></h3><div class="cal__nav">' +
      '<button type="button" data-ano-nav="-1" aria-label="' + t("Ano anterior") + '">‹</button><button type="button" data-ano-nav="0">' + t("Este ano") + '</button><button type="button" data-ano-nav="1" aria-label="' + t("Próximo ano") + '">›</button></div></div>' +
      '<div class="year__grid">' + meses + '</div>' +
      '<p class="note year__legenda"><span class="ym__d lv1" aria-hidden="true"></span> ' + t("1 evento") + ' <span class="ym__d lv2" aria-hidden="true"></span> ' + t("2 eventos") + ' <span class="ym__d lv3" aria-hidden="true"></span> ' + t("3 ou mais") + '. ' + t("Toque em um dia ou no nome do mês para ver os detalhes.") + '</p>';
  }
  document.addEventListener("click", function (ev) {
    var nav = ev.target.closest("[data-ano-nav]");
    if (nav) { var n = +nav.getAttribute("data-ano-nav"); state.ano = n === 0 ? today().getFullYear() : state.ano + n; renderYear(); return; }
    var dia = ev.target.closest("[data-ano-dia]"), mes = ev.target.closest("[data-ano-mes]");
    if (!dia && !mes) return;
    if (dia) { var d = parseD(dia.getAttribute("data-ano-dia")); state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); state.calFoco = iso(d); }
    else { state.calMonth = new Date(state.ano, +mes.getAttribute("data-ano-mes"), 1); state.calFoco = null; }
    renderCal(); modo("mes");
    var alvo = state.calFoco && $('[data-dia="' + state.calFoco + '"]');
    (alvo || $("[data-cal]")).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  });

  function renderAgenda() { renderList(); renderCal(); renderYear(); renderNext(); renderKpis(); }

  /* filtros */
  function renderChips() {
    var el = $("[data-chips]"); if (!el) return;
    var any = Object.keys(state.tipos).some(function (k) { return state.tipos[k]; });
    el.innerHTML = '<button class="chip" type="button" aria-pressed="' + !any + '" data-chip="">' + t("Todos") + '</button>' + TIPOS.map(function (tp) {
      return '<button class="chip" type="button" aria-pressed="' + !!state.tipos[tp.id] + '" data-chip="' + tp.id + '"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(t(tp.nome)) + '</button>';
    }).join("");
  }
  function chips() {
    var el = $("[data-chips]"); if (!el) return;
    renderChips();
    el.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-chip]"); if (!b) return;
      var id = b.getAttribute("data-chip");
      if (!id) state.tipos = {}; else state.tipos[id] = !state.tipos[id];
      renderChips(); renderList(); renderCal(); renderYear();
    });
    var pastBtn = $("[data-past]");
    if (pastBtn) pastBtn.addEventListener("click", function () {
      state.past = !state.past;
      pastBtn.setAttribute("aria-pressed", String(state.past));
      renderList();
    });
    var s = $("[data-search]");
    s.addEventListener("input", function () { state.q = s.value; renderList(); renderCal(); renderYear(); });
    $$("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () { modo(b.getAttribute("data-mode")); });
    });
  }
  function modo(m) {
    state.mode = m;
    $$("[data-mode]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-mode") === m)); });
    ["mes", "ano"].forEach(function (p) { var el = $('[data-panel="' + p + '"]'); if (el) el.hidden = p !== m; });
  }

  /* ---------------- detalhe do evento ---------------- */
  var modal = $("[data-modal]");
  function findEvent(id) { var l = allEvents(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function openEvent(id) {
    var e = findEvent(id); if (!e) return;
    hit("evento_aberto", "agenda", e.id);
    var tp = tipo(e.tipo), d = parseD(e.data);
    var quando = e.dataAConfirmar ? t("{mes}, data a confirmar", { mes: cap1(I.mesAno(d)) }) : cap1(fmtLong(d));
    if (e.dataFim && e.dataFim !== e.data) quando = t("{inicio} até {fim}", { inicio: quando, fim: fmtLong(parseD(e.dataFim)) });
    var fmt = formato(e.formato);
    var rows = [
      [t("Quando"), quando + (e.hora ? ", " + horario(e) : "")],
      [t("Onde"), e.local + (e.local.toLowerCase().indexOf(fmt.toLowerCase()) === 0 ? "" : " (" + fmt + ")")],
      [t("Organização"), e.organizador],
      [t("Para quem"), (e.publicos || []).map(function (p) { return t(p); }).join(", ") || t("Aberto a todos")],
      [t("Custo"), t(e.gratuito === true ? "Gratuito" : e.gratuito === false ? "Pago" : "Consulte o organizador")]
    ];
    $("[data-modal-body]").innerHTML =
      '<button class="modal__close" type="button" data-close>Fechar</button>' +
      '<p class="modal__type"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(tp.nome) + (e.exemplo ? ' <span class="badge badge--ex">Exemplo</span>' : "") + '</p>' +
      '<h2 id="modal-title" data-no-i18n>' + esc(e.titulo) + '</h2>' +
      (e.descricao ? '<p data-no-i18n>' + esc(e.descricao) + '</p>' : "") +
      '<dl data-no-i18n>' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join("") + '</dl>' +
      '<div class="modal__actions">' +
        (safeUrl(e.link) ? '<a class="btn" data-inscricao="' + esc(e.id) + '" href="' + esc(e.link) + '" target="_blank" rel="noopener">' + (endOf(e) < today() ? "Saber mais" : "Inscrição e informações") + '</a>' : "") +
        (endOf(e) < today() ? "" :
          '<a class="btn btn--ghost" href="' + gcal(e) + '" target="_blank" rel="noopener">Salvar no Google Agenda</a>' +
          '<button class="btn btn--ghost" type="button" data-ics="' + esc(e.id) + '" title="Arquivo de calendário para Apple, Outlook e outros aplicativos">Baixar .ics</button>') +
      '</div>' +
      (safeUrl(e.fonte) && e.fonte !== e.link ? '<p class="modal__source"><a href="' + esc(e.fonte) + '" target="_blank" rel="noopener">Fonte da informação</a></p>' : "");
    abrirModal();
  }
  function abrirModal() { if (modal.open) return; if (modal.showModal) modal.showModal(); else modal.setAttribute("open", ""); }
  // Usado por Programas e Vitrine para mostrar detalhes no mesmo modal.
  function modalHtml(html) { $("[data-modal-body]").innerHTML = '<button class="modal__close" type="button" data-close>Fechar</button>' + html; abrirModal(); }
  document.addEventListener("click", function (ev) {
    var o = ev.target.closest("[data-open]"); if (o) { openEvent(o.getAttribute("data-open")); return; }
    var ic = ev.target.closest("[data-ics]"); if (ic) { var ie = findEvent(ic.getAttribute("data-ics")); if (ie) downloadIcs(ie); return; }
    if (ev.target.closest("[data-close]") || ev.target === modal) modal.close();
  });

  function gcal(e) {
    var tz = CFG.FUSO || "America/Sao_Paulo";
    var s = e.data.replace(/-/g, ""), f = (e.dataFim || e.data).replace(/-/g, ""), dates;
    if (e.hora) {
      dates = s + "T" + e.hora.replace(":", "") + "00/" + f + "T" + (e.horaFim || e.hora).replace(":", "") + "00";
    } else {
      var end = parseD(e.dataFim || e.data); end = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
      dates = s + "/" + iso(end).replace(/-/g, "");
    }
    var p = new URLSearchParams({ action: "TEMPLATE", text: e.titulo + (e.dataAConfirmar ? " (data a confirmar)" : ""), dates: dates, ctz: tz, details: (e.descricao || "") + "\n\nAgenda Única da Inovação, ELI Pouso Alegre", location: e.local || "" });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  /* Arquivo .ics (Apple, Outlook e outros), gerado no navegador. Fuso fixo de Brasília, sem horário de verão. */
  function ics(e) {
    var tz = CFG.FUSO || "America/Sao_Paulo";
    function txt(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
    function p2(n) { return String(n).padStart(2, "0"); }
    function stamp(ms) { var d = new Date(ms); return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()); }
    // Horário "de parede" calculado em UTC só para somar sem interferência do fuso do visitante.
    function wall(dateStr, hora) { var a = dateStr.split("-"), h = hora.split(":"); return Date.UTC(+a[0], +a[1] - 1, +a[2], +h[0], +h[1]); }
    function fold(line) {
      var out = [], cur = "", bytes = 0, enc = window.TextEncoder ? new TextEncoder() : null;
      Array.from(line).forEach(function (ch) {
        var b = enc ? enc.encode(ch).length : 1;
        if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
        cur += ch; bytes += b;
      });
      out.push(cur);
      return out.join("\r\n ");
    }
    var start, end;
    if (e.hora) {
      var s = wall(e.data, e.hora), f = wall(e.dataFim || e.data, e.horaFim || e.hora);
      if (f <= s) f = s + 3600000; // sem horário de término: 1 hora
      start = "DTSTART;TZID=" + tz + ":" + stamp(s); end = "DTEND;TZID=" + tz + ":" + stamp(f);
    } else {
      var last = parseD(e.dataFim || e.data), next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      start = "DTSTART;VALUE=DATE:" + e.data.replace(/-/g, ""); end = "DTEND;VALUE=DATE:" + iso(next).replace(/-/g, "");
    }
    var desc = (e.descricao || "") + (e.link ? "\n\nInscrição: " + e.link : "") + "\n\nAgenda Única da Inovação, ELI Pouso Alegre";
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ELI Pouso Alegre//Agenda Unica//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE", "TZID:" + tz, "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:" + e.id + "@eli-pouso-alegre",
      "DTSTAMP:" + stamp(Date.now()) + "Z",
      start, end,
      "SUMMARY:" + txt(e.titulo + (e.dataAConfirmar ? " (data a confirmar)" : "")),
      "DESCRIPTION:" + txt(desc),
      "LOCATION:" + txt(e.local)
    ];
    if (e.link && /^https?:\/\//.test(e.link)) lines.push("URL:" + e.link);
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }
  function downloadIcs(e) {
    var blob = new Blob([ics(e)], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    var nome = String(e.titulo || "evento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "evento";
    a.href = url; a.download = nome + ".ics"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- radar de datas (usado no formulário de Minha conta) ---------------- */
  function radarHtml(v, ignorarId) {
    if (!v) return { cls: "radar", html: '<p class="radar__idle">' + t("Escolha uma data para ver o radar.") + '</p>' };
    var d = parseD(v), list = allEvents().filter(function (e) { return e.id !== ignorarId; });
    var same = list.filter(function (e) { return !LONGOS[e.tipo] && !e.dataAConfirmar && daysCovered(e).indexOf(v) !== -1; });
    var ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()), we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    var week = list.filter(function (e) { var x = parseD(e.data); return !LONGOS[e.tipo] && !e.dataAConfirmar && x >= ws && x <= we && e.data !== v; });
    var weekTxt = '<p class="radar__week">' + (week.length ? t(week.length === 1 ? "Na mesma semana: {n} outro evento." : "Na mesma semana: {n} outros eventos.", { n: week.length }) : t("Semana sem outros eventos cadastrados.")) + '</p>';
    if (same.length) return { cls: "radar radar--busy", html: '<p class="radar__title">' + t(same.length === 1 ? "{dia} já tem {n} evento" : "{dia} já tem {n} eventos", { dia: cap1(fmtLong(d)), n: same.length }) + '</p><ul data-no-i18n>' +
      same.map(function (e) { return '<li>' + esc(e.titulo) + (e.hora ? ", " + hhmm(e.hora) : "") + '</li>'; }).join("") +
      '</ul><p class="radar__week">' + t("Você pode cadastrar mesmo assim. Se o público for o mesmo, vale escolher outra data ou combinar horários com quem organiza.") + '</p>' + weekTxt };
    return { cls: "radar radar--free", html: '<p class="radar__title">' + t("{dia} está livre", { dia: cap1(fmtLong(d)) }) + '</p><p>' + t("Nenhum outro evento cadastrado nesse dia.") + '</p>' + weekTxt };
  }

  /* ---------------- grupo 2 ---------------- */
  function members() {
    var el = $("[data-members]"); if (!el) return;
    var cores = ["var(--coral)", "var(--mint)", "var(--sun)", "var(--blue)", "var(--rose)", "var(--peach)"];
    el.innerHTML = INSTITUICOES.map(function (n, i) {
      return '<li><span class="dot" style="--c:' + cores[i % cores.length] + '" aria-hidden="true"></span>' + esc(n) + '</li>';
    }).join("");
  }
  function renderKpis() {
    var list = allEvents();
    var orgs = {}; list.forEach(function (e) { if (!e.exemplo && e.organizador) orgs[e.organizador.toLowerCase()] = 1; });
    var cm = clashMap(list), choques = Object.keys(cm).filter(function (k) { return cm[k].length > 1; }).length;
    var set = function (k, v) { var el = $('[data-kpi="' + k + '"]'); if (el) el.textContent = v; };
    set("eventos", list.length); set("orgs", Object.keys(orgs).length); set("choques", choques);
  }

  /* ---------------- eventos cadastrados pelos usuários (Firebase) ---------------- */
  function loadRemote() {
    var FB = window.ELI_FB; if (!FB || !FB.ativo()) return;
    FB.lista("eventos").then(function (lista) {
      remote = lista.filter(function (e) { return e.titulo && /^\d{4}-\d{2}-\d{2}$/.test(e.data || ""); })
        .map(function (e) { return Object.assign({}, e, { exemplo: false, organizador: e.organizador || e.instituicao || "" }); });
      renderAgenda();
    }).catch(function () {
      var n = $("[data-sandbox-note]");
      if (n) { n.hidden = false; n.textContent = t("Não foi possível carregar os eventos cadastrados agora. Mostrando os eventos salvos no site."); }
    });
  }

  /* ---------------- app instalável (PWA) ---------------- */
  var INSTALL_ESPERA = 15000;             // 15 segundos no site
  var INSTALL_PAUSA = 14 * 24 * 3600000;  // "Agora não" silencia por 14 dias
  var INSTALL_CHAVE = "eli-install-dispensado";
  var installEvt = null;
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* navegação privada */ } }
  function isStandalone() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; }
  function pwa() {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* sem app offline, o site segue normal */ });
    }
    var box = $("[data-install]"); if (!box) return;
    var ua = navigator.userAgent || "";
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isMobile = isIOS || /Android/i.test(ua) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    var okBtn = $("[data-install-ok]", box), noBtn = $("[data-install-no]", box), text = $("[data-install-text]", box);

    window.addEventListener("beforeinstallprompt", function (ev) { ev.preventDefault(); installEvt = ev; });
    window.addEventListener("appinstalled", function () { fechar(); lsSet(INSTALL_CHAVE, "instalado"); hit("app_instalado"); });

    function fechar() { box.hidden = true; document.body.classList.remove("has-install"); }
    function abrir() { hit("convite_app"); box.hidden = false; document.body.classList.add("has-install"); document.body.style.setProperty("--install-h", (box.offsetHeight + 24) + "px"); }
    noBtn.addEventListener("click", function () { lsSet(INSTALL_CHAVE, String(Date.now())); fechar(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") noBtn.click(); });
    okBtn.addEventListener("click", function () {
      if (installEvt) {
        installEvt.prompt();
        installEvt.userChoice.then(function (r) { if (r && r.outcome === "accepted") lsSet(INSTALL_CHAVE, "instalado"); else lsSet(INSTALL_CHAVE, String(Date.now())); })
          .catch(function () {}).then(function () { installEvt = null; fechar(); });
      } else { lsSet(INSTALL_CHAVE, String(Date.now())); fechar(); }
    });

    setTimeout(function () {
      var dispensado = lsGet(INSTALL_CHAVE);
      if (isStandalone() || !isMobile || dispensado === "instalado") return;
      if (dispensado && Date.now() - +dispensado < INSTALL_PAUSA) return;
      if (isIOS) {
        text.innerHTML = 'No iPhone: toque em <strong>Compartilhar</strong> <span aria-hidden="true">(o quadrado com a seta)</span> e depois em <strong>Adicionar à Tela de Início</strong>.';
        okBtn.textContent = "Entendi";
      } else if (!installEvt) {
        text.innerHTML = 'Abra o menu do navegador <span aria-hidden="true">(⋮)</span> e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.';
        okBtn.textContent = "Entendi";
      }
      abrir();
    }, INSTALL_ESPERA);
  }

  /* ---------------- estatísticas anônimas (LGPD: sem cookies, sem dados pessoais) ---------------- */
  // Não conta: aparelho com login de Admin, prévias da Vercel, cópia local, robôs de teste e quem pede "não rastrear".
  var ADMIN_CHAVE = "eli-admin";
  function isAdmin() { try { var a = JSON.parse(window.localStorage.getItem(ADMIN_CHAVE) || "null"); return !!(a && a.exp > Date.now()); } catch (e) { return false; } }
  function rastreavel() {
    if (!(window.ELI_FB && window.ELI_FB.ativo()) || isAdmin() || navigator.webdriver) return false;
    if (location.protocol !== "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /-deep-tree-inovacao\.vercel\.app$/.test(location.hostname)) return false;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return false;
    return true;
  }
  var ORIGEM = (function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("utm_source")) return String(q.get("utm_source")).slice(0, 40);
      if (q.get("origem") === "app") return "app instalado";
      if (document.referrer) { var r = new URL(document.referrer); if (r.hostname !== location.hostname) return r.hostname.replace(/^www\./, ""); }
    } catch (e) { /* sem origem */ }
    return "";
  })();
  function visitante() {
    // Código aleatório que muda todo dia: conta visitantes do dia sem seguir ninguém entre dias.
    var dia = iso(today());
    try {
      var v = JSON.parse(window.localStorage.getItem("eli-v") || "null");
      if (v && v.d === dia) return v.id;
      v = { d: dia, id: Math.random().toString(36).slice(2, 12) };
      window.localStorage.setItem("eli-v", JSON.stringify(v));
      return v.id;
    } catch (e) { return "sem-armazenamento"; }
  }
  function contexto() {
    var ua = navigator.userAgent || "";
    var iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    var disp = /iPad|Tablet/i.test(ua) || iPadOS ? "tablet" : /Mobi|Android|iPhone|iPod/i.test(ua) ? "celular" : "computador";
    var nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\//.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Outro";
    var so = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) || iPadOS ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Outro";
    return { dispositivo: disp, navegador: nav, sistema: so };
  }
  function hit(tipo, pagina, alvo) {
    if (!rastreavel()) return;
    var novo = false;
    try { if (!window.localStorage.getItem("eli-ja-visitou")) { novo = true; window.localStorage.setItem("eli-ja-visitou", "1"); } } catch (e) { /* ok */ }
    var c = contexto();
    var corpo = JSON.stringify({
      tipo: tipo, pagina: pagina || (location.hash || "#inicio").slice(1), alvo: alvo || "",
      visitante: visitante(), novo: tipo === "pagina" && novo, dispositivo: c.dispositivo, navegador: c.navegador, sistema: c.sistema,
      idioma: (navigator.language || "").slice(0, 8), origem: ORIGEM, app: isStandalone()
    });
    ORIGEM = ""; // a origem vale só para a primeira página da visita
    window.ELI_FB.registrar(JSON.parse(corpo));
  }
  document.addEventListener("click", function (ev) {
    var el = ev.target;
    if (el.closest(".wa-float")) hit("whatsapp");
    else if (el.closest("[data-ics]") || el.closest('a[href^="https://calendar.google.com"]')) hit("salvar_agenda", "agenda");
    else if (el.closest("[data-inscricao]")) hit("inscricao", "agenda", el.closest("[data-inscricao]").getAttribute("data-inscricao"));
    else if (el.closest("[data-site-ator]")) hit("site_ator", "vitrine", el.closest("[data-site-ator]").getAttribute("data-site-ator"));
  });

  /* ---------------- aviso de privacidade ---------------- */
  var priv = $("[data-privacidade-modal]");
  document.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-privacidade]")) { ev.preventDefault(); if (priv && priv.showModal) priv.showModal(); }
    if (priv && (ev.target.closest("[data-fechar-privacidade]") || ev.target === priv)) priv.close();
  });

  /* ---------------- início ---------------- */
  window.ELI_APP = {
    allEvents: allEvents, renderAgenda: renderAgenda, loadRemote: loadRemote, tipo: tipo, formato: formato, horario: horario,
    TIPOS: TIPOS, PUBLICOS: PUBLICOS, FORMATOS: FORMATOS_PT, parseD: parseD, iso: iso, today: today, endOf: endOf, cap1: cap1,
    esc: esc, safeUrl: safeUrl, t: t, radarHtml: radarHtml, modalHtml: modalHtml, hit: hit, rota: function () { return rotaAtual; }
  };
  network(); org(); refs(); chips(); members(); modo("mes");
  renderAgenda(); route(); pwa();
  // Eventos cadastrados por usuários: carrega depois que a página já apareceu.
  (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(loadRemote);
  if (I) I.aoMudar(function () { renderChips(); renderAgenda(); document.title = t(TITULOS[rotaAtual.view] || TITULOS.inicio); });
})();
