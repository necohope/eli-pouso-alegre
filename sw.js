/* ELI Pouso Alegre — service worker
   Objetivo: permitir instalar o site como app e abrir sem internet.
   Estratégia simples e segura:
   - páginas: rede primeiro (sempre a versão mais nova); sem rede, usa a cópia salva;
   - css e js: rede primeiro, cópia salva só sem internet;
   - imagens e fontes: usa a cópia salva e atualiza em segundo plano.
   Nada de fora do site (planilha do Google, Google Agenda, WhatsApp) passa por aqui.
   Ao mudar a lista de arquivos ou a estratégia, troque a VERSAO. */
var VERSAO = "eli-v3";
var BASICOS = [
  "/",
  "/assets/css/styles.css",
  "/assets/js/config.js",
  "/assets/js/eventos.js",
  "/assets/js/catalogos.js",
  "/assets/js/i18n.js",
  "/assets/js/fb.js",
  "/assets/js/app.js",
  "/assets/js/conta.js",
  "/assets/js/area.js",
  "/assets/js/mapa.js",
  "/assets/img/logo-eli.png",
  "/assets/img/logo-eli-white.png",
  "/assets/img/favicon.png",
  "/assets/img/icon-192.png",
  "/assets/fonts/saira-latin-wdth-normal.woff2"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    ev.respondWith(fetch(req).then(function (res) {
      if (res.ok && url.pathname === "/") { var copia = res.clone(); caches.open(VERSAO).then(function (c) { c.put("/", copia); }); }
      return res;
    }).catch(function () { return caches.match("/"); }));
    return;
  }

  // CSS, JS, manifesto: rede primeiro, para nunca misturar página nova com código antigo.
  if (!/\.(png|jpe?g|webp|svg|woff2)$/.test(url.pathname)) {
    ev.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copia = res.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
    return;
  }

  // Imagens e fontes: cópia salva primeiro, atualizando em segundo plano.
  ev.respondWith(caches.match(req).then(function (salvo) {
    var rede = fetch(req).then(function (res) {
      if (res.ok) { var copia = res.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () { return salvo; });
    return salvo || rede;
  }));
});
