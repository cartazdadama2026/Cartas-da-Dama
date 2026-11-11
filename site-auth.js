// Interface de login do site: botão 🧙‍♀️, modal, menu do usuário e depoimentos vindos do Firestore.
import { configured, onUser, signInGoogle, logout, watchTestimonials, watchPrices, createOrder, authMsg } from './firebase.js';

const $ = id => document.getElementById(id);
const loginBtns = document.querySelectorAll('.js-login');
const modal = $('authModal'), menu = $('userMenu');
let current = null, pendingLogin = null, resolveReady;

const setErr = (t, ok = false) => { $('authErr').textContent = t; $('authErr').className = 'text-sm mt-3 min-h-[1.25rem] ' + (ok ? 'text-olive-400' : 'text-rose-300'); };
const openModal = () => { setErr(''); modal.classList.remove('hidden'); modal.classList.add('flex'); if (!configured) setErr('O login ainda não foi configurado neste site (veja FIREBASE-SETUP.md).'); };
const closeModal = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
const dismiss = () => { pendingLogin = null; closeModal(); }; // fechar sem entrar cancela a ação que dependia do login

$('authClose').onclick = dismiss;
modal.addEventListener('click', e => { if (e.target === modal) dismiss(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { dismiss(); menu.classList.add('hidden'); } });

loginBtns.forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  if (current) menu.classList.toggle('hidden'); else openModal();
}));
document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.add('hidden'); });

async function run(fn) {
  if (!configured) return setErr('O login ainda não foi configurado neste site (veja FIREBASE-SETUP.md).');
  const btns = modal.querySelectorAll('button'); btns.forEach(b => b.disabled = true);
  try { await fn(); closeModal(); }
  catch (e) { setErr(authMsg(e)); }
  finally { btns.forEach(b => b.disabled = false); }
}
$('authGoogle').onclick = () => run(signInGoogle);
$('logoutBtn').onclick = async () => { menu.classList.add('hidden'); await logout(); };

function paint(state) {
  current = state;
  const first = state ? (state.profile.nome || state.user.displayName || state.user.email || '').split(' ')[0] : '';
  const isAdmin = !!state && state.profile.role === 'admin';
  loginBtns.forEach(b => { b.innerHTML = state ? `🧙‍♀️ <span>Olá, ${first.replace(/[<>&"']/g, '')}</span>` : '🧙‍♀️ <span>Entrar</span>'; b.title = state ? 'Minha conta' : 'Entrar ou criar conta'; });
  $('userMenuName').textContent = state ? (state.profile.nome || state.user.displayName || first) : '';
  $('userMenuAvatar').textContent = (first || '?').charAt(0).toUpperCase();
  $('userMenuEmail').textContent = state ? (state.user.email || '') : '';
  $('userMenuRole').textContent = isAdmin ? 'Administradora' : 'Cliente';
  document.querySelectorAll('.js-admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  $('addTestimonialBtn').classList.toggle('hidden', !isAdmin);
  resolveReady();
  if (state && pendingLogin) { const go = pendingLogin; pendingLogin = null; go(); } // retoma o pedido após o login
}

// Ponte para o script da loja (index.html): saber quem está logado, pedir login e gravar pedidos.
window.cartasAuth = {
  configured,
  ready: new Promise(r => { resolveReady = r; }),
  get user() { return current ? current.user : null; },
  get profile() { return current ? current.profile : null; },
  openLogin(msg, onDone) { pendingLogin = onDone || null; openModal(); if (configured && msg) setErr(msg, true); },
  saveOrder: createOrder
};
onUser(paint);

// Preços definidos pela admin (em tempo real)
if (configured) watchPrices(p => window.setPrices && window.setPrices(p), e => console.warn('Preços indisponíveis:', e.message));

// Depoimentos: os do Firestore (em tempo real) primeiro, depois os fixos de depoimentos.json
(async () => {
  if (!configured) return;
  const fixed = await window.staticTestimonialsReady;
  watchTestimonials(remote => window.renderTestimonials([...remote, ...fixed]),
    e => console.warn('Depoimentos do Firestore indisponíveis:', e.message));
})();
