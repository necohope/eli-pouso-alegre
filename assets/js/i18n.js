/* ==========================================================
   ELI Pouso Alegre — tradução (PT, EN, ES, FR, 中文)
   O português é o texto-fonte escrito no HTML e no JS.
   Os dicionários (assets/i18n/en.js etc.) mapeiam o texto em
   português para o texto traduzido. Este arquivo:
   - escolhe o idioma (escolha salva > idioma do navegador > PT);
   - traduz o que já está na página e tudo o que for desenhado depois;
   - oferece t("texto {n}", {n: 3}) para textos montados no JS;
   - formata meses e dias da semana no idioma escolhido.
   Conteúdo cadastrado por usuários (nomes de eventos, instituições)
   fica no idioma original. Marque com data-no-i18n o que não deve ser traduzido.
   ========================================================== */
(function () {
  "use strict";
  var IDIOMAS = { pt: "pt-BR", en: "en", es: "es", fr: "fr", zh: "zh-CN" };
  var ROTULO = { pt: "PT", en: "EN", es: "ES", fr: "FR", zh: "中文" };
  var ATRIBUTOS = ["placeholder", "aria-label", "title", "alt"];
  window.ELI_DIC = window.ELI_DIC || {};
  var atual = escolherInicial();
  var ouvintes = [];
  var observador = null;

  function escolherInicial() {
    try { var s = localStorage.getItem("eli-lang"); if (s && IDIOMAS[s]) return s; } catch (e) { /* ok */ }
    var nav = (navigator.language || "pt").slice(0, 2).toLowerCase();
    return IDIOMAS[nav] && nav !== "pt" ? nav : "pt";
  }
  function dic() { return atual === "pt" ? null : window.ELI_DIC[atual]; }

  function t(pt, params) {
    var d = dic(), s = (d && d[pt]) || pt;
    if (params) Object.keys(params).forEach(function (k) { s = s.split("{" + k + "}").join(params[k]); });
    return s;
  }

  function traduzirTexto(no) {
    if (no.__pt === undefined) no.__pt = no.nodeValue;
    var orig = no.__pt, chave = orig.trim();
    if (!chave) return;
    var d = dic(), alvo = d && d[chave];
    var novo = alvo ? orig.replace(chave, alvo) : orig;
    if (no.nodeValue !== novo) no.nodeValue = novo;
  }
  function traduzirAtributos(el) {
    var d = dic();
    ATRIBUTOS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var k = "data-pt-" + a;
      if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
      var orig = el.getAttribute(k), alvo = d && d[orig.trim()];
      el.setAttribute(a, alvo || orig);
    });
  }
  function pular(el) { return el.closest && el.closest("script, style, [data-no-i18n]"); }

  function aplicar(raiz) {
    raiz = raiz || document.body;
    if (!raiz) return;
    if (raiz.nodeType === 3) { if (!pular(raiz.parentElement)) traduzirTexto(raiz); return; }
    if (raiz.nodeType !== 1 || pular(raiz)) return;
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && !pular(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    var n; while ((n = w.nextNode())) traduzirTexto(n);
    traduzirAtributos(raiz);
    Array.prototype.forEach.call(raiz.querySelectorAll("[" + ATRIBUTOS.join("],[") + "]"), function (el) { if (!pular(el)) traduzirAtributos(el); });
  }

  function observar() {
    if (observador || !window.MutationObserver) return;
    observador = new MutationObserver(function (lista) {
      if (atual === "pt") return;
      lista.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { aplicar(n); }); });
    });
    observador.observe(document.body, { childList: true, subtree: true });
  }

  function carregar(lang) {
    if (lang === "pt" || window.ELI_DIC[lang]) return Promise.resolve();
    return new Promise(function (ok) {
      var s = document.createElement("script");
      var base = (document.querySelector('script[src*="i18n.js"]') || {}).src || "assets/js/i18n.js";
      s.src = base.replace(/js\/i18n\.js.*$/, "i18n/" + lang + ".js");
      s.onload = ok; s.onerror = ok;
      document.head.appendChild(s);
    });
  }

  function definir(lang, salvar) {
    if (!IDIOMAS[lang]) lang = "pt";
    if (salvar) { try { localStorage.setItem("eli-lang", lang); } catch (e) { /* ok */ } }
    return carregar(lang).then(function () {
      atual = lang;
      document.documentElement.lang = IDIOMAS[lang];
      document.documentElement.setAttribute("data-lang", lang);
      aplicar(document.body);
      Array.prototype.forEach.call(document.querySelectorAll("[data-lang-cur]"), function (el) { el.textContent = ROTULO[lang]; });
      Array.prototype.forEach.call(document.querySelectorAll("[data-lang-set]"), function (b) { b.setAttribute("aria-current", String(b.getAttribute("data-lang-set") === lang)); });
      ouvintes.forEach(function (f) { try { f(lang); } catch (e) { /* ok */ } });
    });
  }

  // Datas no idioma escolhido
  function fmt(op) { try { return new Intl.DateTimeFormat(IDIOMAS[atual], op); } catch (e) { return new Intl.DateTimeFormat("pt-BR", op); } }
  function mes(i, tipo) { return fmt({ month: tipo || "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 15))); }
  function diaSemana(i, tipo) { return fmt({ weekday: tipo || "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + i))); } // 1/11/2026 é domingo
  function dataLonga(d) { return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d); }
  function dataCurta(d) { return fmt({ day: "numeric", month: "long" }).format(d); }
  function mesAno(d) { return fmt({ month: "long", year: "numeric" }).format(d); }
  function numero(n) { try { return new Intl.NumberFormat(IDIOMAS[atual]).format(n); } catch (e) { return String(n); } }

  window.ELI_I18N = {
    t: t, lang: function () { return atual; }, locale: function () { return IDIOMAS[atual]; },
    definir: definir, aplicar: aplicar, aoMudar: function (f) { ouvintes.push(f); },
    mes: mes, diaSemana: diaSemana, dataLonga: dataLonga, dataCurta: dataCurta, mesAno: mesAno, numero: numero
  };

  function iniciar() {
    observar();
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-lang-set]");
      if (b) { ev.preventDefault(); definir(b.getAttribute("data-lang-set"), true); }
    });
    if (atual !== "pt") definir(atual, false);
    else Array.prototype.forEach.call(document.querySelectorAll("[data-lang-set]"), function (b) { b.setAttribute("aria-current", String(b.getAttribute("data-lang-set") === "pt")); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
