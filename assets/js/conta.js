/* ==========================================================
   ELI Pouso Alegre — contas de usuário e "Minha conta"
   Entrar/criar conta (Google ou e-mail e senha), menu do usuário,
   perfil da instituição (Vitrine), meus eventos e meus programas.
   Depende de: i18n.js, catalogos.js, fb.js, app.js (window.ELI_APP).
   ========================================================== */
(function () {
  "use strict";
  var FB = window.ELI_FB, APP = window.ELI_APP, I = window.ELI_I18N;
  if (!FB || !APP) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = APP.t, esc = APP.esc;

  var usuario = null, instituicao = null, meus = { eventos: [], programas: [] };
  var intencao = null; // para onde ir depois de entrar
  var editando = { evento: null, programa: null };
  var logoData = null;

  /* ---------------- topo: Entrar / menu do usuário ---------------- */
  function iniciais(nome, email) {
    var p = String(nome || email || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }
  function pintarTopo() {
    var logado = !!usuario;
    $$("[data-entrar]").forEach(function (b) { b.hidden = logado && b.classList.contains("tool-entrar"); });
    var box = $("[data-user]"); if (box) box.hidden = !logado;
    if (!logado) return;
    var nome = (instituicao && (instituicao.sigla || instituicao.nome)) || usuario.displayName || usuario.email.split("@")[0];
    var av = $("[data-user-avatar]");
    if (instituicao && instituicao.logo) av.innerHTML = '<img src="' + esc(instituicao.logo) + '" alt="">';
    else if (usuario.photoURL) av.innerHTML = '<img src="' + esc(usuario.photoURL) + '" alt="" referrerpolicy="no-referrer">';
    else av.textContent = iniciais(usuario.displayName, usuario.email);
    $("[data-user-name]").textContent = nome.length > 16 ? nome.slice(0, 15) + "…" : nome;
    $("[data-user-fullname]").textContent = usuario.displayName || nome;
    $("[data-user-email]").textContent = usuario.email;
    var adm = FB.isAdmin(usuario);
    $$("[data-admin-only]").forEach(function (li) { li.hidden = !adm; });
    // Aparelho do Admin não entra nas estatísticas.
    try { if (adm) localStorage.setItem("eli-admin", JSON.stringify({ exp: Date.now() + 365 * 864e5, email: usuario.email })); } catch (e) { /* ok */ }
  }

  /* ---------------- diálogo de login ---------------- */
  var dlg = $("[data-auth]"), modoAuth = "entrar";
  function abrirAuth(destino) {
    intencao = destino || intencao;
    if (!FB.ativo()) { alert(t("O cadastro de usuários está sendo ativado. Volte em breve.")); return; }
    FB.iniciar().catch(function () { /* mostra erro ao enviar */ });
    modo("entrar");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    setTimeout(function () { var e = $("#u-email"); if (e) e.focus(); }, 50);
  }
  function fecharAuth() { if (dlg.open) dlg.close(); }
  function modo(m) {
    modoAuth = m;
    var f = $("[data-auth-form]");
    $("[data-auth-titulo]").textContent = t(m === "cadastro" ? "Criar conta" : m === "senha" ? "Recuperar senha" : "Entrar");
    $$("[data-so-cadastro]", dlg).forEach(function (el) { el.hidden = m !== "cadastro"; });
    $("[data-campo-senha]").hidden = m === "senha";
    $("#u-senha").setAttribute("autocomplete", m === "cadastro" ? "new-password" : "current-password");
    $("[data-auth-enviar]").textContent = t(m === "cadastro" ? "Criar conta" : m === "senha" ? "Enviar link de recuperação" : "Entrar");
    $('[data-auth-modo="cadastro"]').hidden = m === "cadastro";
    $('[data-auth-modo="entrar"]').hidden = m === "entrar";
    $('[data-auth-modo="senha"]').hidden = m === "senha";
    $("[data-google]").hidden = m === "senha";
    $(".auth__ou", dlg).hidden = m === "senha";
    var msg = $("[data-auth-msg]"); msg.textContent = ""; msg.className = "form__msg";
    f.querySelectorAll(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
  }
  function avisoAuth(txt, ok) { var m = $("[data-auth-msg]"); m.className = "form__msg " + (ok ? "is-ok" : "is-err"); m.textContent = txt; }

  document.addEventListener("click", function (ev) {
    var el = ev.target;
    if (el.closest("[data-entrar]")) { ev.preventDefault(); abrirAuth(); return; }
    if (el.closest("[data-fechar-auth]") || el === dlg) { fecharAuth(); return; }
    var am = el.closest("[data-auth-modo]"); if (am) { modo(am.getAttribute("data-auth-modo")); return; }
    if (el.closest("[data-google]")) {
      avisoAuth(t("Abrindo o Google…"), true);
      FB.google().then(function (r) { if (r) depoisDeEntrar(); }).catch(function (e) { avisoAuth(FB.msg(e)); });
      return;
    }
    if (el.closest("[data-sair]")) { FB.sair().then(function () { try { localStorage.removeItem("eli-admin"); } catch (e) { /* ok */ } location.hash = "inicio"; }); return; }
    var acao = el.closest("[data-acao]");
    if (acao) {
      var a = acao.getAttribute("data-acao");
      var destino = a === "novo-evento" ? "conta/eventos/novo" : a === "novo-programa" ? "conta/programas/novo" : "conta/instituicao";
      if (usuario) location.hash = destino; else abrirAuth(destino);
    }
  });

  $("[data-auth-form]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, email = f.email.value.trim(), senha = f.senha.value, nome = f.nome.value.trim();
    var ruins = [];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ruins.push(f.email);
    if (modoAuth !== "senha" && senha.length < (modoAuth === "cadastro" ? 8 : 1)) ruins.push(f.senha);
    if (modoAuth === "cadastro" && nome.length < 2) ruins.push(f.nome);
    f.querySelectorAll("input").forEach(function (i) { i.classList.toggle("is-invalid", ruins.indexOf(i) > -1); });
    if (ruins.length) { avisoAuth(t("Confira os campos destacados.")); ruins[0].focus(); return; }
    var btn = $("[data-auth-enviar]"); btn.disabled = true;
    var p = modoAuth === "cadastro" ? FB.cadastrar(nome, email, senha) : modoAuth === "senha" ? FB.recuperar(email) : FB.entrar(email, senha);
    p.then(function () {
      if (modoAuth === "senha") { avisoAuth(t("Pronto. Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha."), true); return; }
      if (modoAuth === "cadastro") intencao = intencao || "conta/instituicao";
      depoisDeEntrar();
    }).catch(function (e) { avisoAuth(FB.msg(e)); })
      .then(function () { btn.disabled = false; });
  });

  function depoisDeEntrar() {
    fecharAuth();
    var destino = intencao || "conta"; intencao = null;
    if (location.hash.replace("#", "") === destino) document.dispatchEvent(new CustomEvent("eli:rota", { detail: APP.rota() }));
    else location.hash = destino;
  }

  /* ---------------- estado do usuário ---------------- */
  FB.aoMudarUsuario(function (u) {
    usuario = u;
    if (!u) { instituicao = null; meus = { eventos: [], programas: [] }; pintarTopo(); pintarConta(); return; }
    FB.minhaInstituicao().then(function (inst) { instituicao = inst; }).catch(function () { instituicao = null; })
      .then(function () { pintarTopo(); return carregarMeus(); })
      .then(function () { pintarConta(); });
  });
  function carregarMeus() {
    return Promise.all([FB.meus("eventos"), FB.meus("programas")]).then(function (r) {
      meus.eventos = r[0].sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); });
      meus.programas = r[1].sort(function (a, b) { return String(a.titulo).localeCompare(String(b.titulo)); });
    }).catch(function () { /* sem lista */ });
  }

  /* ---------------- Minha conta ---------------- */
  document.addEventListener("eli:rota", function (ev) { if (ev.detail.view === "conta") pintarConta(); });

  function pintarConta() {
    var r = APP.rota(); if (r.view !== "conta") return;
    var anon = $("[data-conta-anon]"), logado = $("[data-conta-logado]");
    $("[data-fb-off]").hidden = FB.ativo();
    anon.hidden = !!usuario; logado.hidden = !usuario;
    if (!usuario) return;
    $("[data-conta-email]").textContent = (usuario.displayName ? usuario.displayName + " · " : "") + usuario.email;
    $("[data-conta-email2]").textContent = usuario.email;
    $("[data-verificar]").hidden = !!usuario.emailVerified;
    var aba = r.sub[0] || (instituicao ? "eventos" : "instituicao");
    if (["instituicao", "eventos", "programas"].indexOf(aba) === -1) aba = "instituicao";
    if (!instituicao && aba !== "instituicao") {
      aba = "instituicao";
      mensagem($("[data-form-inst]"), t("Antes de publicar, complete o perfil da sua instituição. Ele aparece na Vitrine e identifica quem organiza."), false);
    }
    $$("[data-tab]").forEach(function (a) { a.setAttribute("aria-selected", String(a.getAttribute("data-tab") === aba)); });
    $$("[data-tab-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-tab-panel") !== aba; });
    if (aba === "instituicao") preencherInstituicao();
    if (aba === "eventos") { listarMeus("eventos"); if (r.sub[1] === "novo") abrirEditor("evento"); else if (r.sub[1] !== "editar") fecharEditor("evento"); }
    if (aba === "programas") { listarMeus("programas"); if (r.sub[1] === "novo") abrirEditor("programa"); else if (r.sub[1] !== "editar") fecharEditor("programa"); }
  }

  // Voltou para a aba depois de clicar no link de confirmação? Atualiza na hora.
  function checarConfirmacao() {
    if (usuario && !usuario.emailVerified) FB.recarregarUsuario().catch(function () { /* ok */ });
  }
  window.addEventListener("focus", checarConfirmacao);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) checarConfirmacao(); });

  $("[data-reenviar]").addEventListener("click", function () {
    var b = this; b.disabled = true;
    FB.reenviar().then(function () { b.textContent = t("E-mail reenviado"); }).catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
  });

  /* ---------------- campos auxiliares ---------------- */
  function opcoes(sel, lista, valor) {
    sel.innerHTML = lista.map(function (o) {
      var id = typeof o === "string" ? o : o.id, nome = typeof o === "string" ? o : o.nome;
      return '<option value="' + esc(id) + '"' + (id === valor ? " selected" : "") + ">" + esc(t(nome)) + "</option>";
    }).join("");
  }
  function checks(box, nome, lista, marcados) {
    marcados = marcados || [];
    box.innerHTML = lista.map(function (o) {
      var id = typeof o === "string" ? o : o.id, rot = typeof o === "string" ? o : o.nome;
      return '<label class="check"><input type="checkbox" name="' + nome + '" value="' + esc(id) + '"' + (marcados.indexOf(id) > -1 ? " checked" : "") + "> " + esc(t(rot)) + "</label>";
    }).join("");
  }
  function marcados(form, nome) { return $$('input[name="' + nome + '"]:checked', form).map(function (c) { return c.value; }); }
  $$("[data-count-for]").forEach(function (c) {
    var campo = document.getElementById(c.getAttribute("data-count-for")), max = campo.getAttribute("maxlength");
    var upd = function () { c.textContent = t("{n} de {max}", { n: campo.value.length, max: max }); };
    campo.addEventListener("input", upd); campo.__contador = upd; upd();
  });
  function contadores(form) { $$("textarea", form).forEach(function (c) { if (c.__contador) c.__contador(); }); }
  function mensagem(form, txt, ok) { var m = $("[data-msg]", form); if (!m) return; m.className = "form__msg " + (ok ? "is-ok" : txt ? "is-err" : ""); m.textContent = txt || ""; }
  function validar(form, extra) {
    var ruins = $$("[required]", form).filter(function (el) {
      var v = el.type === "checkbox" ? el.checked : el.value.trim() && (!el.checkValidity || el.checkValidity());
      return !v;
    });
    $$("input[type=url], input[type=email]", form).forEach(function (el) { if (el.value && !el.checkValidity()) ruins.push(el); });
    (extra || []).forEach(function (el) { ruins.push(el); });
    $$("input, select, textarea", form).forEach(function (el) { el.classList.toggle("is-invalid", ruins.indexOf(el) > -1); if (ruins.indexOf(el) > -1) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); });
    if (ruins.length) { mensagem(form, t(ruins.length === 1 ? "Falta {n} campo obrigatório ou com formato inválido. Ele está destacado em vermelho." : "Faltam {n} campos obrigatórios ou com formato inválido. Eles estão destacados em vermelho.", { n: ruins.length })); ruins[0].focus(); return false; }
    return true;
  }
  function url(v) { v = String(v || "").trim(); if (v && !/^https?:\/\//i.test(v)) v = "https://" + v; return v; }

  /* ---------------- instituição ---------------- */
  var fInst = $("[data-form-inst]");
  var selHelice = $("[data-sel-helice]", fInst), selCat = $("[data-sel-categoria]", fInst);
  function preencherInstituicao() {
    var i = instituicao || {};
    opcoes(selHelice, [{ id: "", nome: "Escolha a hélice" }].concat(window.ELI_HELICES), i.helice || "");
    opcoes(selCat, catsDe(i.helice), i.categoria || "");
    checks($('[data-checks-vertentes="inst"]'), "vertentes", window.ELI_VERTENTES, i.vertentes);
    fInst.nome.value = i.nome || ""; fInst.sigla.value = i.sigla || ""; fInst.site.value = i.site || "";
    fInst.descricao.value = i.descricao || ""; fInst.areas.value = (i.areas || []).join(", ");
    fInst.instagram.value = i.instagram || ""; fInst.linkedin.value = i.linkedin || "";
    fInst.emailPublico.value = i.emailPublico || ""; fInst.telefone.value = i.telefone || ""; fInst.endereco.value = i.endereco || "";
    fInst.ativo.checked = i.ativo !== false; fInst.consentimento.checked = !!instituicao;
    logoData = i.logo || null; mostrarLogo();
    contadores(fInst);
    $("[type=submit]", fInst).textContent = t(instituicao ? "Salvar alterações" : "Salvar perfil");
  }
  function catsDe(h) { return [{ id: "", nome: "Escolha a categoria" }].concat((window.ELI_CATEGORIAS[h] || []).map(function (c) { return { id: c, nome: c }; })); }
  selHelice.addEventListener("change", function () { opcoes(selCat, catsDe(selHelice.value), ""); });

  function mostrarLogo() {
    var p = $("[data-logo-prev]");
    p.innerHTML = logoData ? '<img src="' + esc(logoData) + '" alt="">' : "<span>" + t("Sem imagem") + "</span>";
    p.classList.toggle("is-empty", !logoData);
  }
  // Reduz a imagem no próprio aparelho: quadrado de 320 px, fundo branco, WebP (ou JPEG).
  $("[data-logo-input]").addEventListener("change", function () {
    var file = this.files && this.files[0]; if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { mensagem(fInst, t("Use uma imagem PNG, JPG ou WebP.")); return; }
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        var L = 320, c = document.createElement("canvas"); c.width = L; c.height = L;
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, L, L);
        var k = Math.min((L - 24) / img.width, (L - 24) / img.height), w = img.width * k, h = img.height * k;
        g.imageSmoothingQuality = "high"; g.drawImage(img, (L - w) / 2, (L - h) / 2, w, h);
        var out = c.toDataURL("image/webp", 0.85);
        if (out.indexOf("data:image/webp") !== 0) out = c.toDataURL("image/jpeg", 0.85);
        logoData = out; mostrarLogo(); mensagem(fInst, "");
      };
      img.onerror = function () { mensagem(fInst, t("Não foi possível ler essa imagem. Tente outra.")); };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(file);
  });

  fInst.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var extra = logoData ? [] : [$("[data-logo-input]")];
    if (!logoData) $("[data-logo-prev]").classList.add("is-invalid"); else $("[data-logo-prev]").classList.remove("is-invalid");
    fInst.site.value = url(fInst.site.value); fInst.instagram.value = url(fInst.instagram.value); fInst.linkedin.value = url(fInst.linkedin.value);
    if (!validar(fInst, extra)) { if (!logoData) mensagem(fInst, t("A imagem da instituição é obrigatória: ela é o ícone clicável na Vitrine.")); return; }
    var dados = {
      nome: fInst.nome.value.trim(), sigla: fInst.sigla.value.trim(), helice: selHelice.value, categoria: selCat.value,
      site: fInst.site.value.trim(), descricao: fInst.descricao.value.trim(), vertentes: marcados(fInst, "vertentes"),
      areas: fInst.areas.value.split(",").map(function (a) { return a.trim(); }).filter(Boolean).slice(0, 12),
      instagram: fInst.instagram.value.trim(), linkedin: fInst.linkedin.value.trim(), emailPublico: fInst.emailPublico.value.trim(),
      telefone: fInst.telefone.value.trim(), endereco: fInst.endereco.value.trim(), ativo: fInst.ativo.checked, logo: logoData
    };
    salvando(fInst, true);
    FB.salvarInstituicao(dados).then(function () {
      var primeira = !instituicao;
      instituicao = dados; pintarTopo();
      document.dispatchEvent(new CustomEvent("eli:dados", { detail: { colecao: "instituicoes" } }));
      mensagem(fInst, t(primeira ? "Perfil publicado na Vitrine. Agora você já pode cadastrar eventos e programas." : "Alterações salvas."), true);
      $("[type=submit]", fInst).textContent = t("Salvar alterações");
    }).catch(function (e) { mensagem(fInst, FB.msg(e)); }).then(function () { salvando(fInst, false); });
  });
  function salvando(form, sim) { var b = $("[type=submit]", form); b.disabled = sim; form.setAttribute("aria-busy", String(sim)); }

  /* ---------------- meus eventos e programas: listas ---------------- */
  function listarMeus(col) {
    var ul = $('[data-meus="' + col + '"]'), lista = meus[col];
    if (!lista.length) { ul.innerHTML = '<li class="mine__vazio">' + t(col === "eventos" ? "Você ainda não cadastrou eventos." : "Você ainda não cadastrou programas ou ações.") + "</li>"; return; }
    ul.innerHTML = lista.map(function (o) {
      var sub = col === "eventos"
        ? APP.cap1(I.dataLonga(APP.parseD(o.data))) + (o.hora ? ", " + APP.horario(o) : "")
        : t(nomeDe(window.ELI_TIPOS_PROGRAMA, o.tipo)) + " · " + t(nomeDe(window.ELI_STATUS_PROGRAMA, o.status));
      return '<li class="mine__item' + (o.oculto ? " is-oculto" : "") + '"><div><strong data-no-i18n>' + esc(o.titulo) + "</strong><span>" + esc(sub) + "</span>" +
        (o.oculto ? '<span class="badge badge--clash">' + t("Oculto pela curadoria") + "</span>" : "") + "</div>" +
        '<div class="mine__acoes"><button class="btn btn--ghost btn--small" type="button" data-editar="' + col + ":" + esc(o.id) + '">' + t("Editar") + "</button>" +
        '<button class="btn btn--ghost btn--small btn--danger-ghost" type="button" data-apagar="' + col + ":" + esc(o.id) + '">' + t("Excluir") + "</button></div></li>";
    }).join("");
  }
  function nomeDe(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i].nome; return id || ""; }

  document.addEventListener("click", function (ev) {
    var n = ev.target.closest("[data-novo]"); if (n) { location.hash = "conta/" + (n.getAttribute("data-novo") === "evento" ? "eventos" : "programas") + "/novo"; return; }
    var ed = ev.target.closest("[data-editar]");
    if (ed) {
      var p = ed.getAttribute("data-editar").split(":"), col = p[0], id = p[1], o = meus[col].filter(function (x) { return x.id === id; })[0];
      if (o) { history.replaceState(null, "", "#conta/" + col + "/editar"); abrirEditor(col === "eventos" ? "evento" : "programa", o); }
      return;
    }
    var ap = ev.target.closest("[data-apagar]");
    if (ap) {
      var q = ap.getAttribute("data-apagar").split(":");
      if (!confirm(t("Excluir este item? Ele sai do site na hora e não há como desfazer."))) return;
      FB.excluir(q[0], q[1]).then(function () {
        meus[q[0]] = meus[q[0]].filter(function (x) { return x.id !== q[1]; });
        listarMeus(q[0]); depoisDeSalvar(q[0]);
      }).catch(function (e) { alert(FB.msg(e)); });
      return;
    }
    var c = ev.target.closest("[data-cancelar]"); if (c) { var tipoEd = c.closest("[data-editor]").getAttribute("data-editor"); location.hash = "conta/" + (tipoEd === "evento" ? "eventos" : "programas"); }
  });
  function depoisDeSalvar(col) {
    if (col === "eventos") APP.loadRemote();
    document.dispatchEvent(new CustomEvent("eli:dados", { detail: { colecao: col } }));
  }

  /* ---------------- editor de evento ---------------- */
  var fEv = $("[data-form-evento]");
  function abrirEditor(tipo, o) {
    var box = $('[data-editor="' + tipo + '"]');
    if (!usuario || !instituicao) return;
    editando[tipo] = o ? o.id : null;
    box.hidden = false;
    $("[data-editor-titulo]", box).textContent = t(tipo === "evento" ? (o ? "Editar evento" : "Novo evento") : (o ? "Editar programa ou ação" : "Novo programa ou ação"));
    if (tipo === "evento") preencherEvento(o || {}); else preencherPrograma(o || {});
    mensagem($("form", box), "");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { var f = $("input", box); if (f) f.focus({ preventScroll: true }); }, 350);
  }
  function fecharEditor(tipo) { var box = $('[data-editor="' + tipo + '"]'); if (box) box.hidden = true; editando[tipo] = null; }

  function preencherEvento(o) {
    opcoes($("[data-sel-tipo-evento]", fEv), APP.TIPOS, o.tipo || "evento");
    opcoes($("[data-sel-formato]", fEv), Object.keys(APP.FORMATOS).map(function (k) { return { id: k, nome: APP.FORMATOS[k] }; }), o.formato || "presencial");
    checks($('[data-checks-publicos="evento"]'), "publicos", APP.PUBLICOS, o.publicos);
    ["titulo", "data", "hora", "dataFim", "horaFim", "local", "link", "descricao"].forEach(function (k) { fEv[k].value = o[k] || ""; });
    fEv.organizador.value = o.organizador || (instituicao && instituicao.nome) || "";
    fEv.gratuito.checked = o.gratuito !== false;
    var hoje = APP.iso(APP.today());
    fEv.data.min = o.data && o.data < hoje ? "" : hoje; fEv.dataFim.min = fEv.data.min;
    contadores(fEv); radar();
    $("[type=submit]", fEv).textContent = t(o.id ? "Salvar alterações" : "Publicar evento");
  }
  function radar() {
    var r = APP.radarHtml(fEv.data.value, editando.evento), box = $("[data-radar]");
    box.className = r.cls; box.innerHTML = r.html;
  }
  fEv.data.addEventListener("change", radar);
  fEv.addEventListener("submit", function (ev) {
    ev.preventDefault();
    fEv.link.value = url(fEv.link.value);
    var extra = [];
    if (fEv.dataFim.value && fEv.dataFim.value < fEv.data.value) extra.push(fEv.dataFim);
    if (!validar(fEv, extra)) return;
    var d = {
      titulo: fEv.titulo.value.trim(), tipo: fEv.tipo.value, formato: fEv.formato.value, data: fEv.data.value, hora: fEv.hora.value,
      dataFim: fEv.dataFim.value, horaFim: fEv.horaFim.value, local: fEv.local.value.trim(), organizador: fEv.organizador.value.trim(),
      link: fEv.link.value.trim(), publicos: marcados(fEv, "publicos"), gratuito: fEv.gratuito.checked, descricao: fEv.descricao.value.trim(),
      instituicao: instituicao.nome, instituicaoId: usuario.uid
    };
    gravar("eventos", "evento", fEv, d);
  });

  /* ---------------- editor de programa ---------------- */
  var fPg = $("[data-form-programa]");
  function preencherPrograma(o) {
    opcoes($("[data-sel-tipo-programa]", fPg), window.ELI_TIPOS_PROGRAMA, o.tipo || "programa");
    opcoes($("[data-sel-vertente]", fPg), window.ELI_VERTENTES, o.vertente || "programas");
    opcoes($("[data-sel-status]", fPg), window.ELI_STATUS_PROGRAMA, o.status || "ativo");
    opcoes($("[data-sel-periodicidade]", fPg), window.ELI_PERIODICIDADE, o.periodicidade || "Contínuo");
    opcoes($("[data-sel-formato]", fPg), Object.keys(APP.FORMATOS).map(function (k) { return { id: k, nome: APP.FORMATOS[k] }; }), o.formato || "presencial");
    checks($('[data-checks-publicos="programa"]'), "publicos", APP.PUBLICOS, o.publicos);
    ["titulo", "descricao", "inicio", "fim", "local", "link", "parceiros"].forEach(function (k) { fPg[k].value = o[k] || ""; });
    fPg.gratuito.checked = o.gratuito !== false;
    contadores(fPg);
    $("[type=submit]", fPg).textContent = t(o.id ? "Salvar alterações" : "Publicar");
  }
  fPg.addEventListener("submit", function (ev) {
    ev.preventDefault();
    fPg.link.value = url(fPg.link.value);
    var extra = [];
    if (fPg.fim.value && fPg.inicio.value && fPg.fim.value < fPg.inicio.value) extra.push(fPg.fim);
    if (!validar(fPg, extra)) return;
    var d = {
      titulo: fPg.titulo.value.trim(), tipo: fPg.tipo.value, vertente: fPg.vertente.value, status: fPg.status.value,
      periodicidade: fPg.periodicidade.value, descricao: fPg.descricao.value.trim(), publicos: marcados(fPg, "publicos"),
      inicio: fPg.inicio.value, fim: fPg.fim.value, formato: fPg.formato.value, local: fPg.local.value.trim(), link: fPg.link.value.trim(),
      parceiros: fPg.parceiros.value.trim(), gratuito: fPg.gratuito.checked, instituicao: instituicao.nome, instituicaoId: usuario.uid,
      helice: instituicao.helice || ""
    };
    gravar("programas", "programa", fPg, d);
  });

  function gravar(col, tipo, form, dados) {
    if (!usuario.emailVerified) { mensagem(form, t("Confirme seu e-mail antes de publicar. Enviamos um link para a sua caixa de entrada.")); return; }
    salvando(form, true);
    FB.salvar(col, editando[tipo], dados).then(function () {
      return carregarMeus();
    }).then(function () {
      depoisDeSalvar(col);
      mensagem(form, t(editando[tipo] ? "Alterações salvas." : "Publicado! Já está no site."), true);
      setTimeout(function () { location.hash = "conta/" + col; }, 900);
    }).catch(function (e) { mensagem(form, FB.msg(e)); }).then(function () { salvando(form, false); });
  }

  /* ---------------- excluir conta (LGPD) ---------------- */
  $("[data-excluir-conta]").addEventListener("click", function () {
    var m = $("[data-msg-excluir]");
    if (!confirm(t("Excluir sua conta, o perfil da instituição e todos os seus eventos, programas e ações? Não há como desfazer."))) return;
    FB.excluirConta().then(function () { m.className = "form__msg is-ok"; m.textContent = t("Conta excluída."); location.hash = "inicio"; })
      .catch(function (e) { m.className = "form__msg is-err"; m.textContent = FB.msg(e); });
  });

  if (I) I.aoMudar(function () { pintarConta(); if (dlg.open) modo(modoAuth); $$("textarea").forEach(function (c) { if (c.__contador) c.__contador(); }); });
  window.ELI_CONTA = { abrirAuth: abrirAuth, usuario: function () { return usuario; }, instituicao: function () { return instituicao; } };
})();
