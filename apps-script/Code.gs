/** @OnlyCurrentDoc  (o script só acessa esta planilha, nenhuma outra da conta) */

/**
 * ELI Pouso Alegre — Backend gratuito da Agenda Única
 * Google Planilha + Google Apps Script (sem servidor, sem custo).
 *
 * O que faz:
 *  - POST: recebe o cadastro do site e grava uma linha na aba "Eventos" com status "pendente".
 *  - GET ?acao=eventos: devolve só os eventos com status "aprovado", só com os campos públicos.
 *
 * Como a curadoria aprova um evento: abre a planilha e troca a coluna "status" para "aprovado".
 * O site passa a mostrar o evento em até 2 minutos (na hora, se a edição for feita na planilha).
 *
 * Instalação: veja o README, seção "Ligar a agenda à planilha".
 */

var ABA = "Eventos";
var COLUNAS = [
  "status", "id", "enviadoEm", "titulo", "tipo", "formato", "data", "hora", "dataFim", "horaFim",
  "local", "organizador", "link", "publicos", "gratuito", "descricao", "responsavel", "email", "observacoes"
];
// Campos que podem aparecer no site. Nome e e-mail de quem cadastrou NUNCA saem daqui.
var PUBLICOS = ["id", "titulo", "tipo", "formato", "data", "hora", "dataFim", "horaFim", "local", "organizador", "link", "publicos", "gratuito", "descricao"];
var TIPOS_VALIDOS = ["evento", "capacitacao", "edital", "programa", "competicao", "ecossistema"];
var FORMATOS_VALIDOS = ["presencial", "online", "hibrido"];
// Colunas gravadas como texto puro, para a planilha não converter datas e horários (e não trocar o fuso).
var COLUNAS_TEXTO = ["id", "titulo", "tipo", "formato", "data", "hora", "dataFim", "horaFim", "local", "organizador", "link", "publicos", "gratuito", "descricao", "responsavel", "email", "observacoes"];
var CACHE_CHAVE = "eventos-aprovados";
var CACHE_SEGUNDOS = 120;

/** Rode uma vez pelo editor (botão Executar) para criar a aba com cabeçalhos, formatos e a lista de status. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
  sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight("bold").setBackground("#E8ECF7");
  sh.setFrozenRows(1);
  var regra = SpreadsheetApp.newDataValidation().requireValueInList(["pendente", "aprovado", "recusado"], true).build();
  sh.getRange(2, 1, 2000, 1).setDataValidation(regra);
  COLUNAS_TEXTO.forEach(function (c) { sh.getRange(2, COLUNAS.indexOf(c) + 1, 2000, 1).setNumberFormat("@"); });
  sh.getRange(2, COLUNAS.indexOf("enviadoEm") + 1, 2000, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.autoResizeColumns(1, COLUNAS.length);
  abaAcessos();
  // Pede a autorização de e-mail já na instalação (usada no aviso de novo cadastro).
  MailApp.getRemainingDailyQuota();
}

function doPost(e) {
  var d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json({ ok: false, erro: "Pedido inválido" }); }
  // Estatísticas e painel (ver analytics.gs)
  if (d.acao === "hit") return registrarAcesso(d);
  if (d.acao === "login") return login(d);
  if (d.acao === "stats") return estatisticas(d);
  return cadastrar(d);
}

/** Cadastro de evento vindo do formulário do site. */
function cadastrar(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Campo invisível do formulário: só robôs preenchem. Finge sucesso e descarta.
    if (d.site) return json({ ok: true });
    var erro = validar(d);
    if (erro) return json({ ok: false, erro: erro });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ABA);
    if (!sh) { configurar(); sh = ss.getSheetByName(ABA); }

    var linha = COLUNAS.map(function (c) {
      if (c === "status") return "pendente";
      if (c === "id") return "ev-" + Utilities.getUuid().slice(0, 8);
      if (c === "enviadoEm") return new Date();
      if (c === "publicos") return limpar((d.publicos || []).join(", "));
      if (c === "gratuito") return d.gratuito ? "sim" : "não";
      if (c === "observacoes") return "";
      return limpar(d[c]);
    });
    var r = sh.getLastRow() + 1;
    var faixa = sh.getRange(r, 1, 1, COLUNAS.length);
    faixa.setNumberFormats([COLUNAS.map(function (c) { return c === "enviadoEm" ? "dd/MM/yyyy HH:mm" : (COLUNAS_TEXTO.indexOf(c) > -1 ? "@" : "General"); })]);
    faixa.setValues([linha]);

    // Aviso de novo cadastro: e-mail da propriedade EMAIL_AVISO ou, se não houver, o da conta dona da planilha.
    var aviso = PropertiesService.getScriptProperties().getProperty("EMAIL_AVISO") || Session.getEffectiveUser().getEmail();
    if (aviso) {
      MailApp.sendEmail(aviso, "Agenda ELI: novo evento para conferir",
        "Evento: " + limpar(d.titulo) + "\nData: " + limpar(d.data) + "\nOrganizador: " + limpar(d.organizador) +
        "\n\nAbra a planilha e mude o status para \"aprovado\" para publicar:\n" + ss.getUrl());
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, erro: "Falha ao gravar" });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var acao = (e && e.parameter && e.parameter.acao) || "";
  if (acao !== "eventos") return json({ ok: true, info: "Use ?acao=eventos" });
  var cache = CacheService.getScriptCache();
  var salvo = cache.get(CACHE_CHAVE);
  if (salvo) return ContentService.createTextOutput(salvo).setMimeType(ContentService.MimeType.JSON);
  var corpo = JSON.stringify({ eventos: aprovados() });
  try { cache.put(CACHE_CHAVE, corpo, CACHE_SEGUNDOS); } catch (err) { /* lista grande demais para o cache: segue sem */ }
  return ContentService.createTextOutput(corpo).setMimeType(ContentService.MimeType.JSON);
}

/** Lê a planilha e devolve só os eventos aprovados, só com campos públicos. */
function aprovados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA);
  if (!sh || sh.getLastRow() < 2) return [];
  var valores = sh.getRange(2, 1, sh.getLastRow() - 1, COLUNAS.length).getValues();
  var tz = ss.getSpreadsheetTimeZone() || "America/Sao_Paulo";
  return valores.filter(function (l) { return String(l[0]).trim().toLowerCase() === "aprovado"; }).map(function (l) {
    var o = {};
    COLUNAS.forEach(function (c, i) {
      if (PUBLICOS.indexOf(c) === -1) return;
      var v = l[i];
      // Se alguém digitou data/hora à mão e a planilha converteu, volta para texto.
      if (v instanceof Date) v = (c === "hora" || c === "horaFim") ? Utilities.formatDate(v, tz, "HH:mm") : Utilities.formatDate(v, tz, "yyyy-MM-dd");
      if (c === "publicos") v = String(v || "").split(",").map(function (s) { return s.trim(); }).filter(String);
      if (c === "gratuito") v = String(v).trim().toLowerCase() === "sim";
      if (c === "link" && v && !/^https?:\/\//i.test(String(v))) v = "";
      o[c] = (v === null || v === undefined) ? "" : v;
    });
    o.exemplo = false;
    return o;
  }).filter(function (o) { return o.id && o.titulo && /^\d{4}-\d{2}-\d{2}$/.test(o.data); });
}

/** Gatilho simples: qualquer edição na planilha (ex.: aprovar um evento) renova a lista do site na hora. */
function onEdit() {
  CacheService.getScriptCache().remove(CACHE_CHAVE);
}

function validar(d) {
  var obrig = ["titulo", "tipo", "data", "local", "organizador", "descricao", "responsavel", "email"];
  for (var i = 0; i < obrig.length; i++) if (!d[obrig[i]] || !String(d[obrig[i]]).trim()) return "Campo obrigatório: " + obrig[i];
  if (TIPOS_VALIDOS.indexOf(d.tipo) === -1) return "Tipo inválido";
  if (d.formato && FORMATOS_VALIDOS.indexOf(d.formato) === -1) return "Formato inválido";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return "Data inválida";
  if (d.dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(d.dataFim)) return "Data de término inválida";
  if (d.hora && !/^\d{2}:\d{2}$/.test(d.hora)) return "Horário inválido";
  if (d.horaFim && !/^\d{2}:\d{2}$/.test(d.horaFim)) return "Horário de término inválido";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "E-mail inválido";
  if (d.link && !/^https?:\/\//i.test(d.link)) return "Link inválido";
  if (String(d.descricao).length > 400) return "Descrição longa demais";
  if (String(d.titulo).length > 120) return "Nome longo demais";
  return "";
}

/** Corta tamanho e impede que um texto vire fórmula na planilha. */
function limpar(v) {
  var s = String(v == null ? "" : v).slice(0, 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
