/**
 * ELI Pouso Alegre — estatísticas de acesso e painel Admin
 *
 * Privacidade (LGPD): nada de cookies, IP, nome ou e-mail de visitantes.
 * Cada aparelho recebe um código aleatório que muda todo dia (conta visitantes do dia
 * sem seguir ninguém de um dia para o outro). Os acessos do Admin não são enviados pelo site.
 *
 * Credenciais do Admin ficam em segredos.gs, que NÃO vai para o GitHub (só para este script).
 * Esse arquivo define: ADMIN_EMAIL, ADMIN_SALT, ADMIN_HASH (sha256 de sal+senha, em hex), TOKEN_SEGREDO.
 */

var ABA_ACESSOS = "Acessos";
var COLUNAS_ACESSOS = ["quando", "tipo", "pagina", "alvo", "visitante", "novo", "dispositivo", "navegador", "sistema", "idioma", "origem", "app"];
var TIPOS_ACESSO = ["pagina", "evento_aberto", "whatsapp", "cadastro_enviado", "salvar_agenda", "convite_app", "app_instalado", "inscricao"];
var TOKEN_DIAS = 365;

function abaAcessos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA_ACESSOS);
  if (sh) return sh;
  sh = ss.insertSheet(ABA_ACESSOS);
  sh.getRange(1, 1, 1, COLUNAS_ACESSOS.length).setValues([COLUNAS_ACESSOS]).setFontWeight("bold").setBackground("#E8ECF7");
  sh.setFrozenRows(1);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  return sh;
}

/** Recebe um acesso do site (navigator.sendBeacon). Resposta não é lida pelo site. */
function registrarAcesso(d) {
  if (TIPOS_ACESSO.indexOf(d.tipo) === -1) return json({ ok: false });
  var curto = function (v, n) { return limpar(String(v == null ? "" : v).slice(0, n || 60)); };
  abaAcessos().appendRow([
    new Date(), d.tipo, curto(d.pagina, 20), curto(d.alvo, 80), curto(d.visitante, 24), d.novo ? "sim" : "não",
    curto(d.dispositivo, 12), curto(d.navegador, 16), curto(d.sistema, 16), curto(d.idioma, 8), curto(d.origem, 60), d.app ? "sim" : "não"
  ]);
  return json({ ok: true });
}

/* ---------------- login do Admin ---------------- */

function hex(bytes) { return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join(""); }

function login(d) {
  var cache = CacheService.getScriptCache();
  var falhas = +(cache.get("login-falhas") || 0);
  if (falhas >= 20) return json({ ok: false, erro: "Muitas tentativas. Aguarde 15 minutos e tente de novo." });
  var email = String(d.email || "").trim().toLowerCase();
  var hash = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ADMIN_SALT + String(d.senha || ""), Utilities.Charset.UTF_8));
  if (email !== ADMIN_EMAIL.toLowerCase() || hash !== ADMIN_HASH) {
    cache.put("login-falhas", String(falhas + 1), 900);
    Utilities.sleep(800);
    return json({ ok: false, erro: "E-mail ou senha incorretos." });
  }
  var exp = Date.now() + TOKEN_DIAS * 86400000;
  var payload = email + "|" + exp;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, TOKEN_SEGREDO));
  return json({ ok: true, token: Utilities.base64EncodeWebSafe(payload) + "." + sig, exp: exp, email: email });
}

function tokenValido(t) {
  try {
    var p = String(t || "").split(".");
    if (p.length !== 2) return false;
    var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString();
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, TOKEN_SEGREDO));
    if (sig !== p[1]) return false;
    var partes = payload.split("|");
    return partes[0] === ADMIN_EMAIL.toLowerCase() && +partes[1] > Date.now();
  } catch (err) { return false; }
}

/* ---------------- estatísticas para o painel ---------------- */

function estatisticas(d) {
  if (!tokenValido(d.token)) return json({ ok: false, erro: "Sessão expirada. Entre de novo.", sair: true });
  var dias = Math.max(1, Math.min(365, +d.dias || 30));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone() || "America/Sao_Paulo";
  var agora = new Date();
  var inicio = new Date(agora.getTime() - dias * 86400000);
  var hoje = Utilities.formatDate(agora, tz, "yyyy-MM-dd");

  // dias do período, para o gráfico não ter buracos
  var porDia = {}, ordemDias = [];
  for (var i = dias - 1; i >= 0; i--) {
    var k = Utilities.formatDate(new Date(agora.getTime() - i * 86400000), tz, "yyyy-MM-dd");
    if (!porDia[k]) { porDia[k] = { dia: k, paginas: 0, visitantes: {} }; ordemDias.push(k); }
  }
  var paginas = {}, dispositivos = {}, navegadores = {}, sistemas = {}, origens = {}, acoes = {}, eventosAbertos = {};
  var visitaDia = {}, totalPaginas = 0, novos = 0, viaApp = 0;
  function soma(m, k) { k = k || "(não informado)"; m[k] = (m[k] || 0) + 1; }

  var sh = abaAcessos();
  var n = sh.getLastRow() - 1;
  var linhas = n > 0 ? sh.getRange(2, 1, n, COLUNAS_ACESSOS.length).getValues() : [];
  for (var j = linhas.length - 1; j >= 0; j--) {
    var l = linhas[j], quando = l[0];
    if (!(quando instanceof Date)) continue;
    if (quando < inicio) break; // linhas em ordem de chegada: o resto é mais antigo
    var dia = Utilities.formatDate(quando, tz, "yyyy-MM-dd");
    var tipo = l[1], visitante = l[4];
    if (tipo === "pagina") {
      totalPaginas++;
      soma(paginas, l[2]);
      if (porDia[dia]) { porDia[dia].paginas++; porDia[dia].visitantes[visitante] = 1; }
      var vk = dia + ":" + visitante;
      if (!visitaDia[vk]) {
        visitaDia[vk] = 1;
        soma(dispositivos, l[6]); soma(navegadores, l[7]); soma(sistemas, l[8]); soma(origens, l[10] || "Direto ou app");
        if (l[11] === "sim") viaApp++;
      }
      if (l[5] === "sim") novos++;
    } else {
      soma(acoes, tipo);
      if (tipo === "evento_aberto") soma(eventosAbertos, l[3]);
    }
  }
  var serie = ordemDias.map(function (k) { return { dia: k, paginas: porDia[k].paginas, visitantes: Object.keys(porDia[k].visitantes).length }; });
  var visitantes = serie.reduce(function (a, x) { return a + x.visitantes; }, 0);
  var deHoje = porDia[hoje] ? { paginas: porDia[hoje].paginas, visitantes: Object.keys(porDia[hoje].visitantes).length } : { paginas: 0, visitantes: 0 };

  // situação da agenda (aba Eventos)
  var agenda = { pendente: 0, aprovado: 0, recusado: 0 };
  var ev = ss.getSheetByName(ABA);
  if (ev && ev.getLastRow() > 1) ev.getRange(2, 1, ev.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var s = String(r[0]).trim().toLowerCase(); if (agenda[s] !== undefined) agenda[s]++;
  });

  function top(m, max) {
    return Object.keys(m).map(function (k) { return { nome: k, total: m[k] }; }).sort(function (a, b) { return b.total - a.total; }).slice(0, max || 10);
  }
  return json({
    ok: true, dias: dias, geradoEm: Utilities.formatDate(agora, tz, "dd/MM/yyyy HH:mm"),
    totais: { paginas: totalPaginas, visitantes: visitantes, novos: novos, viaApp: viaApp },
    hoje: deHoje, serie: serie,
    paginas: top(paginas), dispositivos: top(dispositivos), navegadores: top(navegadores), sistemas: top(sistemas),
    origens: top(origens, 12), acoes: top(acoes), eventosAbertos: top(eventosAbertos, 10),
    agenda: agenda, planilha: ss.getUrl()
  });
}
