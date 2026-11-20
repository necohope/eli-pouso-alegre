/* ==========================================================
   ELI Pouso Alegre — Área dos Atores (restrita)
   - Só membros aprovados pelo Admin veem indicadores, documentos e anotações.
   - O Admin importa as planilhas de KPIs (.xlsx ou .csv do Drive) direto aqui;
     a leitura do arquivo acontece no navegador (SheetJS, carregado só nessa hora).
   - Documentos ficam no Drive: o site guarda só o link e mostra uma prévia.
   - O que o Admin marca como "Público" aparece no site aberto:
     indicadores em "O ELI em números" (início) e documentos em Governança.
   A segurança de verdade está em firestore.rules, não nesta tela.
   ========================================================== */
(function () {
  "use strict";
  var FB = window.ELI_FB, APP = window.ELI_APP, I = window.ELI_I18N;
  if (!FB || !APP) return;
  var t = APP.t, esc = APP.esc, safeUrl = APP.safeUrl;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js";
  var XLSX_SRI = "sha384-NG/W3xvO3ynQEcDQYIOcZTXRtwUs83cLv1FIl9PuqWPDuNhsMRF6wutlNLFwlb71";
  var MAX_LINHAS = 2000, MAX_COLS = 40, MAX_DADOS = 800000, MAX_TABELA = 500;
  var TIPOS_DOC = [
    { id: "relatorio", nome: "Relatório" }, { id: "ata", nome: "Ata" }, { id: "apresentacao", nome: "Apresentação" },
    { id: "planilha", nome: "Planilha" }, { id: "outro", nome: "Outro" }
  ];
  var ABAS = ["indicadores", "documentos", "notas", "pedidos"];

  var usuario = null, admin = false, pedido = null, minhaInst = "", estado = "anon";
  var dados = vazio(), carregado = false, carregando = null;
  var filtroDoc = "", docEditando = null, notaEditando = null, indEditando = null, imp = null;

  function vazio() { return { indicadores: [], documentos: [], notas: [], membros: [] }; }
  function rota() { return APP.rota(); }
  function quando(x) { return x && x.toDate ? x.toDate() : x instanceof Date ? x : null; }
  function dataTxt(x) {
    var d = quando(x); if (!d) d = new Date();
    return d.toLocaleDateString(I ? I.locale() : "pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function dataIso(iso) { if (!iso) return ""; var p = iso.split("-"); return dataTxt(new Date(+p[0], +p[1] - 1, +p[2])); }
  function ms(x) { var d = quando(x); return d ? d.getTime() : Date.now(); }
  function tipoNome(id) { var o = TIPOS_DOC.filter(function (x) { return x.id === id; })[0]; return t(o ? o.nome : "Outro"); }
  function mensagem(el, txt, ok) { if (!el) return; el.className = "form__msg " + (ok ? "is-ok" : txt ? "is-err" : ""); el.textContent = txt || ""; }
  function abrir(dlg) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
  function fechar(dlg) { if (dlg.open) dlg.close(); }

  /* ---------------- quem está vendo ---------------- */
  function calcularEstado() {
    if (!FB.ativo() || !usuario) return "anon";
    if (admin) return "membro";
    if (!pedido) return "pedir";
    return pedido.status === "aprovado" ? "membro" : pedido.status === "recusado" ? "recusado" : "pendente";
  }
  function recarregarPedido() {
    if (!usuario) { estado = "anon"; pintar(); return Promise.resolve(); }
    return Promise.all([FB.meuPedido().catch(function () { return null; }), FB.minhaInstituicao().catch(function () { return null; })])
      .then(function (r) {
        var antes = estado;
        pedido = r[0]; minhaInst = (r[1] && r[1].nome) || (pedido && pedido.instituicao) || "";
        estado = calcularEstado();
        if (estado !== antes) { carregado = false; dados = vazio(); }
        pintar();
      });
  }
  FB.aoMudarUsuario(function (u) {
    var trocou = (u && u.uid) !== (usuario && usuario.uid);
    usuario = u; admin = FB.isAdmin(u);
    if (trocou) { pedido = null; carregado = false; dados = vazio(); }
    if (!u) { estado = "anon"; pintar(); return; }
    if (trocou) { estado = "carregando"; pintar(); }
    recarregarPedido();
  });
  // Quem está aguardando aprovação vê a liberação ao voltar para a aba.
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && usuario && (estado === "pendente" || estado === "recusado") && rota().view === "area") recarregarPedido();
  });

  /* ---------------- desenho da página ---------------- */
  function pintar() {
    var r = rota(); if (r.view !== "area") return;
    $$("[data-area]").forEach(function (el) { el.hidden = el.getAttribute("data-area") !== estado; });
    $("[data-area-off]").hidden = FB.ativo();
    $$("[data-so-admin]").forEach(function (el) { el.hidden = !admin; });
    if (estado === "pedir") {
      var f = $("[data-form-pedido]");
      if (!f.instituicao.value) f.instituicao.value = minhaInst;
      var ok = !!(usuario && usuario.emailVerified);
      $("[data-area-verificar]").hidden = ok;
      $("button[type=submit]", f).disabled = !ok;
    }
    if (estado === "pendente" && pedido) {
      $("[data-area-pedido-info]").textContent = t("Pedido feito em {data} por {email}, pela instituição {inst}.", { data: dataTxt(pedido.pedidoEm), email: usuario.email, inst: pedido.instituicao });
    }
    if (estado === "membro") {
      var aba = r.sub[0] || "indicadores";
      if (ABAS.indexOf(aba) === -1 || (aba === "pedidos" && !admin)) aba = "indicadores";
      $$("[data-area-tab]").forEach(function (a) { a.setAttribute("aria-selected", String(a.getAttribute("data-area-tab") === aba)); });
      $$("[data-area-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-area-panel") !== aba; });
      if (!carregado) $("[data-indicadores]").innerHTML = '<p class="note">' + esc(t("Carregando…")) + "</p>";
      garantirDados().then(pintarMembro);
    }
  }
  function garantirDados(forcar) {
    if (carregado && !forcar) return Promise.resolve();
    if (carregando && !forcar) return carregando;
    var cols = ["indicadores", "documentos", "notas"].concat(admin ? ["membros"] : []);
    carregando = Promise.all(cols.map(function (c) { return FB.daArea(c).catch(function () { return null; }); }))
      .then(function (r) {
        var falhou = r.some(function (x) { return x === null; });
        cols.forEach(function (c, i) { dados[c] = r[i] || []; });
        carregado = !falhou; carregando = null;
        if (falhou) mensagem($("[data-msg-importar]"), t("Não foi possível carregar tudo agora. Recarregue a página em instantes."));
      });
    return carregando;
  }
  function pintarMembro() {
    if (rota().view !== "area" || estado !== "membro") return;
    pintarIndicadores(); pintarDocs(); pintarNotas(); if (admin) pintarPedidos();
  }

  /* ---------------- indicadores ---------------- */
  function linhasDe(ind) { try { var l = JSON.parse(ind.dados || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function ordenar(lista) {
    return lista.slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0) || String(a.titulo).localeCompare(String(b.titulo)); });
  }
  function htmlIndicador(ind, gestao) {
    var linhas = linhasDe(ind), cols = ind.colunas || [], corpo;
    if (ind.exibir === "cartoes" && ind.valor >= 0 && ind.valor < cols.length) {
      var itens = linhas.filter(function (l) { return String(l[ind.valor] == null ? "" : l[ind.valor]).trim() !== ""; }).slice(0, 60);
      corpo = '<ul class="kpi-cards" data-no-i18n>' + itens.map(function (l) {
        var det = ind.detalhe >= 0 && l[ind.detalhe] ? '<small>' + esc(cols[ind.detalhe]) + ": " + esc(l[ind.detalhe]) + "</small>" : "";
        return "<li><strong>" + esc(l[ind.valor]) + "</strong><span>" + esc(ind.rotulo >= 0 ? l[ind.rotulo] : "") + "</span>" + det + "</li>";
      }).join("") + "</ul>";
    } else {
      corpo = '<div class="table-wrap kpi-tabela" tabindex="0" data-no-i18n><table><thead><tr>' + cols.map(function (c) { return '<th scope="col">' + esc(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>" + linhas.slice(0, MAX_TABELA).map(function (l) {
          return "<tr>" + cols.map(function (c, i) { return "<td>" + esc(l[i] == null ? "" : l[i]) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table></div>" +
        (linhas.length > MAX_TABELA ? '<p class="note">' + esc(t("Mostrando as primeiras {n} linhas de {total}.", { n: MAX_TABELA, total: linhas.length })) + "</p>" : "");
    }
    var meta = t("Atualizado em {data}", { data: dataTxt(ind.atualizadoEm) });
    return '<article class="kpi">' +
      '<header class="kpi__head"><div><h3 data-no-i18n>' + esc(ind.titulo) + "</h3>" + (ind.descricao ? '<p class="kpi__desc" data-no-i18n>' + esc(ind.descricao) + "</p>" : "") + "</div>" +
      (gestao ? '<span class="badge ' + (ind.publico ? "badge--ok" : "") + '">' + esc(t(ind.publico ? "Público" : "Só membros")) + "</span>" : "") + "</header>" +
      corpo +
      '<p class="kpi__meta">' + esc(meta) + (gestao && admin ? ' · <span data-no-i18n>' + esc(ind.arquivo) + (ind.aba ? " › " + esc(ind.aba) : "") + "</span>" : "") + "</p>" +
      (gestao && admin ? '<div class="kpi__acoes"><button class="btn btn--ghost btn--small" type="button" data-ind-editar="' + esc(ind.id) + '">' + esc(t("Editar")) + "</button>" +
        '<button class="btn btn--ghost btn--small btn--danger-ghost" type="button" data-ind-excluir="' + esc(ind.id) + '">' + esc(t("Excluir")) + "</button></div>" : "") +
      "</article>";
  }
  function pintarIndicadores() {
    var box = $("[data-indicadores]"), lista = ordenar(dados.indicadores);
    box.innerHTML = lista.length ? lista.map(function (i) { return htmlIndicador(i, true); }).join("")
      : '<p class="mine__vazio">' + esc(t(admin ? "Nenhum indicador ainda. Use \"Importar planilha\" para trazer os KPIs do Drive." : "Nenhum indicador publicado ainda. A coordenação do ELI importa as planilhas de KPIs aqui.")) + "</p>";
  }

  /* importação */
  var xlsxPronto = null;
  function carregarXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPronto) return xlsxPronto;
    xlsxPronto = new Promise(function (ok, erro) {
      var s = document.createElement("script");
      s.src = XLSX_URL; s.integrity = XLSX_SRI; s.crossOrigin = "anonymous";
      s.onload = function () { ok(window.XLSX); };
      s.onerror = function () { xlsxPronto = null; erro(new Error("xlsx")); };
      document.head.appendChild(s);
    });
    return xlsxPronto;
  }
  function msgImp(txt, ok) { mensagem($("[data-msg-importar]"), txt, ok); }
  $("[data-importar]").addEventListener("change", function (ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { msgImp(t("Arquivo grande demais (máximo de 15 MB).")); return; }
    msgImp(t("Lendo a planilha…"), true);
    var csv = /\.csv$/i.test(f.name);
    carregarXLSX().then(function (X) {
      return (csv ? f.text().then(function (txt) { return X.read(txt, { type: "string", raw: false }); })
        : f.arrayBuffer().then(function (buf) { return X.read(buf, { type: "array" }); }))
        .then(function (wb) { abrirImportacao(X, f.name, wb); msgImp(""); });
    }).catch(function () { msgImp(t("Não foi possível ler o arquivo. Confira se é .xlsx ou .csv.")); });
  });

  function linhasBrutas(X, ws) {
    return X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: false })
      .map(function (r) { return r.map(function (c) { return String(c == null ? "" : c).trim(); }); })
      .filter(function (r) { return r.some(function (c) { return c !== ""; }); });
  }
  // Cabeçalho: a primeira linha que preenche pelo menos metade das colunas usadas.
  function cabecalhoAuto(rows) {
    var larg = 0; rows.forEach(function (r) { larg = Math.max(larg, r.filter(function (c) { return c !== ""; }).length); });
    for (var i = 0; i < Math.min(rows.length, 20); i++) {
      var n = rows[i].filter(function (c) { return c !== ""; }).length;
      if (n >= Math.max(1, Math.ceil(larg / 2))) return i;
    }
    return 0;
  }
  function extrair(rows, cab) {
    rows = rows.slice(cab);
    if (!rows.length) return null;
    var ncol = 0; rows.forEach(function (r) { ncol = Math.max(ncol, r.length); });
    var usadas = []; for (var c = 0; c < ncol; c++) if (rows.some(function (r) { return (r[c] || "") !== ""; })) usadas.push(c);
    usadas = usadas.slice(0, MAX_COLS);
    rows = rows.map(function (r) { return usadas.map(function (c) { return String(r[c] || "").slice(0, 500); }); });
    var colunas = rows[0].map(function (c, i) { return (c || t("Coluna {n}", { n: i + 1 })).slice(0, 80); });
    return { colunas: colunas, linhas: rows.slice(1, MAX_LINHAS + 1), total: rows.length - 1 };
  }
  function base(nome) { return String(nome || "").replace(/\.(xlsx|xlsm|xls|csv)$/i, "").trim().toLowerCase(); }
  function existente(arquivo, aba) {
    return dados.indicadores.filter(function (x) { return base(x.arquivo) === base(arquivo) && x.aba === aba; })[0] || null;
  }
  function abrirImportacao(X, nome, wb) {
    var info = (wb.Workbook && wb.Workbook.Sheets) || [];
    imp = { nome: nome, abas: wb.SheetNames.map(function (n, i) {
      var rows = linhasBrutas(X, wb.Sheets[n]);
      return { nome: /\.csv$/i.test(nome) ? "" : n, rotulo: n, rows: rows, cab: cabecalhoAuto(rows), oculta: !!(info[i] && info[i].Hidden) };
    }) };
    $("[data-imp-arquivo]").textContent = nome;
    $("[data-imp-abas]").innerHTML = imp.abas.map(function (a, i) {
      var ex = existente(nome, a.nome), vaz = !a.rows.length;
      return '<fieldset class="imp-aba' + (vaz ? " is-vazia" : "") + '">' +
        '<legend><label class="check"><input type="checkbox" data-imp-usar="' + i + '"' + (vaz ? " disabled" : !a.oculta ? " checked" : "") + "> " +
        "<strong>" + esc(a.nome ? t("Aba {nome}", { nome: a.rotulo }) : t("Arquivo CSV")) + "</strong></label></legend>" +
        (vaz ? '<p class="note">' + esc(t("Aba vazia.")) + "</p>" :
          (ex ? '<p class="note"><span class="badge">' + esc(t("Já importada")) + "</span> " + esc(t("O quadro \"{titulo}\" será atualizado com estes dados.", { titulo: ex.titulo })) + "</p>" : "") +
          (a.oculta ? '<p class="note">' + esc(t("Aba oculta na planilha: desmarcada.")) + "</p>" : "") +
          '<div class="imp-campos"><div class="field"><label for="imp-t-' + i + '">' + esc(t("Título do quadro")) + '</label><input id="imp-t-' + i + '" data-imp-titulo="' + i + '" maxlength="120" value="' + esc(ex ? ex.titulo : (a.nome || base(nome) || "Indicadores")) + '"></div>' +
          '<div class="field"><label for="imp-c-' + i + '">' + esc(t("Cabeçalho na linha")) + '</label><input id="imp-c-' + i + '" type="number" min="1" max="20" data-imp-cab="' + i + '" value="' + (a.cab + 1) + '"></div></div>' +
          '<div class="imp-previa" data-imp-previa="' + i + '" data-no-i18n>' + previa(a) + "</div>") +
        "</fieldset>";
    }).join("");
    mensagem($("[data-form-importar] [data-msg]"), "");
    abrir($("[data-importar-modal]"));
  }
  function previa(a) {
    var x = extrair(a.rows, a.cab); if (!x) return "";
    return '<p class="note">' + esc(t("{n} linhas e {c} colunas", { n: x.total, c: x.colunas.length })) + "</p>" +
      '<div class="table-wrap"><table><thead><tr>' + x.colunas.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      x.linhas.slice(0, 4).map(function (l) { return "<tr>" + l.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  $("[data-imp-abas]").addEventListener("input", function (ev) {
    var c = ev.target.closest("[data-imp-cab]"); if (!c || !imp) return;
    var i = +c.getAttribute("data-imp-cab"), a = imp.abas[i];
    a.cab = Math.max(0, Math.min(19, (parseInt(c.value, 10) || 1) - 1));
    $('[data-imp-previa="' + i + '"]').innerHTML = previa(a);
  });
  $("[data-form-importar]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var msg = $("[data-msg]", ev.target), btn = $("button[type=submit]", ev.target);
    var escolhidas = $$("[data-imp-usar]:checked").map(function (c) { return +c.getAttribute("data-imp-usar"); });
    if (!escolhidas.length) { mensagem(msg, t("Marque pelo menos uma aba.")); return; }
    var tarefas = [], problemas = [];
    escolhidas.forEach(function (i, k) {
      var a = imp.abas[i], x = extrair(a.rows, a.cab); if (!x) return;
      var json = JSON.stringify(x.linhas);
      if (new TextEncoder().encode(json).length > MAX_DADOS) { problemas.push(a.rotulo); return; } // limite do banco: 1 MB por documento
      var ex = existente(imp.nome, a.nome), n = x.colunas.length;
      var titulo = ($('[data-imp-titulo="' + i + '"]').value || a.rotulo).trim().slice(0, 120);
      if (titulo.length < 2) titulo = a.rotulo.slice(0, 120) || "Indicadores";
      var o = {
        titulo: titulo, descricao: ex ? ex.descricao || "" : "", arquivo: imp.nome.slice(0, 160), aba: a.nome.slice(0, 100),
        colunas: x.colunas, dados: json, linhas: x.linhas.length,
        exibir: ex ? ex.exibir : "tabela",
        rotulo: ex && ex.rotulo < n ? ex.rotulo : 0, valor: ex && ex.valor < n ? ex.valor : Math.min(1, n - 1), detalhe: ex && ex.detalhe < n ? ex.detalhe : -1,
        publico: ex ? !!ex.publico : false, ordem: ex ? ex.ordem || 0 : dados.indicadores.length + k
      };
      tarefas.push(function () { return FB.salvarArea("indicadores", ex ? ex.id : null, o); });
    });
    if (!tarefas.length) { mensagem(msg, t("A planilha é grande demais para um quadro. Divida em abas menores: {abas}.", { abas: problemas.join(", ") })); return; }
    btn.disabled = true; mensagem(msg, t("Importando…"), true);
    tarefas.reduce(function (p, f) { return p.then(f); }, Promise.resolve())
      .then(function () { return garantirDados(true); })
      .then(function () {
        fechar($("[data-importar-modal]")); pintarMembro();
        msgImp(t("{n} quadro(s) importado(s).", { n: tarefas.length }) + (problemas.length ? " " + t("Ficaram de fora por serem grandes demais: {abas}.", { abas: problemas.join(", ") }) : ""), !problemas.length);
      })
      .catch(function (e) { mensagem(msg, FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });
  $("[data-fechar-importar]").addEventListener("click", function () { fechar($("[data-importar-modal]")); });

  /* editar quadro */
  function opcoesColunas(sel, cols, valor, opcional) {
    sel.innerHTML = (opcional ? '<option value="-1">' + esc(t("Nenhuma")) + "</option>" : "") +
      cols.map(function (c, i) { return '<option value="' + i + '"' + (i === valor ? " selected" : "") + ' data-no-i18n>' + esc(c) + "</option>"; }).join("");
    if (opcional && valor < 0) sel.value = "-1";
  }
  function alternarCartao() { var c = $("[data-q-exibir]").value === "cartoes"; $$("[data-q-cartao]").forEach(function (el) { el.hidden = !c; }); }
  $("[data-q-exibir]").addEventListener("change", alternarCartao);
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-ind-editar]");
    if (b) {
      indEditando = dados.indicadores.filter(function (x) { return x.id === b.getAttribute("data-ind-editar"); })[0]; if (!indEditando) return;
      var f = $("[data-form-ind]"), cols = indEditando.colunas || [];
      f.titulo.value = indEditando.titulo || ""; f.descricao.value = indEditando.descricao || "";
      f.exibir.value = indEditando.exibir || "tabela"; f.ordem.value = indEditando.ordem || 0; f.publico.checked = !!indEditando.publico;
      opcoesColunas(f.rotulo, cols, indEditando.rotulo, false); opcoesColunas(f.valor, cols, indEditando.valor, false); opcoesColunas(f.detalhe, cols, indEditando.detalhe, true);
      alternarCartao(); mensagem($("[data-msg]", f), "");
      abrir($("[data-ind-modal]"));
      return;
    }
    var x = ev.target.closest("[data-ind-excluir]");
    if (x) {
      var ind = dados.indicadores.filter(function (i) { return i.id === x.getAttribute("data-ind-excluir"); })[0];
      if (!ind || !confirm(t("Excluir o quadro \"{titulo}\"? A planilha no Drive não é afetada.", { titulo: ind.titulo }))) return;
      x.disabled = true;
      FB.excluirArea("indicadores", ind.id).then(function () {
        dados.indicadores = dados.indicadores.filter(function (i) { return i.id !== ind.id; }); pintarIndicadores();
      }).catch(function (e) { alert(FB.msg(e)); x.disabled = false; });
    }
  });
  $("[data-form-ind]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $("[data-msg]", f), btn = $("button[type=submit]", f);
    if (!indEditando) return;
    var titulo = f.titulo.value.trim();
    if (titulo.length < 2) { mensagem(msg, t("Dê um título ao quadro.")); f.titulo.focus(); return; }
    var o = Object.assign({}, indEditando);
    delete o.id;
    Object.assign(o, {
      titulo: titulo.slice(0, 120), descricao: f.descricao.value.trim().slice(0, 400), exibir: f.exibir.value,
      ordem: Math.max(0, Math.min(999, parseInt(f.ordem.value, 10) || 0)),
      rotulo: parseInt(f.rotulo.value, 10) || 0, valor: parseInt(f.valor.value, 10) || 0, detalhe: parseInt(f.detalhe.value, 10),
      publico: f.publico.checked
    });
    if (isNaN(o.detalhe)) o.detalhe = -1;
    btn.disabled = true;
    FB.salvarArea("indicadores", indEditando.id, o).then(function () { return garantirDados(true); })
      .then(function () { fechar($("[data-ind-modal]")); pintarIndicadores(); })
      .catch(function (e) { mensagem(msg, FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });
  $("[data-fechar-ind]").addEventListener("click", function () { fechar($("[data-ind-modal]")); });

  /* ---------------- documentos ---------------- */
  // Prévia dentro do site para arquivos e pastas do Google Drive.
  function linkPrevia(u) {
    var m;
    if ((m = u.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/))) return "https://docs.google.com/" + m[1] + "/d/" + m[2] + "/preview";
    if ((m = u.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/))) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    if ((m = u.match(/^https:\/\/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/))) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    if ((m = u.match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/))) return "https://drive.google.com/embeddedfolderview?id=" + m[1] + "#list";
    return "";
  }
  function eDrive(u) { return /^https:\/\/(drive|docs)\.google\.com\//.test(u); }
  var ICONES = {
    relatorio: '<path d="M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6" />',
    ata: '<path d="M6 4h12v17H6z M9 8h6 M9 12h6 M9 16h4" />',
    apresentacao: '<path d="M3 4h18v11H3z M12 15v5 M8 20h8" />',
    planilha: '<path d="M4 4h16v16H4z M4 10h16 M4 15h16 M10 4v16" />',
    outro: '<path d="M7 3h7l5 5v13H7z M14 3v5h5" />'
  };
  function htmlDoc(d, gestao) {
    var podeEditar = gestao && (admin || (usuario && d.dono === usuario.uid));
    var url = safeUrl(d.url) ? d.url : "", prev = url ? linkPrevia(url) : "";
    var meta = [tipoNome(d.tipo)];
    if (d.data) meta.push(dataIso(d.data));
    return '<li class="doc">' +
      '<span class="doc__ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' + (ICONES[d.tipo] || ICONES.outro) + "</svg></span>" +
      '<div class="doc__txt"><strong data-no-i18n>' + esc(d.titulo) + "</strong>" +
      '<span class="doc__meta">' + esc(meta.join(" · ")) + (d.instituicao ? ' · <span data-no-i18n>' + esc(d.instituicao) + "</span>" : "") +
      (gestao && d.publico ? ' <span class="badge badge--ok">' + esc(t("Público")) + "</span>" : "") + "</span>" +
      (d.descricao ? '<p data-no-i18n>' + esc(d.descricao) + "</p>" : "") + "</div>" +
      '<div class="doc__acoes">' +
      (prev ? '<button class="btn btn--small" type="button" data-doc-ver="' + esc(d.id) + '">' + esc(t("Ver aqui")) + "</button>" : "") +
      (url ? '<a class="btn btn--ghost btn--small" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(t(eDrive(url) ? "Abrir no Drive" : "Abrir")) + "</a>" : "") +
      (podeEditar ? '<button class="btn btn--ghost btn--small" type="button" data-doc-editar="' + esc(d.id) + '">' + esc(t("Editar")) + "</button>" +
        '<button class="btn btn--ghost btn--small btn--danger-ghost" type="button" data-doc-excluir="' + esc(d.id) + '">' + esc(t("Excluir")) + "</button>" : "") +
      (gestao && admin ? '<button class="btn btn--ghost btn--small" type="button" data-doc-publico="' + esc(d.id) + '">' + esc(t(d.publico ? "Tirar do site aberto" : "Tornar público")) + "</button>" : "") +
      "</div></li>";
  }
  function ordemDocs(lista) {
    return lista.slice().sort(function (a, b) { return (b.data || "").localeCompare(a.data || "") || ms(b.criadoEm) - ms(a.criadoEm); });
  }
  function pintarDocs() {
    var cont = {}; dados.documentos.forEach(function (d) { cont[d.tipo] = (cont[d.tipo] || 0) + 1; });
    $("[data-doc-filtro]").innerHTML = [{ id: "", nome: "Todos" }].concat(TIPOS_DOC).filter(function (o) { return !o.id || cont[o.id]; }).map(function (o) {
      var n = o.id ? cont[o.id] : dados.documentos.length;
      return '<button type="button" aria-pressed="' + (filtroDoc === o.id) + '" data-doc-tipo="' + o.id + '">' + esc(t(o.nome)) + " <span>" + n + "</span></button>";
    }).join("");
    var lista = ordemDocs(dados.documentos.filter(function (d) { return !filtroDoc || d.tipo === filtroDoc; }));
    $("[data-docs]").innerHTML = lista.length ? lista.map(function (d) { return htmlDoc(d, true); }).join("")
      : '<li class="mine__vazio">' + esc(t("Nenhum documento ainda. Use \"Adicionar documento\" e cole o link do arquivo no Drive.")) + "</li>";
  }
  $("[data-doc-filtro]").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-doc-tipo]"); if (!b) return;
    filtroDoc = b.getAttribute("data-doc-tipo"); pintarDocs();
  });
  var selTipo = $("[data-sel-doc-tipo]");
  function opcoesTipo() { selTipo.innerHTML = TIPOS_DOC.map(function (o) { return '<option value="' + o.id + '">' + esc(t(o.nome)) + "</option>"; }).join(""); }
  opcoesTipo();
  function abrirFormDoc(d) {
    var f = $("[data-form-doc]");
    docEditando = d || null; f.reset(); mensagem($("[data-msg]", f), "");
    $$(".is-invalid", f).forEach(function (el) { el.classList.remove("is-invalid"); });
    if (d) { f.titulo.value = d.titulo; f.tipo.value = d.tipo; f.data.value = d.data || ""; f.url.value = d.url; f.descricao.value = d.descricao || ""; f.publico.checked = !!d.publico; }
    f.hidden = false; f.titulo.focus();
  }
  function fecharFormDoc() { $("[data-form-doc]").hidden = true; docEditando = null; }
  $("[data-novo-doc]").addEventListener("click", function () { abrirFormDoc(null); });
  $("[data-cancelar-doc]").addEventListener("click", fecharFormDoc);
  $("[data-form-doc]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $("[data-msg]", f), btn = $("button[type=submit]", f);
    var url = f.url.value.trim(); if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    var ruins = [];
    if (f.titulo.value.trim().length < 3) ruins.push(f.titulo);
    if (!/^https?:\/\/\S+\.\S+/.test(url) || url.length > 400) ruins.push(f.url);
    $$("input, select, textarea", f).forEach(function (el) { el.classList.toggle("is-invalid", ruins.indexOf(el) > -1); });
    if (ruins.length) { mensagem(msg, t("Confira os campos destacados.")); ruins[0].focus(); return; }
    var o = {
      titulo: f.titulo.value.trim().slice(0, 140), tipo: f.tipo.value, url: url, data: f.data.value || "",
      descricao: f.descricao.value.trim().slice(0, 400),
      publico: admin ? f.publico.checked : (docEditando ? !!docEditando.publico : false),
      instituicao: (docEditando ? docEditando.instituicao : minhaInst || "").slice(0, 100)
    };
    btn.disabled = true;
    FB.salvarArea("documentos", docEditando ? docEditando.id : null, o).then(function () { return garantirDados(true); })
      .then(function () { fecharFormDoc(); pintarDocs(); })
      .catch(function (e) { mensagem(msg, FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });
  function acharDoc(id, lista) { return (lista || dados.documentos).filter(function (d) { return d.id === id; })[0]; }
  var publicos = { indicadores: [], documentos: [] };
  document.addEventListener("click", function (ev) {
    var b;
    if ((b = ev.target.closest("[data-doc-ver]"))) {
      var d = acharDoc(b.getAttribute("data-doc-ver")) || acharDoc(b.getAttribute("data-doc-ver"), publicos.documentos); if (!d) return;
      $("[data-doc-titulo]").textContent = d.titulo;
      $("[data-doc-frame]").innerHTML = '<iframe src="' + esc(linkPrevia(d.url)) + '" title="' + esc(d.titulo) + '" loading="lazy" allow="autoplay" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
      var a = $("[data-doc-abrir]"); a.href = d.url;
      abrir($("[data-doc-modal]"));
      return;
    }
    if ((b = ev.target.closest("[data-doc-editar]"))) { abrirFormDoc(acharDoc(b.getAttribute("data-doc-editar"))); return; }
    if ((b = ev.target.closest("[data-doc-excluir]"))) {
      var x = acharDoc(b.getAttribute("data-doc-excluir"));
      if (!x || !confirm(t("Excluir \"{titulo}\" da Área dos Atores? O arquivo no Drive não é apagado.", { titulo: x.titulo }))) return;
      b.disabled = true;
      FB.excluirArea("documentos", x.id).then(function () { dados.documentos = dados.documentos.filter(function (d) { return d.id !== x.id; }); pintarDocs(); })
        .catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
      return;
    }
    if ((b = ev.target.closest("[data-doc-publico]"))) {
      var p = acharDoc(b.getAttribute("data-doc-publico")); if (!p) return;
      if (!p.publico && !confirm(t("Mostrar \"{titulo}\" para todos na página Governança? Lembre de liberar o arquivo no Drive para \"qualquer pessoa com o link\".", { titulo: p.titulo }))) return;
      var o = Object.assign({}, p); delete o.id; o.publico = !p.publico;
      b.disabled = true;
      FB.salvarArea("documentos", p.id, o).then(function () { return garantirDados(true); }).then(pintarDocs)
        .catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
    }
  });
  $("[data-fechar-doc]").addEventListener("click", function () { fechar($("[data-doc-modal]")); });
  $("[data-doc-modal]").addEventListener("close", function () { $("[data-doc-frame]").innerHTML = ""; });

  /* ---------------- anotações ---------------- */
  function pintarNotas() {
    var lista = dados.notas.slice().sort(function (a, b) { return ms(b.criadoEm) - ms(a.criadoEm); });
    $("[data-notas]").innerHTML = lista.length ? lista.map(function (n) {
      var meu = usuario && n.dono === usuario.uid, editada = ms(n.atualizadoEm) - ms(n.criadoEm) > 60000;
      return '<li class="nota"><p class="nota__txt" data-no-i18n>' + esc(n.texto) + "</p>" +
        '<p class="nota__meta"><span data-no-i18n>' + esc(n.instituicao || t("Membro do ELI")) + "</span> · " + esc(dataTxt(n.criadoEm)) + (editada ? " · " + esc(t("editada")) : "") + "</p>" +
        (meu || admin ? '<div class="nota__acoes">' + (meu ? '<button class="linklike" type="button" data-nota-editar="' + esc(n.id) + '">' + esc(t("Editar")) + "</button>" : "") +
          '<button class="linklike" type="button" data-nota-excluir="' + esc(n.id) + '">' + esc(t("Excluir")) + "</button></div>" : "") + "</li>";
    }).join("") : '<li class="mine__vazio">' + esc(t("Nenhuma anotação ainda. Escreva a primeira.")) + "</li>";
  }
  function limparNota() {
    var f = $("[data-form-nota]"); notaEditando = null; f.reset();
    $("[data-cancelar-nota]").hidden = true; $("button[type=submit]", f).textContent = t("Publicar anotação");
  }
  $("[data-form-nota]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $("[data-msg]", f), btn = $("button[type=submit]", f), txt = f.texto.value.trim();
    if (!txt) { mensagem(msg, t("Escreva a anotação.")); f.texto.focus(); return; }
    var o = notaEditando ? { texto: txt.slice(0, 2000) } : { texto: txt.slice(0, 2000), instituicao: (minhaInst || "").slice(0, 100) };
    btn.disabled = true; mensagem(msg, "");
    FB.salvarArea("notas", notaEditando ? notaEditando.id : null, o).then(function () { return garantirDados(true); })
      .then(function () { limparNota(); pintarNotas(); })
      .catch(function (e) { mensagem(msg, FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });
  $("[data-cancelar-nota]").addEventListener("click", limparNota);
  document.addEventListener("click", function (ev) {
    var b;
    if ((b = ev.target.closest("[data-nota-editar]"))) {
      notaEditando = dados.notas.filter(function (n) { return n.id === b.getAttribute("data-nota-editar"); })[0]; if (!notaEditando) return;
      var f = $("[data-form-nota]"); f.texto.value = notaEditando.texto; f.texto.focus();
      $("[data-cancelar-nota]").hidden = false; $("button[type=submit]", f).textContent = t("Salvar anotação");
      return;
    }
    if ((b = ev.target.closest("[data-nota-excluir]"))) {
      var id = b.getAttribute("data-nota-excluir");
      if (!confirm(t("Excluir esta anotação?"))) return;
      b.disabled = true;
      FB.excluirArea("notas", id).then(function () { dados.notas = dados.notas.filter(function (n) { return n.id !== id; }); pintarNotas(); })
        .catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
    }
  });

  /* ---------------- pedidos de acesso (Admin) ---------------- */
  function pintarPedidos() {
    var grupos = { pendente: [], aprovado: [], recusado: [] };
    dados.membros.forEach(function (m) { (grupos[m.status] || grupos.pendente).push(m); });
    var n = grupos.pendente.length, badge = $("[data-pendentes]");
    badge.hidden = !n; badge.textContent = n;
    Object.keys(grupos).forEach(function (st) {
      var ul = $('[data-pedidos="' + st + '"]');
      var lista = grupos[st].sort(function (a, b) { return ms(b.pedidoEm) - ms(a.pedidoEm); });
      ul.innerHTML = lista.length ? lista.map(function (m) {
        var botoes = st === "pendente"
          ? '<button class="btn btn--small" type="button" data-decidir="' + esc(m.id) + '" data-status="aprovado">' + esc(t("Aprovar")) + "</button>" +
            '<button class="btn btn--ghost btn--small btn--danger-ghost" type="button" data-decidir="' + esc(m.id) + '" data-status="recusado">' + esc(t("Recusar")) + "</button>"
          : st === "aprovado"
            ? '<button class="btn btn--ghost btn--small btn--danger-ghost" type="button" data-decidir="' + esc(m.id) + '" data-status="recusado">' + esc(t("Remover acesso")) + "</button>"
            : '<button class="btn btn--ghost btn--small" type="button" data-decidir="' + esc(m.id) + '" data-status="aprovado">' + esc(t("Aprovar")) + "</button>";
        return '<li class="mine__item"><div><strong data-no-i18n>' + esc(m.email) + "</strong>" +
          '<span data-no-i18n>' + esc([m.nome, m.instituicao].filter(Boolean).join(" · ")) + "</span><span>" + esc(t("pedido em {data}", { data: dataTxt(m.pedidoEm) })) + "</span>" +
          (m.mensagem ? '<p class="pedido__msg" data-no-i18n>' + esc(m.mensagem) + "</p>" : "") + "</div>" +
          '<div class="mine__acoes">' + botoes + "</div></li>";
      }).join("") : '<li class="mine__vazio">' + esc(t(st === "pendente" ? "Nenhum pedido aguardando." : "Ninguém nesta lista.")) + "</li>";
    });
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-decidir]"); if (!b) return;
    var id = b.getAttribute("data-decidir"), st = b.getAttribute("data-status");
    var m = dados.membros.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    if (st === "recusado" && m.status === "aprovado" && !confirm(t("Remover o acesso de {email}?", { email: m.email }))) return;
    b.disabled = true;
    FB.decidirMembro(id, st).then(function () { m.status = st; pintarPedidos(); })
      .catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
  });

  /* ---------------- pedir ou cancelar acesso ---------------- */
  $("[data-form-pedido]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $("[data-msg]", f), btn = $("button[type=submit]", f), inst = f.instituicao.value.trim();
    if (inst.length < 2) { mensagem(msg, t("Informe a instituição.")); f.instituicao.classList.add("is-invalid"); f.instituicao.focus(); return; }
    f.instituicao.classList.remove("is-invalid");
    btn.disabled = true;
    FB.pedirAcesso({ instituicao: inst.slice(0, 100), mensagem: f.mensagem.value.trim().slice(0, 300) })
      .then(function () { APP.hit && APP.hit("pedido_acesso", ""); return recarregarPedido(); })
      .catch(function (e) { mensagem(msg, FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-cancelar-pedido]"); if (!b) return;
    b.disabled = true;
    FB.cancelarPedido().then(recarregarPedido).catch(function (e) { alert(FB.msg(e)); }).then(function () { b.disabled = false; });
  });

  /* ---------------- parte pública do site ---------------- */
  function pintarPublicoIndicadores() {
    var sec = $("[data-publico-indicadores]"); if (!sec || !FB.ativo()) return;
    FB.listaPublica("indicadores").then(function (l) {
      publicos.indicadores = l;
      sec.hidden = !l.length;
      $("[data-indicadores-publicos]").innerHTML = ordenar(l).map(function (i) { return htmlIndicador(i, false); }).join("");
    }).catch(function () { sec.hidden = true; });
  }
  function pintarPublicoDocs() {
    var sec = $("[data-publico-docs]"); if (!sec || !FB.ativo()) return;
    FB.listaPublica("documentos").then(function (l) {
      publicos.documentos = l;
      sec.hidden = !l.length;
      $("[data-docs-publicos]").innerHTML = ordemDocs(l).map(function (d) { return htmlDoc(d, false); }).join("");
    }).catch(function () { sec.hidden = true; });
  }

  function aoRota(r) {
    if (r.view === "area") pintar();
    if (r.view === "inicio") pintarPublicoIndicadores();
    if (r.view === "governanca") pintarPublicoDocs();
  }
  document.addEventListener("eli:rota", function (ev) { aoRota(ev.detail); });
  if (I && I.aoMudar) I.aoMudar(function () {
    opcoesTipo();
    var r = rota();
    if (r.view === "area" && estado === "membro") pintarMembro();
    if (r.view === "inicio" && publicos.indicadores.length) pintarPublicoIndicadores();
    if (r.view === "governanca" && publicos.documentos.length) pintarPublicoDocs();
  });
  aoRota(rota());
})();
