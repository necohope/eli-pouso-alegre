/* ==========================================================
   ELI Pouso Alegre — Painel Admin
   Login pelo Firebase (Google ou e-mail e senha); só contas da
   lista ADMINS (config.js e firestore.rules) entram. O login fica
   salvo neste aparelho e desliga a contagem de acessos dele no site.
   ========================================================== */
(function () {
  "use strict";
  var CFG = window.ELI_CONFIG || {};
  var FB = window.ELI_FB;
  var CHAVE = "eli-admin";
  var conta = null, base = { instituicoes: [], eventos: [], programas: [] }, modCol = "instituicoes";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var dias = 30;
  var ultimo = null;

  var NOMES = {
    paginas: { inicio: "O ELI (início)", agenda: "Agenda Única", governanca: "Governança", programas: "Programas e Ações", vitrine: "Vitrine", conta: "Minha conta", "vitrine/setor-produtivo": "Vitrine: Setor Produtivo", "vitrine/academia": "Vitrine: Academia e ICTs", "vitrine/setor-publico": "Vitrine: Setor Público", "vitrine/sociedade-civil": "Vitrine: Sociedade Civil" },
    acoes: { whatsapp: "Cliques no WhatsApp", cadastro_enviado: "Eventos cadastrados pelo site", evento_aberto: "Eventos abertos", salvar_agenda: "Salvos no calendário", inscricao: "Cliques em inscrição", convite_app: "Convites para instalar o app", app_instalado: "Apps instalados", site_ator: "Visitas ao site de atores (Vitrine)", perfil_aberto: "Perfis abertos na Vitrine", programa_aberto: "Programas abertos" },
    dispositivos: { celular: "Celular", computador: "Computador", tablet: "Tablet" }
  };
  var TITULOS = {};
  (window.ELI_EVENTOS || []).forEach(function (e) { TITULOS[e.id] = e.titulo; });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function sessao() { if (DEMO) return { email: "demonstração", exp: Infinity }; return conta ? { email: conta.email } : null; }
  function salvar(a) { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch (e) { /* navegação privada: login só nesta aba */ } }
  function limpar() { try { localStorage.removeItem(CHAVE); } catch (e) { /* ok */ } }

  // Modo demonstração (admin.html?demo): dados fictícios, sem login, nada é enviado.
  var DEMO = /[?&]demo\b/.test(location.search);
  function demo(corpo) {
    var n = corpo.dias || 30, serie = [], seed = 3;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000), fds = d.getDay() === 0 || d.getDay() === 6;
      var v = Math.round((fds ? 9 : 22) + rnd() * 14 + (n - i) * 0.3);
      serie.push({ dia: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), visitantes: v, paginas: Math.round(v * (2.2 + rnd())) });
    }
    var vis = serie.reduce(function (a, x) { return a + x.visitantes; }, 0), pag = serie.reduce(function (a, x) { return a + x.paginas; }, 0);
    var ids = (window.ELI_EVENTOS || []).filter(function (e) { return e.data >= "2026-10-01"; }).slice(0, 6).map(function (e) { return e.id; });
    return Promise.resolve({ ok: true, dias: n, geradoEm: "agora (demonstração)", totais: { paginas: pag, visitantes: vis, novos: Math.round(vis * 0.62), viaApp: Math.round(vis * 0.04) },
      hoje: serie[serie.length - 1], serie: serie,
      paginas: [{ nome: "agenda", total: Math.round(pag * 0.48) }, { nome: "inicio", total: Math.round(pag * 0.39) }, { nome: "governanca", total: Math.round(pag * 0.13) }],
      acoes: [{ nome: "evento_aberto", total: Math.round(vis * 0.35) }, { nome: "salvar_agenda", total: Math.round(vis * 0.08) }, { nome: "whatsapp", total: Math.round(vis * 0.05) }, { nome: "inscricao", total: Math.round(vis * 0.04) }, { nome: "convite_app", total: Math.round(vis * 0.2) }, { nome: "app_instalado", total: Math.round(vis * 0.02) }, { nome: "cadastro_enviado", total: 4 }],
      origens: [{ nome: "Direto ou app", total: Math.round(vis * 0.41) }, { nome: "instagram.com", total: Math.round(vis * 0.24) }, { nome: "google.com", total: Math.round(vis * 0.16) }, { nome: "whatsapp", total: Math.round(vis * 0.11) }, { nome: "linkedin.com", total: Math.round(vis * 0.05) }],
      eventosAbertos: ids.map(function (id, k) { return { nome: id, total: Math.round(vis * 0.1 / (k + 1)) }; }),
      dispositivos: [{ nome: "celular", total: Math.round(vis * 0.71) }, { nome: "computador", total: Math.round(vis * 0.26) }, { nome: "tablet", total: Math.round(vis * 0.03) }],
      navegadores: [{ nome: "Chrome", total: Math.round(vis * 0.58) }, { nome: "Safari", total: Math.round(vis * 0.31) }, { nome: "Samsung", total: Math.round(vis * 0.07) }, { nome: "Edge", total: Math.round(vis * 0.04) }],
      sistemas: [{ nome: "Android", total: Math.round(vis * 0.52) }, { nome: "iOS", total: Math.round(vis * 0.23) }, { nome: "Windows", total: Math.round(vis * 0.17) }, { nome: "macOS", total: Math.round(vis * 0.08) }],
      cadastros: { instituicoes: { total: 18, ocultos: 0 }, eventos: { total: 9, ocultos: 1 }, programas: { total: 14, ocultos: 0 } } });
  }

  function api(corpo) {
    if (DEMO) return demo(corpo);
    return carregarFirebase(corpo.dias || 30);
  }

  /* ---------------- dados reais (Firebase) ---------------- */
  function diaIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function carregarFirebase(dias) {
    var agora = new Date(), inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - (dias - 1));
    return Promise.all([FB.acessosDesde(inicio), FB.todos("instituicoes"), FB.todos("eventos"), FB.todos("programas")]).then(function (r) {
      base = { instituicoes: r[1], eventos: r[2], programas: r[3] };
      var linhas = r[0], porDia = {}, serie = [];
      for (var i = dias - 1; i >= 0; i--) { var k = diaIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i)); porDia[k] = { dia: k, paginas: 0, v: {} }; serie.push(k); }
      var mapas = { paginas: {}, dispositivos: {}, navegadores: {}, sistemas: {}, origens: {}, acoes: {}, eventosAbertos: {} };
      function soma(m, k) { k = k || "(não informado)"; m[k] = (m[k] || 0) + 1; }
      var visitaDia = {}, totalPag = 0, novos = 0, viaApp = 0;
      linhas.forEach(function (l) {
        if (!l.quando) return;
        var dia = diaIso(l.quando);
        if (l.tipo === "pagina") {
          totalPag++; soma(mapas.paginas, l.pagina);
          if (porDia[dia]) { porDia[dia].paginas++; porDia[dia].v[l.visitante] = 1; }
          var vk = dia + ":" + l.visitante;
          if (!visitaDia[vk]) { visitaDia[vk] = 1; soma(mapas.dispositivos, l.dispositivo); soma(mapas.navegadores, l.navegador); soma(mapas.sistemas, l.sistema); soma(mapas.origens, l.origem || "Direto ou app"); if (l.app) viaApp++; }
          if (l.novo) novos++;
        } else { soma(mapas.acoes, l.tipo); if (l.tipo === "evento_aberto") soma(mapas.eventosAbertos, l.alvo); }
      });
      var s = serie.map(function (k) { return { dia: k, paginas: porDia[k].paginas, visitantes: Object.keys(porDia[k].v).length }; });
      function top(m, max) { return Object.keys(m).map(function (k) { return { nome: k, total: m[k] }; }).sort(function (a, b) { return b.total - a.total; }).slice(0, max || 10); }
      function contar(l) { return { total: l.length, ocultos: l.filter(function (x) { return x.oculto; }).length }; }
      var hoje = s[s.length - 1];
      return {
        ok: true, dias: dias, geradoEm: agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
        totais: { paginas: totalPag, visitantes: s.reduce(function (a, x) { return a + x.visitantes; }, 0), novos: novos, viaApp: viaApp },
        hoje: { paginas: hoje.paginas, visitantes: hoje.visitantes }, serie: s,
        paginas: top(mapas.paginas), dispositivos: top(mapas.dispositivos), navegadores: top(mapas.navegadores), sistemas: top(mapas.sistemas),
        origens: top(mapas.origens, 12), acoes: top(mapas.acoes), eventosAbertos: top(mapas.eventosAbertos),
        cadastros: { instituicoes: contar(r[1]), eventos: contar(r[2]), programas: contar(r[3]) }
      };
    });
  }

  /* ---------------- telas ---------------- */
  function mostrar(qual) {
    $("[data-login]").hidden = qual !== "login";
    $("[data-painel]").hidden = qual !== "painel";
  }

  function msgLogin(txt) { var m = $("[data-login-msg]"); m.className = "form__msg is-err"; m.textContent = txt; }
  $("[data-google]").addEventListener("click", function () {
    FB.google().catch(function (e) { msgLogin(FB.msg(e)); });
  });
  $("[data-login-form]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, btn = $("button[type=submit]", f);
    if (!f.email.value.trim() || !f.senha.value) { msgLogin("Preencha e-mail e senha."); return; }
    btn.disabled = true;
    FB.entrar(f.email.value.trim(), f.senha.value).catch(function (e) { msgLogin(FB.msg(e)); }).then(function () { btn.disabled = false; f.senha.value = ""; });
  });
  $("[data-sair]").addEventListener("click", function () { limpar(); FB.sair(); });
  $("[data-atualizar]").addEventListener("click", function () { carregar(); });
  $$("[data-dias]").forEach(function (b) {
    b.addEventListener("click", function () {
      dias = +b.getAttribute("data-dias");
      $$("[data-dias]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      carregar();
    });
  });

  function carregar() {
    var s = sessao(); if (!s) { mostrar("login"); return; }
    var erro = $("[data-erro]"); erro.hidden = true;
    $("[data-meta]").textContent = "Carregando…";
    api({ dias: dias })
      .then(function (r) { ultimo = r; desenhar(r); })
      .catch(function (e) { erro.hidden = false; erro.textContent = FB && !DEMO ? FB.msg(e) : e.message; $("[data-meta]").textContent = "Conectado como " + s.email + "."; });
  }

  /* ---------------- desenho ---------------- */
  function desenhar(r) {
    var s = sessao();
    $("[data-meta]").textContent = "Últimos " + r.dias + " dias · atualizado em " + r.geradoEm + " · " + (s ? s.email : "");
    var t = r.totais;
    var kpis = [
      [t.visitantes, "visitantes no período"],
      [t.paginas, "páginas vistas"],
      [r.hoje.visitantes, "visitantes hoje"],
      [t.novos, "aparelhos visitando pela primeira vez"],
      [t.viaApp, "visitas pelo app instalado"]
    ];
    $("[data-kpis]").innerHTML = kpis.map(function (k) { return "<li><strong>" + num(k[0]) + "</strong><span>" + esc(k[1]) + "</span></li>"; }).join("");
    grafico(r.serie);
    $("[data-tabela] tbody").innerHTML = r.serie.slice().reverse().map(function (d) {
      return "<tr><td>" + dataCurta(d.dia, true) + "</td><td>" + num(d.visitantes) + "</td><td>" + num(d.paginas) + "</td></tr>";
    }).join("");
    lista("paginas", r.paginas, NOMES.paginas);
    lista("acoes", r.acoes, NOMES.acoes);
    lista("origens", r.origens);
    lista("eventosAbertos", r.eventosAbertos, TITULOS);
    lista("dispositivos", r.dispositivos, NOMES.dispositivos);
    lista("navegadores", r.navegadores);
    lista("sistemas", r.sistemas);
    var c = r.cadastros || {};
    $("[data-agenda]").innerHTML = [["instituicoes", "instituições"], ["eventos", "eventos de usuários"], ["programas", "programas e ações"]].map(function (x) {
      var v = c[x[0]] || { total: 0, ocultos: 0 };
      return "<li><strong>" + num(v.total) + "</strong><span>" + x[1] + (v.ocultos ? " (" + num(v.ocultos) + " ocultos)" : "") + "</span></li>";
    }).join("");
    moderacao();
  }

  function lista(chave, itens, nomes) {
    var el = $('[data-lista="' + chave + '"]');
    if (!itens || !itens.length) { el.innerHTML = '<li class="adm-vazio">Sem dados no período.</li>'; return; }
    var max = itens[0].total || 1;
    el.innerHTML = itens.map(function (i) {
      var nome = (nomes && nomes[i.nome]) || i.nome;
      return '<li><span class="nome" title="' + esc(nome) + '">' + esc(nome) + '</span><span class="num">' + num(i.total) + '</span>' +
        '<span class="trilho" aria-hidden="true"><span class="barra" style="width:' + Math.max(1, Math.round(i.total / max * 100)) + '%"></span></span></li>';
    }).join("");
  }

  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function dataCurta(iso, ano) { var p = iso.split("-"); return +p[2] + " " + MESES[+p[1] - 1] + (ano ? " " + p[0] : ""); }

  function grafico(serie) {
    var box = $("[data-grafico]"), W = Math.max(280, box.clientWidth), H = 240;
    var m = { t: 12, r: 8, b: 26, l: 36 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max(1, Math.max.apply(null, serie.map(function (d) { return d.visitantes; })));
    var passo = Math.pow(10, Math.floor(Math.log10(max))); var topo = Math.ceil(max / passo) * passo; if (topo / passo > 5 && passo >= 1) passo *= 2;
    var ticks = []; for (var v = 0; v <= topo; v += Math.max(1, passo)) ticks.push(v);
    var bw = iw / serie.length, gap = Math.min(2, bw * 0.2), y = function (v) { return m.t + ih - v / topo * ih; };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Visitantes por dia, últimos ' + serie.length + ' dias">';
    svg += '<g class="grid">' + ticks.map(function (t) { return '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>'; }).join("") + "</g>";
    svg += '<g class="axis">' + ticks.map(function (t) { return '<text x="' + (m.l - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + num(t) + "</text>"; }).join("");
    var marcas = [0, Math.floor((serie.length - 1) / 2), serie.length - 1];
    svg += marcas.map(function (i, k) { var x = m.l + bw * i + bw / 2; return '<text x="' + x + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? "start" : k === 2 ? "end" : "middle") + '">' + dataCurta(serie[i].dia) + "</text>"; }).join("") + "</g>";
    svg += serie.map(function (d, i) {
      var x = m.l + bw * i + gap / 2, w = Math.max(1, bw - gap), h = d.visitantes / topo * ih, yy = m.t + ih - h, r = Math.min(4, w / 2, h);
      var path = h > 0 ? "M" + x + "," + (m.t + ih) + "V" + (yy + r) + "Q" + x + "," + yy + " " + (x + r) + "," + yy + "H" + (x + w - r) + "Q" + (x + w) + "," + yy + " " + (x + w) + "," + (yy + r) + "V" + (m.t + ih) + "Z" : "";
      return '<g class="col" tabindex="0" data-i="' + i + '" aria-label="' + dataCurta(d.dia, true) + ": " + d.visitantes + " visitantes, " + d.paginas + ' páginas"><rect class="hit" x="' + (m.l + bw * i) + '" y="' + m.t + '" width="' + bw + '" height="' + ih + '"/>' + (path ? '<path class="bar" d="' + path + '"/>' : "") + "</g>";
    }).join("");
    svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih) + '" stroke="var(--muted)" stroke-width="1"/></svg>';
    box.innerHTML = svg;
    var tip = $("[data-tip]");
    function show(g, ev) {
      var d = serie[+g.getAttribute("data-i")];
      tip.innerHTML = "<strong>" + dataCurta(d.dia, true) + "</strong>" + num(d.visitantes) + " visitantes · " + num(d.paginas) + " páginas";
      tip.hidden = false;
      var r = g.getBoundingClientRect(), x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2, yy = ev && ev.clientY ? ev.clientY : r.top;
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, x - tip.offsetWidth / 2)) + "px";
      tip.style.top = Math.max(8, yy - tip.offsetHeight - 12) + "px";
    }
    $$(".col", box).forEach(function (g) {
      g.addEventListener("mousemove", function (ev) { show(g, ev); });
      g.addEventListener("focus", function () { show(g); });
      g.addEventListener("click", function (ev) { show(g, ev); });
      g.addEventListener("mouseleave", function () { tip.hidden = true; });
      g.addEventListener("blur", function () { tip.hidden = true; });
    });
  }
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (ultimo) grafico(ultimo.serie); }, 150); });

  if (DEMO) {
    var aviso = document.createElement("p");
    aviso.className = "adm-demo"; aviso.textContent = "Demonstração com dados fictícios. Os números reais aparecem depois que a planilha for ligada.";
    $("[data-painel]").insertBefore(aviso, $("[data-painel]").firstChild);
    $("[data-sair]").style.display = "none";
  }
  /* ---------------- moderação ---------------- */
  function moderacao() {
    var ul = $("[data-modlist]"); if (!ul) return;
    if (DEMO) { ul.innerHTML = '<li class="adm-vazio">Na demonstração não há itens para moderar.</li>'; return; }
    var lista = (base[modCol] || []).slice().sort(function (a, b) { return ((b.criadoEm && b.criadoEm.seconds) || 0) - ((a.criadoEm && a.criadoEm.seconds) || 0); });
    if (!lista.length) { ul.innerHTML = '<li class="adm-vazio">Nada cadastrado ainda.</li>'; return; }
    ul.innerHTML = lista.slice(0, 200).map(function (o) {
      var titulo = o.titulo || o.nome || "(sem nome)", quem = o.instituicao || o.organizador || o.categoria || "";
      var quando = o.criadoEm && o.criadoEm.toDate ? o.criadoEm.toDate().toLocaleDateString("pt-BR") : "";
      var extra = modCol === "eventos" && o.data ? " · evento em " + o.data.split("-").reverse().join("/") : "";
      return '<li class="adm-moditem' + (o.oculto ? " is-oculto" : "") + '">' + (o.logo ? '<img src="' + esc(o.logo) + '" alt="" width="40" height="40">' : '<span class="adm-moditem__sem" aria-hidden="true"></span>') +
        "<div><strong>" + esc(titulo) + "</strong><span>" + esc(quem) + (quando ? " · cadastrado em " + quando : "") + esc(extra) + "</span></div>" +
        '<span class="badge' + (o.oculto ? " badge--clash" : " badge--ok") + '">' + (o.oculto ? "Oculto" : "No ar") + "</span>" +
        '<button class="btn btn--ghost btn--small" type="button" data-moderar="' + esc(o.id) + '" data-oculto="' + (!o.oculto) + '">' + (o.oculto ? "Mostrar" : "Ocultar") + "</button></li>";
    }).join("");
  }
  $$("[data-mod]").forEach(function (b) {
    b.addEventListener("click", function () {
      modCol = b.getAttribute("data-mod");
      $$("[data-mod]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      moderacao();
    });
  });
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-moderar]"); if (!b) return;
    var id = b.getAttribute("data-moderar"), oculto = b.getAttribute("data-oculto") === "true";
    if (oculto && !confirm("Ocultar este item do site?")) return;
    b.disabled = true;
    FB.moderar(modCol, id, oculto).then(function () {
      base[modCol].forEach(function (o) { if (o.id === id) o.oculto = oculto; });
      moderacao();
    }).catch(function (e) { alert(FB.msg(e)); b.disabled = false; });
  });

  /* ---------------- início ---------------- */
  if (DEMO) { mostrar("painel"); carregar(); }
  else if (!FB || !FB.ativo()) {
    mostrar("login"); msgLogin("O Firebase ainda não foi configurado (config.js).");
    $$("[data-google], [data-login-form] button").forEach(function (b) { b.disabled = true; });
  } else {
    FB.iniciar().catch(function () { msgLogin("Não foi possível carregar o login agora."); });
    FB.aoMudarUsuario(function (u) {
      if (!u) { conta = null; mostrar("login"); return; }
      if (!FB.isAdmin(u)) {
        conta = null; mostrar("login");
        msgLogin(u.emailVerified ? "A conta " + u.email + " não tem acesso ao Painel Admin." : "Confirme o e-mail da conta antes de entrar no Painel.");
        return;
      }
      conta = u; salvar({ exp: Date.now() + 365 * 864e5, email: u.email });
      mostrar("painel"); carregar();
    });
  }

})();
