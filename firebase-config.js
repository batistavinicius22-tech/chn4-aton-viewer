/* ==========================================================================
   CENTRO DE HIDROGRAFIA DO NORTE (CHN-4 / 4º DISTRITO NAVAL)
   Configuração do Firebase Cloud Firestore (Banco de Dados em Tempo Real na Nuvem)
   ========================================================================== */

// Configuração Oficial do Projeto Firebase CHN-4 AtoN GIS
const firebaseConfig = {
    apiKey: "AIzaSyDJL4FNu6LEVxaI8Gjion9L5ZA0wlSnvKc",
    authDomain: "chn4-aton-gis.firebaseapp.com",
    projectId: "chn4-aton-gis",
    storageBucket: "chn4-aton-gis.firebasestorage.app",
    messagingSenderId: "720021866185",
    appId: "1:720021866185:web:6bea568c3bd29e2d886f18"
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
            console.log("🔥 Firebase Cloud Firestore conectado com sucesso!");
        } else {
            console.log("ℹ️ Firebase SDK carregado. Aguardando inserção das chaves em firebase-config.js para ativar a nuvem.");
        }
    } catch (e) {
        console.warn("⚠️ Erro ao inicializar o Firebase:", e);
    }
}
