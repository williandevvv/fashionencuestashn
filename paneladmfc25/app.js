import { auth, db } from '../firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import {
  collection,
  getDocs,
  orderBy,
  query,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const dashboard = document.getElementById('dashboard');
const loginCard = document.getElementById('loginCard');

const totalResponsesEl = document.getElementById('totalResponses');
const avgQ1El = document.getElementById('avgQ1');
const avgQ2El = document.getElementById('avgQ2');
const modeQ1El = document.getElementById('modeQ1');
const modeQ1CountEl = document.getElementById('modeQ1Count');
const modeQ2El = document.getElementById('modeQ2');
const modeQ2CountEl = document.getElementById('modeQ2Count');
const commentsList = document.getElementById('commentsList');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const testConnBtn = document.getElementById('testConnBtn');
const connStatus = document.getElementById('connStatus');
const copyRules = document.getElementById('copyRules');
const rulesText = document.getElementById('rulesText');

let chartQ1;
let chartQ2;
let cachedResponses = [];

const showDashboard = () => {
  loginCard.classList.add('hidden');
  dashboard.classList.remove('hidden');
};

const showLogin = () => {
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
};

const fetchResponses = async () => {
  const snapshot = await getDocs(query(collection(db, 'responses'), orderBy('createdAt', 'desc')));
  cachedResponses = snapshot.docs.map((doc) => doc.data());
  renderStats();
  renderCharts();
  renderComments();
};

const calculateAverage = (numbers) => {
  if (!numbers.length) return '-';
  const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  return avg.toFixed(2);
};

const calculateMode = (numbers) => {
  if (!numbers.length) return { value: '-', count: 0 };
  const counts = numbers.reduce((acc, n) => {
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts).map(([value, count]) => ({ value: Number(value), count }));
  entries.sort((a, b) => b.count - a.count || a.value - b.value);
  return entries[0];
};

const renderStats = () => {
  const q1Values = cachedResponses.map((r) => r.q1).filter(Number.isFinite);
  const q2Values = cachedResponses.map((r) => r.q2).filter(Number.isFinite);

  totalResponsesEl.textContent = cachedResponses.length.toString();
  avgQ1El.textContent = calculateAverage(q1Values);
  avgQ2El.textContent = calculateAverage(q2Values);

  const mode1 = calculateMode(q1Values);
  const mode2 = calculateMode(q2Values);
  modeQ1El.textContent = mode1.value;
  modeQ1CountEl.textContent = mode1.count ? `${mode1.count} votos` : '';
  modeQ2El.textContent = mode2.value;
  modeQ2CountEl.textContent = mode2.count ? `${mode2.count} votos` : '';
};

const buildCounts = (values) => {
  const counts = Array.from({ length: 10 }, (_, i) => ({ label: i + 1, count: 0 }));
  values.forEach((n) => {
    if (n >= 1 && n <= 10) counts[n - 1].count += 1;
  });
  return counts;
};

const renderCharts = () => {
  const q1Counts = buildCounts(cachedResponses.map((r) => r.q1));
  const q2Counts = buildCounts(cachedResponses.map((r) => r.q2));
  const labels = q1Counts.map((c) => c.label);

  const commonOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const buildDataset = (counts) => ({
    labels,
    datasets: [
      {
        label: 'Conteo',
        data: counts.map((c) => c.count),
        backgroundColor: '#b08b73',
        borderRadius: 8,
      },
    ],
  });

  const ctx1 = document.getElementById('chartQ1');
  const ctx2 = document.getElementById('chartQ2');

  if (chartQ1) chartQ1.destroy();
  if (chartQ2) chartQ2.destroy();

  chartQ1 = new Chart(ctx1, { type: 'bar', data: buildDataset(q1Counts), options: commonOptions });
  chartQ2 = new Chart(ctx2, { type: 'bar', data: buildDataset(q2Counts), options: commonOptions });
};

const renderComments = () => {
  const filterText = searchInput.value.trim().toLowerCase();
  const comments = cachedResponses
    .map((r) => ({ text: r.q3 || '', createdAt: r.createdAt?.toDate?.() }))
    .filter((item) => item.text)
    .filter((item) => item.text.toLowerCase().includes(filterText));

  commentsList.innerHTML = '';

  if (!comments.length) {
    commentsList.innerHTML = '<p class="muted">No hay comentarios para mostrar.</p>';
    return;
  }

  comments.forEach((comment) => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    const date = comment.createdAt ? comment.createdAt.toLocaleString() : 'Sin fecha';
    div.innerHTML = `
      <div class="comment-meta">
        <span>Comentario</span>
        <span>${date}</span>
      </div>
      <p>${comment.text}</p>
    `;
    commentsList.appendChild(div);
  });
};

const exportCSV = () => {
  if (!cachedResponses.length) return;
  const rows = [
    ['q1', 'q2', 'q3', 'createdAt'],
    ...cachedResponses.map((r) => [
      r.q1,
      r.q2,
      (r.q3 || '').replace(/\n/g, ' '),
      r.createdAt?.toDate?.()?.toISOString?.() || '',
    ]),
  ];
  const csvContent = rows
    .map((row) => row.map((cell) => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'respuestas.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const testConnection = async () => {
  connStatus.textContent = 'Probando conexión...';
  try {
    await getDocs(query(collection(db, 'responses'), orderBy('createdAt', 'desc')));
    connStatus.textContent = 'Conexión exitosa. El usuario tiene permisos de lectura.';
    connStatus.style.color = '#2f7d55';
  } catch (error) {
    console.error('Error al probar conexión', error);
    connStatus.textContent = 'No se pudo leer la colección. Verifica Auth y reglas.';
    connStatus.style.color = '#d66b6b';
  }
};

const copyRulesToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(rulesText.textContent.trim());
    connStatus.textContent = 'Reglas copiadas al portapapeles.';
    connStatus.style.color = '#2f7d55';
  } catch (error) {
    connStatus.textContent = 'No se pudieron copiar las reglas.';
    connStatus.style.color = '#d66b6b';
  }
};

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
  } catch (error) {
    console.error('Login error', error);
    loginError.textContent = 'No pudimos iniciar sesión. Revisa tus credenciales.';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));
searchInput.addEventListener('input', renderComments);
exportBtn.addEventListener('click', exportCSV);
testConnBtn.addEventListener('click', testConnection);
copyRules.addEventListener('click', copyRulesToClipboard);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    showDashboard();
    await fetchResponses();
  } else {
    showLogin();
  }
});
