/* ==========================================================
   ELI Pouso Alegre — dados e contas (Firebase)
   - Carrega o Firebase só quando preciso (não pesa na abertura do site).
   - Sem build: usa os arquivos "compat" do Firebase direto do Google.
   - Tudo o que o site lê e grava passa por aqui (window.ELI_FB).
   Coleções no Firestore:
     instituicoes/{uid}  perfil da instituição (um por conta)
     eventos/{id}        eventos da Agenda
     programas/{id}      programas, projetos, ações e serviços
     acessos/{id}        estatísticas anônimas (só o Admin lê)
     membros/{uid}       pedidos de acesso à Área dos Atores (Admin aprova)
     indicadores/{id}    KPIs importados das planilhas (Área dos Atores)
     documentos/{id}     relatórios, atas e apresentações (links do Drive)
     notas/{id}          anotações internas dos membros
   As regras de segurança ficam em firestore.rules.
   ========================================================== */
(function () {
  "use strict";
  var CFG = window.ELI_CONFIG || {};
  var VERSAO = "10.14.1";
  var BASE = "https://www.gstatic.com/firebasejs/" + VERSAO + "/";
  var pronto = null, app = null, auth = null, db = null;
  var usuario = null, ouvintes = [];
  var cache = {};
  var CACHE_MS = 60 * 1000;

  function ativo() { return !!(CFG.FIREBASE && CFG.FIREBASE.apiKey); }

  function script(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = ok; s.onerror = function () { erro(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }

  function iniciar() {
    if (!ativo()) return Promise.reject(new Error("off"));
    if (pronto) return pronto;
    pronto = script(BASE + "firebase-app-compat.js")
      .then(function () { return Promise.all([script(BASE + "firebase-auth-compat.js"), script(BASE + "firebase-firestore-compat.js")]); })
      .then(function () {
        app = window.firebase.initializeApp(CFG.FIREBASE);
        auth = window.firebase.auth();
        db = window.firebase.firestore();
        auth.languageCode = (window.ELI_I18N && window.ELI_I18N.lang()) || "pt";
        auth.onAuthStateChanged(function (u) {
          usuario = u; avisar();
          // A confirmação do e-mail acontece em outra aba: reconsulta para não mostrar estado antigo.
          if (u && !u.emailVerified && u.providerData.some(function (p) { return p.providerId === "password"; })) {
            u.reload().then(function () { if (auth.currentUser && auth.currentUser.emailVerified) { usuario = auth.currentUser; return usuario.getIdToken(true).then(avisar); } }).catch(function () { /* ok */ });
          }
        });
        return auth.getRedirectResult().catch(function () { /* sem redirecionamento pendente */ });
      });
    return pronto;
  }

  function avisar() { ouvintes.forEach(function (f) { try { f(usuario); } catch (e) { /* ok */ } }); }

  /* ---------------- contas ---------------- */
  var ERROS = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Use \"Entrar\" ou \"Esqueci minha senha\".",
    "auth/weak-password": "A senha precisa ter pelo menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
    "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de excluir a conta.",
    "permission-denied": "Sem permissão para esta ação. Confirme seu e-mail e o perfil da instituição.",
    "unavailable": "Serviço indisponível no momento. Tente de novo em instantes."
  };
  function msg(e) {
    var t = window.ELI_I18N ? window.ELI_I18N.t : function (x) { return x; };
    if (e && e.message === "off") return t("O cadastro de usuários está sendo ativado. Volte em breve.");
    return t(ERROS[e && e.code] || "Algo deu errado. Tente de novo em instantes.");
  }

  function google() {
    return iniciar().then(function () {
      var p = new window.firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      return auth.signInWithPopup(p).catch(function (e) {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return auth.signInWithRedirect(p);
        throw e;
      });
    });
  }
  function entrar(email, senha) { return iniciar().then(function () { return auth.signInWithEmailAndPassword(email, senha); }); }
  function cadastrar(nome, email, senha) {
    return iniciar().then(function () { return auth.createUserWithEmailAndPassword(email, senha); })
      .then(function (r) {
        return r.user.updateProfile({ displayName: nome || "" })
          .then(function () { return r.user.sendEmailVerification({ url: location.origin + "/#conta/instituicao" }); })
          .then(function () { avisar(); return r; });
      });
  }
  function recuperar(email) { return iniciar().then(function () { return auth.sendPasswordResetEmail(email, { url: location.origin + "/#conta" }); }); }
  function reenviar() { return iniciar().then(function () { return auth.currentUser.sendEmailVerification({ url: location.origin + "/#conta/instituicao" }); }); }
  function sair() { return iniciar().then(function () { return auth.signOut(); }); }
  function recarregarUsuario() { return iniciar().then(function () { return auth.currentUser ? auth.currentUser.reload().then(function () { usuario = auth.currentUser; avisar(); return auth.currentUser.getIdToken(true); }) : null; }); }

  function aoMudarUsuario(f) {
    ouvintes.push(f);
    if (!ativo()) { f(null); return; }
    // Só carrega o Firebase de imediato se a pessoa já tiver entrado antes neste aparelho.
    if (temSessaoSalva()) iniciar().catch(function () { f(null); }); else f(null);
  }
  function temSessaoSalva() {
    try { for (var i = 0; i < localStorage.length; i++) if (/^firebase:authUser:/.test(localStorage.key(i))) return true; } catch (e) { /* ok */ }
    // Firebase compat guarda a sessão no IndexedDB; marcador próprio para saber se vale carregar.
    try { return localStorage.getItem("eli-logado") === "1"; } catch (e) { return false; }
  }
  aoMudarUsuarioInterno();
  function aoMudarUsuarioInterno() {
    ouvintes.push(function (u) { try { if (u) localStorage.setItem("eli-logado", "1"); else localStorage.removeItem("eli-logado"); } catch (e) { /* ok */ } });
  }

  function isAdminUser(u) {
    var admins = (CFG.ADMINS || []).map(function (x) { return x.toLowerCase(); });
    return !!(u && u.email && u.emailVerified && admins.indexOf(u.email.toLowerCase()) > -1);
  }

  /* ---------------- leitura pública via REST (leve, sem carregar o SDK) ---------------- */
  function rest(caminho) { return "https://firestore.googleapis.com/v1/projects/" + CFG.FIREBASE.projectId + "/databases/(default)/documents" + caminho + "?key=" + CFG.FIREBASE.apiKey; }
  function decodificar(v) {
    if (!v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return +v.integerValue;
    if ("doubleValue" in v) return v.doubleValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return new Date(v.timestampValue);
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodificar);
    if ("mapValue" in v) { var o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = decodificar(f[k]); }); return o; }
    return null;
  }
  function codificar(x) {
    if (typeof x === "boolean") return { booleanValue: x };
    if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
    if (x === null || x === undefined) return { nullValue: null };
    return { stringValue: String(x) };
  }
  function lista(colecao) {
    if (!ativo()) return Promise.reject(new Error("off"));
    var c = cache[colecao];
    if (c && Date.now() - c.t < CACHE_MS) return Promise.resolve(c.d);
    var corpo = { structuredQuery: { from: [{ collectionId: colecao }], where: { fieldFilter: { field: { fieldPath: "oculto" }, op: "EQUAL", value: { booleanValue: false } } } } };
    return fetch(rest(":runQuery"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (linhas) {
        var d = (linhas || []).filter(function (l) { return l.document; }).map(function (l) {
          var o = decodificar({ mapValue: { fields: l.document.fields } }); o.id = l.document.name.split("/").pop(); return o;
        });
        cache[colecao] = { t: Date.now(), d: d };
        return d;
      });
  }
  // Itens que o Admin marcou como públicos (Área dos Atores), sem login.
  function listaPublica(colecao) {
    if (!ativo()) return Promise.reject(new Error("off"));
    var chave = colecao + ":publico", c = cache[chave];
    if (c && Date.now() - c.t < CACHE_MS) return Promise.resolve(c.d);
    var corpo = { structuredQuery: { from: [{ collectionId: colecao }], where: { fieldFilter: { field: { fieldPath: "publico" }, op: "EQUAL", value: { booleanValue: true } } } } };
    return fetch(rest(":runQuery"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (linhas) {
        var d = (linhas || []).filter(function (l) { return l.document; }).map(function (l) {
          var o = decodificar({ mapValue: { fields: l.document.fields } }); o.id = l.document.name.split("/").pop(); return o;
        });
        cache[chave] = { t: Date.now(), d: d };
        return d;
      });
  }
  function limparCache(colecao) { if (colecao) delete cache[colecao]; else cache = {}; }

  /* ---------------- escrita do usuário ---------------- */
  function agora() { return window.firebase.firestore.FieldValue.serverTimestamp(); }

  function minhaInstituicao() {
    return iniciar().then(function () {
      if (!auth.currentUser) return null;
      return db.collection("instituicoes").doc(auth.currentUser.uid).get().then(function (d) { return d.exists ? d.data() : null; });
    });
  }
  function salvarInstituicao(dados) {
    return iniciar().then(function () {
      var uid = auth.currentUser.uid, ref = db.collection("instituicoes").doc(uid);
      return ref.get().then(function (d) {
        var o = Object.assign({}, dados, { dono: uid, atualizadoEm: agora() });
        if (!d.exists) { o.criadoEm = agora(); o.oculto = false; return ref.set(o); }
        o.criadoEm = d.data().criadoEm; o.oculto = d.data().oculto;
        return ref.set(o);
      });
    }).then(function () { limparCache("instituicoes"); });
  }
  function meus(colecao) {
    return iniciar().then(function () {
      return db.collection(colecao).where("dono", "==", auth.currentUser.uid).get();
    }).then(function (snap) { return snap.docs.map(function (doc) { var o = doc.data(); o.id = doc.id; return o; }); });
  }
  function salvar(colecao, id, dados) {
    return iniciar().then(function () {
      var uid = auth.currentUser.uid;
      var o = Object.assign({}, dados, { dono: uid, atualizadoEm: agora() });
      if (!id) { o.criadoEm = agora(); o.oculto = false; return db.collection(colecao).add(o); }
      var ref = db.collection(colecao).doc(id);
      return ref.get().then(function (d) {
        o.criadoEm = d.data().criadoEm; o.oculto = d.data().oculto;
        return ref.set(o);
      });
    }).then(function (r) { limparCache(colecao); return r; });
  }
  function excluir(colecao, id) {
    return iniciar().then(function () { return db.collection(colecao).doc(id).delete(); }).then(function () { limparCache(colecao); });
  }
  function excluirConta() {
    return iniciar().then(function () {
      var uid = auth.currentUser.uid;
      function apagarDe(c) {
        return db.collection(c).where("dono", "==", uid).get().then(function (s) { return Promise.all(s.docs.map(function (d) { return d.ref.delete(); })); });
      }
      // Área dos Atores: só dá para listar enquanto a pessoa é membro; por isso vem antes de apagar o pedido de acesso.
      function apagarDaArea(c) { return apagarDe(c).catch(function () { /* não era membro: nada a apagar */ }); }
      return Promise.all([apagarDe("eventos"), apagarDe("programas"), apagarDaArea("notas"), apagarDaArea("documentos")])
        .then(function () { return db.collection("membros").doc(uid).delete().catch(function () { /* ok */ }); })
        .then(function () { return db.collection("instituicoes").doc(uid).delete(); })
        .then(function () { return auth.currentUser.delete(); });
    }).then(function () { limparCache(); });
  }

  /* ---------------- estatísticas anônimas ---------------- */
  // Grava direto pela interface REST, com a hora do servidor (o site do visitante não carrega o SDK).
  function registrar(h) {
    if (!ativo()) return;
    var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var nome = "projects/" + CFG.FIREBASE.projectId + "/databases/(default)/documents/acessos/" + id;
    var fields = {}; Object.keys(h).forEach(function (k) { fields[k] = codificar(h[k]); });
    var corpo = { writes: [{ update: { name: nome, fields: fields }, updateTransforms: [{ fieldPath: "quando", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: false } }] };
    try {
      fetch(rest(":commit"), { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(function () { /* ok */ });
    } catch (e) { /* sem estatística, sem problema */ }
  }

  /* ---------------- Admin ---------------- */
  function acessosDesde(inicio) {
    return iniciar().then(function () {
      return db.collection("acessos").where("quando", ">=", window.firebase.firestore.Timestamp.fromDate(inicio)).orderBy("quando").get();
    }).then(function (s) { return s.docs.map(function (d) { var o = d.data(); o.quando = o.quando && o.quando.toDate ? o.quando.toDate() : null; return o; }); });
  }
  function todos(colecao) {
    return iniciar().then(function () { return db.collection(colecao).get(); })
      .then(function (s) { return s.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); });
  }
  function moderar(colecao, id, oculto) {
    return iniciar().then(function () { return db.collection(colecao).doc(id).update({ oculto: !!oculto }); }).then(function () { limparCache(colecao); });
  }

  /* ---------------- Área dos Atores ---------------- */
  function comId(d) { var o = d.data(); o.id = d.id; return o; }
  function meuPedido() {
    return iniciar().then(function () {
      if (!auth.currentUser) return null;
      return db.collection("membros").doc(auth.currentUser.uid).get().then(function (d) { return d.exists ? d.data() : null; });
    });
  }
  function pedirAcesso(dados) {
    return iniciar().then(function () {
      var u = auth.currentUser;
      return db.collection("membros").doc(u.uid).set({
        email: u.email, nome: String(u.displayName || "").slice(0, 100),
        instituicao: dados.instituicao, mensagem: dados.mensagem || "", status: "pendente", pedidoEm: agora()
      });
    });
  }
  function cancelarPedido() { return iniciar().then(function () { return db.collection("membros").doc(auth.currentUser.uid).delete(); }); }
  function decidirMembro(uid, status) {
    return iniciar().then(function () { return db.collection("membros").doc(uid).update({ status: status, decididoEm: agora() }); });
  }
  function daArea(colecao) {
    return iniciar().then(function () { return db.collection(colecao).get(); })
      .then(function (s) { return s.docs.map(comId); });
  }
  // Grava na Área: mantém dono e data de criação; quem não é Admin não muda o "publico".
  function salvarArea(colecao, id, dados) {
    return iniciar().then(function () {
      var uid = auth.currentUser.uid;
      var o = Object.assign({}, dados, { atualizadoEm: agora() });
      if (!id) { o.dono = uid; o.criadoEm = agora(); return db.collection(colecao).add(o); }
      var ref = db.collection(colecao).doc(id);
      return ref.get().then(function (d) {
        var antes = d.data();
        o.dono = antes.dono; o.criadoEm = antes.criadoEm;
        if (colecao === "notas") return ref.update({ texto: o.texto, atualizadoEm: o.atualizadoEm });
        if (!isAdminUser(auth.currentUser) && "publico" in antes) o.publico = antes.publico;
        return ref.set(o);
      });
    }).then(function (r) { limparCache(colecao + ":publico"); return r; });
  }
  function excluirArea(colecao, id) {
    return iniciar().then(function () { return db.collection(colecao).doc(id).delete(); }).then(function () { limparCache(colecao + ":publico"); });
  }

  window.ELI_FB = {
    ativo: ativo, iniciar: iniciar, msg: msg,
    google: google, entrar: entrar, cadastrar: cadastrar, recuperar: recuperar, reenviar: reenviar, sair: sair,
    recarregarUsuario: recarregarUsuario, aoMudarUsuario: aoMudarUsuario, usuario: function () { return usuario; }, isAdmin: isAdminUser,
    lista: lista, limparCache: limparCache,
    minhaInstituicao: minhaInstituicao, salvarInstituicao: salvarInstituicao,
    meus: meus, salvar: salvar, excluir: excluir, excluirConta: excluirConta,
    registrar: registrar, acessosDesde: acessosDesde, todos: todos, moderar: moderar,
    listaPublica: listaPublica, meuPedido: meuPedido, pedirAcesso: pedirAcesso, cancelarPedido: cancelarPedido,
    decidirMembro: decidirMembro, daArea: daArea, salvarArea: salvarArea, excluirArea: excluirArea
  };
})();
