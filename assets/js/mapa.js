/* ==========================================================
   ELI Pouso Alegre — Vitrine (4 hélices) e Programas e Ações
   Os dados vêm do Firebase (instituições e programas cadastrados
   pelos próprios atores). Leitura leve, sem carregar o SDK.
   ========================================================== */
(function () {
  "use strict";
  var FB = window.ELI_FB, APP = window.ELI_APP, I = window.ELI_I18N;
  if (!FB || !APP) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = APP.t, esc = APP.esc, safeUrl = APP.safeUrl;
  var HELICES = window.ELI_HELICES, TIPOS = window.ELI_TIPOS_PROGRAMA, VERT = window.ELI_VERTENTES, STATUS = window.ELI_STATUS_PROGRAMA;
  var dados = { instituicoes: null, programas: null };
  var erro = { instituicoes: false, programas: false };

  var ICONES = {
    fabrica: '<path d="M3 21V10l6 3V10l6 3V6h6v15z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    capelo: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>',
    predio: '<path d="M3 21h18M5 21V10M19 21V10M9 21v-7h6v7"/><path d="M2 10l10-6 10 6z"/>',
    pessoas: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c.2-2.6 1.6-4.5 3.5-4.5S21 17.4 21 20"/>'
  };
  function icone(nome) { return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONES[nome] || "") + "</svg>"; }
  function nomeDe(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return { id: id, nome: id || "", cor: "var(--ink)" }; }
  function ativos() { return (dados.instituicoes || []).filter(function (i) { return i.ativo !== false && i.nome && i.logo; }); }

  function carregar(col) {
    if (dados[col]) return Promise.resolve(dados[col]);
    return FB.lista(col).then(function (l) { dados[col] = l; erro[col] = false; return l; })
      .catch(function (e) { erro[col] = e && e.message === "off" ? "off" : true; dados[col] = null; return []; });
  }
  document.addEventListener("eli:dados", function (ev) {
    var c = ev.detail && ev.detail.colecao;
    if (c === "instituicoes" || c === "programas") { dados[c] = null; FB.limparCache(c); }
    var r = APP.rota(); if (r.view === "vitrine" || r.view === "programas") mostrar(r);
  });
  document.addEventListener("eli:rota", function (ev) { mostrar(ev.detail); });
  if (I) I.aoMudar(function () { mostrar(APP.rota()); });

  function mostrar(r) {
    if (r.view === "vitrine") vitrine(r.sub[0]);
    if (r.view === "programas") programas();
  }

  function aviso(col) {
    if (erro[col] === "off") return '<div class="empty"><strong>' + t("Em breve") + "</strong>" + t("O cadastro de instituições, programas e ações está sendo ativado.") + "</div>";
    return '<div class="empty"><strong>' + t("Não foi possível carregar agora.") + "</strong>" + t("Verifique sua conexão e tente de novo em instantes.") + "</div>";
  }

  /* ---------------- Vitrine ---------------- */
  var filtroAtores = { q: "", cat: "" };
  function vitrine(heliceId) {
    var home = $("[data-vitrine-home]"), pag = $("[data-vitrine-helice]");
    var h = heliceId && HELICES.filter(function (x) { return x.id === heliceId; })[0];
    home.hidden = !!h; pag.hidden = !h;
    if (!h) {
      pintarHelices();
      carregar("instituicoes").then(pintarHelices);
      return;
    }
    filtroAtores = { q: "", cat: "" };
    $("[data-atores-busca]").value = "";
    $("[data-helice-head]").innerHTML = '<div class="helice-head__ico" style="--c:' + h.cor + '">' + icone(h.icone) + '</div><div><h2 id="h-helice">' + esc(t(h.nome)) + "</h2><p>" + esc(t(h.texto)) + "</p></div>";
    $("[data-atores]").innerHTML = '<li class="atores__carregando">' + t("Carregando…") + "</li>";
    carregar("instituicoes").then(function () { pintarAtores(h); });
  }
  function pintarHelices() {
    var box = $("[data-helices]"), lista = ativos();
    box.innerHTML = HELICES.map(function (h) {
      var n = lista.filter(function (i) { return i.helice === h.id; }).length;
      var logos = lista.filter(function (i) { return i.helice === h.id; }).slice(0, 5).map(function (i) { return '<img src="' + esc(i.logo) + '" alt="" loading="lazy">'; }).join("");
      return '<a class="helice" href="#vitrine/' + h.id + '" style="--c:' + h.cor + '">' +
        '<span class="helice__ico">' + icone(h.icone) + "</span>" +
        "<strong>" + esc(t(h.nome)) + "</strong><span class=\"helice__resumo\">" + esc(t(h.resumo)) + "</span>" +
        '<span class="helice__logos" aria-hidden="true">' + logos + "</span>" +
        '<span class="helice__n">' + (dados.instituicoes ? t(n === 1 ? "{n} ator ativo" : "{n} atores ativos", { n: n }) : t("Ver atores")) + " →</span></a>";
    }).join("");
  }
  function pintarAtores(h) {
    var ul = $("[data-atores]"), cats = $("[data-atores-cats]");
    if (erro.instituicoes) { ul.innerHTML = "<li>" + aviso("instituicoes") + "</li>"; cats.innerHTML = ""; return; }
    var daHelice = ativos().filter(function (i) { return i.helice === h.id; });
    var catsUsadas = [];
    daHelice.forEach(function (i) { if (i.categoria && catsUsadas.indexOf(i.categoria) === -1) catsUsadas.push(i.categoria); });
    cats.innerHTML = catsUsadas.length > 1 ? ['<button class="chip" type="button" aria-pressed="' + !filtroAtores.cat + '" data-cat="">' + t("Todas") + "</button>"].concat(catsUsadas.sort().map(function (c) {
      return '<button class="chip" type="button" aria-pressed="' + (filtroAtores.cat === c) + '" data-cat="' + esc(c) + '">' + esc(t(c)) + "</button>";
    })).join("") : "";
    var q = filtroAtores.q.toLowerCase();
    var lista = daHelice.filter(function (i) {
      if (filtroAtores.cat && i.categoria !== filtroAtores.cat) return false;
      if (q && (i.nome + " " + (i.sigla || "") + " " + (i.areas || []).join(" ") + " " + (i.descricao || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    if (!lista.length) {
      ul.innerHTML = '<li class="atores__vazio"><div class="empty"><strong>' + t(daHelice.length ? "Nenhum ator encontrado com esse filtro." : "Ainda não há atores cadastrados nesta hélice.") + "</strong>" +
        t("Sua instituição faz parte? Crie o perfil e apareça aqui.") + ' <button class="btn btn--small" type="button" data-acao="minha-instituicao">' + t("Cadastrar minha instituição") + "</button></div></li>";
      return;
    }
    ul.innerHTML = lista.map(function (i) {
      var site = safeUrl(i.site) ? i.site : null;
      var nome = esc(i.sigla && i.sigla.length < i.nome.length ? i.sigla : i.nome);
      return '<li class="ator">' +
        (site ? '<a class="ator__logo" href="' + esc(site) + '" target="_blank" rel="noopener" data-site-ator="' + esc(i.id) + '" aria-label="' + esc(t("Visitar o site de {nome}", { nome: i.nome })) + '">' : '<span class="ator__logo">') +
        '<img src="' + esc(i.logo) + '" alt="' + esc(t("Logo de {nome}", { nome: i.nome })) + '" loading="lazy" width="160" height="160">' + (site ? "</a>" : "</span>") +
        '<div class="ator__info"><strong data-no-i18n title="' + esc(i.nome) + '">' + nome + '</strong><span>' + esc(t(i.categoria || "")) + "</span>" +
        '<button class="linklike" type="button" data-perfil="' + esc(i.id) + '">' + t("Ver perfil") + "</button></div></li>";
    }).join("");
  }
  $("[data-atores-busca]").addEventListener("input", function () { filtroAtores.q = this.value; var h = nomeDe(HELICES, APP.rota().sub[0]); pintarAtores(h); });
  $("[data-atores-cats]").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-cat]"); if (!b) return;
    filtroAtores.cat = b.getAttribute("data-cat"); pintarAtores(nomeDe(HELICES, APP.rota().sub[0]));
  });

  // Perfil completo da instituição (no mesmo modal dos eventos)
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-perfil]"); if (!b) return;
    var i = (dados.instituicoes || []).filter(function (x) { return x.id === b.getAttribute("data-perfil"); })[0]; if (!i) return;
    APP.hit("perfil_aberto", "vitrine", i.id);
    var h = nomeDe(HELICES, i.helice);
    var links = [["site", "Site"], ["instagram", "Instagram"], ["linkedin", "LinkedIn"]].filter(function (l) { return safeUrl(i[l[0]]); })
      .map(function (l) { return '<a class="btn btn--ghost btn--small" href="' + esc(i[l[0]]) + '" target="_blank" rel="noopener"' + (l[0] === "site" ? ' data-site-ator="' + esc(i.id) + '"' : "") + ">" + t(l[1]) + "</a>"; }).join("");
    var progs = (dados.programas || []).filter(function (p) { return p.instituicaoId === i.id; });
    var evs = APP.allEvents().filter(function (e) { return e.instituicaoId === i.id && APP.endOf(e) >= APP.today(); });
    var linhas = [];
    if (i.areas && i.areas.length) linhas.push([t("Áreas de atuação"), i.areas.join(", ")]);
    if (i.vertentes && i.vertentes.length) linhas.push([t("Vertentes do ELI"), i.vertentes.map(function (v) { return t(nomeDe(VERT, v).nome); }).join(", ")]);
    if (i.endereco) linhas.push([t("Endereço"), i.endereco]);
    if (i.emailPublico) linhas.push([t("E-mail"), i.emailPublico]);
    if (i.telefone) linhas.push([t("Telefone"), i.telefone]);
    APP.modalHtml(
      '<div class="perfil"><img class="perfil__logo" src="' + esc(i.logo) + '" alt="" width="96" height="96"><div>' +
      '<p class="modal__type"><span class="dot" style="--c:' + h.cor + '"></span>' + esc(t(h.nome)) + " · " + esc(t(i.categoria || "")) + "</p>" +
      '<h2 id="modal-title" data-no-i18n>' + esc(i.nome) + (i.sigla ? ' <span class="perfil__sigla">' + esc(i.sigla) + "</span>" : "") + "</h2></div></div>" +
      '<p data-no-i18n>' + esc(i.descricao || "") + "</p>" +
      (linhas.length ? '<dl data-no-i18n>' + linhas.map(function (l) { return "<dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd>"; }).join("") + "</dl>" : "") +
      (progs.length ? '<h3 class="h-small">' + t("Programas e ações") + '</h3><ul class="perfil__lista" data-no-i18n>' + progs.map(function (p) { return '<li><button class="linklike" type="button" data-programa="' + esc(p.id) + '">' + esc(p.titulo) + "</button></li>"; }).join("") + "</ul>" : "") +
      (evs.length ? '<h3 class="h-small">' + t("Próximos eventos") + '</h3><ul class="perfil__lista" data-no-i18n>' + evs.map(function (e) { return '<li><button class="linklike" type="button" data-open="' + esc(e.id) + '">' + esc(e.titulo) + "</button></li>"; }).join("") + "</ul>" : "") +
      '<div class="modal__actions">' + links + "</div>");
  });

  /* ---------------- Programas e Ações ---------------- */
  var filtro = { q: "", tipos: {}, vert: "", status: "ativos" };
  function programas() {
    pintarFiltros();
    var box = $("[data-prog-lista]");
    if (!dados.programas) box.innerHTML = '<p class="note">' + t("Carregando…") + "</p>";
    Promise.all([carregar("programas"), carregar("instituicoes")]).then(pintarProgramas);
  }
  function pintarFiltros() {
    var algum = Object.keys(filtro.tipos).some(function (k) { return filtro.tipos[k]; });
    $("[data-prog-tipos]").innerHTML = '<button class="chip" type="button" aria-pressed="' + !algum + '" data-ptipo="">' + t("Todos os tipos") + "</button>" + TIPOS.map(function (tp) {
      return '<button class="chip" type="button" aria-pressed="' + !!filtro.tipos[tp.id] + '" data-ptipo="' + tp.id + '"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(t(tp.nome)) + "</button>";
    }).join("");
    $("[data-prog-vertentes]").innerHTML = '<span class="chips__rot">' + t("Vertente:") + '</span><button class="chip" type="button" aria-pressed="' + !filtro.vert + '" data-pvert="">' + t("Todas") + "</button>" + VERT.map(function (v) {
      return '<button class="chip" type="button" aria-pressed="' + (filtro.vert === v.id) + '" data-pvert="' + v.id + '">' + esc(t(v.nome)) + "</button>";
    }).join("");
  }
  function pintarProgramas() {
    var box = $("[data-prog-lista]"), resumo = $("[data-prog-resumo]");
    if (erro.programas) { box.innerHTML = aviso("programas"); resumo.textContent = ""; return; }
    var todos = dados.programas || [], q = filtro.q.toLowerCase();
    var algum = Object.keys(filtro.tipos).some(function (k) { return filtro.tipos[k]; });
    var insts = {}; (dados.instituicoes || []).forEach(function (i) { insts[i.id] = i; });
    var lista = todos.filter(function (p) {
      if (filtro.status === "ativos" && p.status === "encerrado") return false;
      if (algum && !filtro.tipos[p.tipo]) return false;
      if (filtro.vert && p.vertente !== filtro.vert) return false;
      if (q && (p.titulo + " " + (p.instituicao || "") + " " + (p.descricao || "") + " " + (p.parceiros || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return (a.status === "encerrado") - (b.status === "encerrado") || String(a.titulo).localeCompare(String(b.titulo), "pt-BR"); });
    var nInst = {}; todos.forEach(function (p) { nInst[p.instituicaoId] = 1; });
    resumo.textContent = todos.length ? t("{n} de {total} cadastrados, de {inst} instituições.", { n: lista.length, total: todos.length, inst: Object.keys(nInst).length }) : "";
    if (!todos.length) {
      box.innerHTML = '<div class="empty"><strong>' + t("O mapa está começando.") + "</strong>" + t("Seja a primeira instituição a mapear seus programas e ações.") + ' <button class="btn btn--small" type="button" data-acao="novo-programa">' + t("Cadastrar programa ou ação") + "</button></div>";
      return;
    }
    if (!lista.length) { box.innerHTML = '<div class="empty"><strong>' + t("Nenhum resultado com esses filtros.") + "</strong>" + t("Limpe a busca ou os filtros.") + "</div>"; return; }
    box.innerHTML = lista.map(function (p) {
      var tp = nomeDe(TIPOS, p.tipo), v = nomeDe(VERT, p.vertente), st = nomeDe(STATUS, p.status), inst = insts[p.instituicaoId];
      return '<article class="card' + (p.status === "encerrado" ? " is-past" : "") + '" style="--c:' + tp.cor + '">' +
        '<p class="card__tipo"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(t(tp.nome)) + ' <span class="badge' + (p.status === "ativo" ? " badge--ok" : p.status === "encerrado" ? " badge--past" : "") + '">' + esc(t(st.nome)) + "</span></p>" +
        '<h3 class="card__titulo" data-no-i18n><button type="button" data-programa="' + esc(p.id) + '">' + esc(p.titulo) + "</button></h3>" +
        '<p class="card__desc" data-no-i18n>' + esc(String(p.descricao || "").slice(0, 180)) + (String(p.descricao || "").length > 180 ? "…" : "") + "</p>" +
        '<p class="card__inst">' + (inst && inst.logo ? '<img src="' + esc(inst.logo) + '" alt="" width="28" height="28" loading="lazy">' : "") + '<span data-no-i18n>' + esc(p.instituicao || "") + "</span></p>" +
        '<p class="card__meta"><span>' + esc(t(v.nome)) + "</span><span>" + esc(t(p.periodicidade || "")) + "</span></p></article>";
    }).join("");
  }
  $("[data-prog-busca]").addEventListener("input", function () { filtro.q = this.value; pintarProgramas(); });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-ptipo]");
    if (b) { var id = b.getAttribute("data-ptipo"); if (!id) filtro.tipos = {}; else filtro.tipos[id] = !filtro.tipos[id]; pintarFiltros(); pintarProgramas(); return; }
    var v = ev.target.closest("[data-pvert]");
    if (v) { filtro.vert = v.getAttribute("data-pvert"); pintarFiltros(); pintarProgramas(); return; }
    var s = ev.target.closest("[data-prog-status]");
    if (s) { filtro.status = s.getAttribute("data-prog-status"); $$("[data-prog-status]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === s)); }); pintarProgramas(); return; }
    var p = ev.target.closest("[data-programa]"); if (p) abrirPrograma(p.getAttribute("data-programa"));
  });

  function abrirPrograma(id) {
    var lista = dados.programas || [];
    var p = lista.filter(function (x) { return x.id === id; })[0];
    if (!p) { carregar("programas").then(function () { var q = (dados.programas || []).filter(function (x) { return x.id === id; })[0]; if (q) abrirPrograma(id); }); return; }
    APP.hit("programa_aberto", "programas", p.id);
    var tp = nomeDe(TIPOS, p.tipo), v = nomeDe(VERT, p.vertente), st = nomeDe(STATUS, p.status);
    var periodo = p.inicio || p.fim ? [p.inicio && APP.cap1(I.dataCurta(APP.parseD(p.inicio))) + " " + APP.parseD(p.inicio).getFullYear(), p.fim && I.dataCurta(APP.parseD(p.fim)) + " " + APP.parseD(p.fim).getFullYear()].filter(Boolean).join(" – ") : "";
    var linhas = [
      [t("Instituição"), p.instituicao || ""], [t("Situação"), t(st.nome)], [t("Vertente do ELI"), t(v.nome)], [t("Frequência"), t(p.periodicidade || "")],
      [t("Para quem"), (p.publicos || []).map(function (x) { return t(x); }).join(", ") || t("Aberto a todos")],
      [t("Formato"), APP.formato(p.formato)], [t("Custo"), t(p.gratuito === false ? "Pago" : "Gratuito")]
    ];
    if (periodo) linhas.splice(4, 0, [t("Período"), periodo]);
    if (p.local) linhas.push([t("Local"), p.local]);
    if (p.parceiros) linhas.push([t("Parceiros"), p.parceiros]);
    APP.modalHtml(
      '<p class="modal__type"><span class="dot" style="--c:' + tp.cor + '"></span>' + esc(t(tp.nome)) + "</p>" +
      '<h2 id="modal-title" data-no-i18n>' + esc(p.titulo) + "</h2>" +
      '<p data-no-i18n>' + esc(p.descricao || "") + "</p>" +
      '<dl data-no-i18n>' + linhas.map(function (l) { return "<dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd>"; }).join("") + "</dl>" +
      (safeUrl(p.link) ? '<div class="modal__actions"><a class="btn" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + t("Saber mais") + "</a></div>" : ""));
  }

  mostrar(APP.rota());
})();
