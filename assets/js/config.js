/* ==========================================================
   Configuração do site ELI Pouso Alegre
   ========================================================== */
window.ELI_CONFIG = {
  // Projeto Firebase (contas, eventos, programas, Vitrine e estatísticas).
  // Estes dados são públicos por natureza: a segurança fica nas regras (firestore.rules).
  // Enquanto estiver null, o site funciona só com os eventos de assets/js/eventos.js.
  FIREBASE: {
    apiKey: "AIzaSyAnSg5N1Ikss4x3lq5VYe1gu6c5ofavNHI",
    authDomain: "elipousoalegre.firebaseapp.com",
    projectId: "elipousoalegre",
    storageBucket: "elipousoalegre.firebasestorage.app",
    messagingSenderId: "623719263221",
    appId: "1:623719263221:web:8a33add1c2c373849e4ebc"
  },

  // Contas com acesso ao Painel Admin e à moderação (precisam ter o e-mail confirmado).
  // Ao mudar esta lista, mude também firestore.rules (função isAdmin).
  ADMINS: ["mateushope.oficial@gmail.com"],

  // Mostrar eventos de exemplo junto com os reais? Deixe false quando a agenda tiver eventos de verdade.
  MOSTRAR_EXEMPLOS: false,

  // Fuso usado nos links do Google Agenda e nos arquivos .ics
  FUSO: "America/Sao_Paulo"
};
