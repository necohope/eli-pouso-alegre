/**
 * ELI Pouso Alegre — Backend gratuito da Agenda Única
 * Google Planilha + Google Apps Script (sem servidor, sem custo).
 *
 * O que faz:
 *  - POST: recebe o cadastro do site e grava uma linha na aba "Eventos" com status "pendente".
 *  - GET ?acao=eventos: devolve só os eventos com status "aprovado", só com os campos públicos.
 *
 * Como o Grupo 2 aprova um evento: abre a planilha e troca a coluna "status" para "aprovado".
 * O site passa a mostrar o evento na próxima visita.
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

/** Rode uma vez pelo editor (botão Executar) para criar a aba com cabeçalhos e a lista de status. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
  sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  var regra = SpreadsheetApp.newDataValidation().requireValueInList(["pendente", "aprovado", "recusado"], true).build();
  sh.getRange(2, 1, 1000, 1).setDataValidation(regra);
  sh.autoResizeColumns(1, COLUNAS.length);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents || "{}");
    var erro = validar(d);
    if (erro) return json({ ok: false, erro: erro });

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
    if (!sh) { configurar(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA); }

    var linha = COLUNAS.map(function (c) {
      if (c === "status") return "pendente";
      if (c === "id") return "ev-" + Utilities.getUuid().slice(0, 8);
      if (c === "enviadoEm") return new Date();
      if (c === "publicos") return (d.publicos || []).join(", ");
      if (c === "gratuito") return d.gratuito ? "sim" : "não";
      if (c === "observacoes") return "";
      return limpar(d[c]);
    });
    sh.appendRow(linha);

    var aviso = PropertiesService.getScriptProperties().getProperty("EMAIL_AVISO");
    if (aviso) {
      MailApp.sendEmail(aviso, "Agenda ELI: novo evento para conferir",
        "Evento: " + limpar(d.titulo) + "\nData: " + limpar(d.data) + "\nOrganizador: " + limpar(d.organizador) +
        "\n\nAbra a planilha e mude o status para \"aprovado\" para publicar:\n" + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var acao = (e && e.parameter && e.parameter.acao) || "";
  if (acao !== "eventos") return json({ ok: true, info: "Use ?acao=eventos" });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
  if (!sh || sh.getLastRow() < 2) return json({ eventos: [] });
  var valores = sh.getRange(2, 1, sh.getLastRow() - 1, COLUNAS.length).getValues();
  var tz = Session.getScriptTimeZone();

  var eventos = valores.filter(function (l) { return String(l[0]).toLowerCase() === "aprovado"; }).map(function (l) {
    var o = {};
    COLUNAS.forEach(function (c, i) {
      if (PUBLICOS.indexOf(c) === -1) return;
      var v = l[i];
      if (v instanceof Date) v = (c === "hora" || c === "horaFim") ? Utilities.formatDate(v, tz, "HH:mm") : Utilities.formatDate(v, tz, "yyyy-MM-dd");
      if (c === "publicos") v = String(v || "").split(",").map(function (s) { return s.trim(); }).filter(String);
      if (c === "gratuito") v = String(v).toLowerCase() === "sim";
      o[c] = v;
    });
    o.exemplo = false;
    return o;
  });
  return json({ eventos: eventos });
}

function validar(d) {
  var obrig = ["titulo", "tipo", "data", "local", "organizador", "descricao", "responsavel", "email"];
  for (var i = 0; i < obrig.length; i++) if (!d[obrig[i]] || !String(d[obrig[i]]).trim()) return "Campo obrigatório: " + obrig[i];
  if (TIPOS_VALIDOS.indexOf(d.tipo) === -1) return "Tipo inválido";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return "Data inválida";
  if (d.dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(d.dataFim)) return "Data de término inválida";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "E-mail inválido";
  if (d.link && !/^https?:\/\//.test(d.link)) return "Link inválido";
  if (String(d.descricao).length > 400) return "Descrição longa demais";
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
