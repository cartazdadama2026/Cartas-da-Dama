// Configuração do projeto Firebase "Cartaz da Dama".
// Esses valores NÃO são segredos: a segurança vem das regras do Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyCvmbTIjmgyOodXiDk979cyaoH4SaQEM2Y',
  authDomain: 'cartaz-da-dama.firebaseapp.com',
  projectId: 'cartaz-da-dama',
  storageBucket: 'cartaz-da-dama.firebasestorage.app',
  messagingSenderId: '253873246534',
  appId: '1:253873246534:web:f749145160d188787a9547'
};

// Quem se cadastrar com este e-mail vira administrador automaticamente (mesmo e-mail das regras do Firestore).
export const ADMIN_EMAIL = 'deniseadm@gmail.com';
