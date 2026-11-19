/* ==========================================================
   ELI Pouso Alegre — Painel Admin
   Login verificado no Apps Script (a senha não fica no site).
   O login fica salvo neste aparelho e desliga a contagem de
   acessos dele no site (mesma chave usada em app.js).
   ========================================================== */
(function () {
  "use strict";
  var CFG = window.ELI_CONFIG || {};
  var CHAVE = "eli-admin";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var dias = 30;
  var ultimo = null;

  var NOMES = {
    paginas: { inicio: "O ELI (início)", agenda: "Agenda Única", governanca: "Governança" },
    acoes: { whatsapp: "Cliques no WhatsApp", cadastro_enviado: "Eventos cadastrados pelo site", evento_aberto: "Eventos abertos", salvar_agenda: "Salvos no calendário", inscricao: "Cliques em inscrição", convite_app: "Convites para instalar o app", app_instalado: "Apps instalados" },
    dispositivos: { celular: "Celular", computador: "Computador", tablet: "Tablet" }
  };
  var TITULOS = {};
  (window.ELI_EVENTOS || []).forEach(function (e) { TITULOS[e.id] = e.titulo; });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function sessao() { try { var a = JSON.parse(localStorage.getItem(CHAVE) || "null"); return a && a.exp > Date.now() ? a : null; } catch (e) { return null; } }
  function salvar(a) { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch (e) { /* navegação privada: login só nesta aba */ } }
  function limpar() { try { localStorage.removeItem(CHAVE); } catch (e) { /* ok */ } }

  function api(corpo) {
    if (!CFG.ENDPOINT) return Promise.reject(new Error("A planilha ainda não está ligada ao site (ENDPOINT vazio em config.js)."));
    return fetch(CFG.ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(corpo) })
      .then(function (r) { if (!r.ok) throw new Error("A planilha respondeu com erro " + r.status + "."); return r.json(); })
      .catch(function (e) {
        if (e instanceof SyntaxError || /Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error("Não foi possível falar com a planilha. Ela já foi autorizada pela conta dona?");
        throw e;
      });
  }

  /* ---------------- telas ---------------- */
  function mostrar(qual) {
    $("[data-login]").hidden = qual !== "login";
    $("[data-painel]").hidden = qual !== "painel";
  }

  $("[data-login-form]").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, msg = $("[data-login-msg]"), btn = $("button[type=submit]", f);
    if (!f.email.value.trim() || !f.senha.value) { msg.className = "form__msg is-err"; msg.textContent = "Preencha e-mail e senha."; return; }
    btn.disabled = true; btn.textContent = "Entrando…"; msg.textContent = "";
    api({ acao: "login", email: f.email.value.trim(), senha: f.senha.value })
      .then(function (r) {
        if (!r.ok) throw new Error(r.erro || "Não foi possível entrar.");
        salvar({ token: r.token, exp: r.exp, email: r.email });
        f.reset(); mostrar("painel"); carregar();
      })
      .catch(function (e) { msg.className = "form__msg is-err"; msg.textContent = e.message; })
      .then(function () { btn.disabled = false; btn.textContent = "Entrar"; });
  });

  $("[data-sair]").addEventListener("click", function () { limpar(); mostrar("login"); $("#a-email").focus(); });
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
    api({ acao: "stats", token: s.token, dias: dias })
      .then(function (r) {
        if (!r.ok) { if (r.sair) { limpar(); mostrar("login"); } throw new Error(r.erro || "Erro ao carregar."); }
        ultimo = r; desenhar(r);
      })
      .catch(function (e) { erro.hidden = false; erro.textContent = e.message; $("[data-meta]").textContent = "Conectado como " + s.email + "."; });
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
    var a = r.agenda || {};
    $("[data-agenda]").innerHTML = [["pendente", "pendentes"], ["aprovado", "aprovados"], ["recusado", "recusados"]].map(function (x) {
      return "<li><strong>" + num(a[x[0]]) + "</strong><span>" + x[1] + "</span></li>";
    }).join("");
    var pl = $("[data-planilha]"); if (r.planilha) { pl.href = r.planilha; pl.hidden = false; }
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

  if (sessao()) { mostrar("painel"); carregar(); } else mostrar("login");
})();
