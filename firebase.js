// Camada única de acesso ao Firebase (login, perfis, depoimentos). Usada por index, admin e clientes.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAIL } from './firebase-config.js';

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('COLE');
let auth = null, db = null;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); auth.languageCode = 'pt-BR';
  db = getFirestore(app);
}

let pendingName = '';

async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { uid: user.uid, ...snap.data() };
  const data = {
    nome: pendingName || user.displayName || '',
    email: (user.email || '').toLowerCase(),
    foto: user.photoURL || '',
    role: (user.email || '').toLowerCase() === ADMIN_EMAIL ? 'admin' : 'cliente',
    criadoEm: serverTimestamp()
  };
  await setDoc(ref, data);
  return { uid: user.uid, ...data, criadoEm: null };
}

/** cb({ user, profile }) quando logado, cb(null) quando não. */
export function onUser(cb) {
  if (!configured) return cb(null);
  onAuthStateChanged(auth, async user => {
    if (!user) return cb(null);
    try { cb({ user, profile: await ensureProfile(user) }); }
    catch (e) { console.error(e); cb({ user, profile: { role: 'cliente', nome: user.displayName || '', email: user.email }, erro: e }); }
  });
}

export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInEmail = (email, senha) => signInWithEmailAndPassword(auth, email, senha);
export async function signUpEmail(nome, email, senha) {
  pendingName = nome.trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    if (pendingName) await updateProfile(cred.user, { displayName: pendingName });
    return cred;
  } finally { pendingName = ''; }
}
export const logout = () => signOut(auth);
export const resetPassword = email => sendPasswordResetEmail(auth, email);

// ---- Clientes (somente admin) ----
export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('criadoEm', 'desc')));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
export const setRole = (uid, role) => updateDoc(doc(db, 'users', uid), { role });

// ---- Depoimentos (leitura pública, escrita somente admin) ----
export async function listTestimonials() {
  const snap = await getDocs(query(collection(db, 'depoimentos'), orderBy('criadoEm', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
/** Chama cb(lista) agora e a cada mudança no banco (adicionar/remover). Retorna a função que cancela. */
export function watchTestimonials(cb, onError) {
  return onSnapshot(query(collection(db, 'depoimentos'), orderBy('criadoEm', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
}
export const addTestimonial = ({ nome, texto, imagem }) =>
  addDoc(collection(db, 'depoimentos'), { nome, texto, imagem: imagem || '', criadoEm: serverTimestamp() });
export const removeTestimonial = id => deleteDoc(doc(db, 'depoimentos', id));

// ---- Pedidos ----
export const ORDER_STATUS = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  enviado: 'Enviado',
  cancelado: 'Cancelado'
};
/** Cliente logado registra um pedido (o status inicial é sempre "aguardando_pagamento"). */
export async function createOrder(order) {
  if (!auth.currentUser) throw new Error('Entre na sua conta para fazer o pedido.');
  const ref = await addDoc(collection(db, 'pedidos'), {
    ...order,
    uid: auth.currentUser.uid,
    emailConta: (auth.currentUser.email || '').toLowerCase(),
    status: 'aguardando_pagamento',
    criadoEm: serverTimestamp()
  });
  return ref.id;
}
/** Admin: todos os pedidos, em tempo real (mais novos primeiro). */
export function watchOrders(cb, onError) {
  return onSnapshot(query(collection(db, 'pedidos'), orderBy('criadoEm', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
}
// ---- Preços (leitura pública, escrita só admin) ----
export function watchPrices(cb, onError) {
  return onSnapshot(doc(db, 'config', 'precos'), snap => cb(snap.exists() ? snap.data() : null), onError);
}
export const savePrices = ({ camiseta, caneca, leitura, leituraMinutos, avisoCamiseta = '', avisoCaneca = '', avisoLeitura = '' }) => setDoc(doc(db, 'config', 'precos'), { camiseta, caneca, leitura, leituraMinutos, avisoCamiseta, avisoCaneca, avisoLeitura, atualizadoEm: serverTimestamp() });

export const setOrderStatus = (id, status) => updateDoc(doc(db, 'pedidos', id), { status, atualizadoEm: serverTimestamp() });

// ---- Utilidades ----
export function authMsg(e) {
  const m = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite a senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Este e-mail já tem cadastro. Use "Entrar".',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
    'auth/popup-closed-by-user': 'Login com Google cancelado.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups e tente de novo.',
    'auth/operation-not-allowed': 'Este tipo de login ainda não foi ativado no Firebase.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.'
  };
  return m[e?.code] || 'Não foi possível concluir. Tente novamente.';
}
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Reduz o print para caber no limite de 1 MB do Firestore (salvo como JPEG em texto). */
export function fileToJpegDataUrl(file, maxW = 1100) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, out = c.toDataURL('image/jpeg', q);
      while (out.length > 900000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(url);
      out.length > 950000 ? reject(new Error('Imagem muito grande. Use um print menor.')) : resolve(out);
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = url;
  });
}
