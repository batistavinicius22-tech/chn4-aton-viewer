/* ==========================================================================
   CENTRO DE HIDROGRAFIA DO NORTE (CHN-4 / 4º DISTRITO NAVAL)
   Configuração de Exemplo do Firebase Cloud Firestore (Visualizador Público)
   Copie este arquivo para firebase-config.js e insira suas credenciais oficiais
   ========================================================================== */

const firebaseConfig = {
    apiKey: "SUA_CHAVE_API_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:abcdef123456"
};

let db = null;
let isFirebaseActive = false;

if (typeof firebase !== 'undefined') {
    try {
        if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("SUA_CHAVE_API_AQUI")) {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            isFirebaseActive = true;
            console.log("🔥 Firebase Cloud Firestore conectado no modo Leitura!");
        } else {
            console.log("ℹ️ Firebase SDK carregado no modo local.");
        }
    } catch (e) {
        console.warn("⚠️ Erro ao inicializar o Firebase:", e);
    }
}
