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
  doc,
  getDoc,
  setDoc,
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
const medianQ1El = document.getElementById('medianQ1');
const medianQ2El = document.getElementById('medianQ2');
const positiveQ1El = document.getElementById('positiveQ1');
const positiveQ2El = document.getElementById('positiveQ2');
const detractorsQ1El = document.getElementById('detractorsQ1');
const detractorsQ2El = document.getElementById('detractorsQ2');
const commentsList = document.getElementById('commentsList');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const detailGrid = document.getElementById('detailGrid');
const chartQ1Title = document.getElementById('chartQ1Title');
const chartQ2Title = document.getElementById('chartQ2Title');
const pinFormAdmin = document.getElementById('pinForm');
const currentPin = document.getElementById('currentPin');
const newPin = document.getElementById('newPin');
const confirmPin = document.getElementById('confirmPin');
const pinFeedback = document.getElementById('pinFeedback');
const visibilityToggles = document.querySelectorAll('.toggle-visibility');
const insightsList = document.getElementById('insightsList');

const DEFAULT_ACCESS_PIN = 'FCHN2025@';

let chartQ1;
let chartQ2;
let cachedResponses = [];
let cachedQuestions = [];
let currentAccessPin = DEFAULT_ACCESS_PIN;

const defaultQuestions = [
  { id: 'q1', text: 'Califica tu experiencia general (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 1 },
  { id: 'q2', text: '¿Qué tan probable es que nos recomiendes? (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 2 },
  { id: 'q3', text: 'Comentarios', type: 'text', required: false, order: 3 },
];

const sanitizePinValue = (value) => value.trim();

const togglePasswordVisibility = (button) => {
  const input = document.getElementById(button.dataset.target);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.setAttribute('aria-pressed', (!showing).toString());
  button.textContent = showing ? '👁' : '🙈';
};

visibilityToggles.forEach((button) => {
  button.addEventListener('click', () => togglePasswordVisibility(button));
});

const showDashboard = () => {
  loginCard.classList.add('hidden');
  dashboard.classList.remove('hidden');
};

const showLogin = () => {
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
};

const fetchQuestions = async () => {
  const snapshot = await getDocs(query(collection(db, 'questions'), orderBy('order', 'asc')));
  cachedQuestions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (!cachedQuestions.length) cachedQuestions = [...defaultQuestions];
};

const fetchAccessPin = async () => {
  const pinDoc = await getDoc(doc(db, 'settings', 'access'));
  currentAccessPin = pinDoc.exists() ? pinDoc.data()?.pin || DEFAULT_ACCESS_PIN : DEFAULT_ACCESS_PIN;
};

const fetchResponses = async () => {
  const snapshot = await getDocs(query(collection(db, 'responses'), orderBy('createdAt', 'desc')));
  cachedResponses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderStats();
  renderCharts();
  renderComments();
  renderDetail();
  renderInsights();
};

const loadDashboardData = async () => {
  await Promise.all([fetchQuestions(), fetchAccessPin()]);
  await fetchResponses();
};

const calculateAverage = (numbers) => {
  if (!numbers.length) return '-';
  const avg = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  return avg.toFixed(2);
};

const calculateMedian = (numbers) => {
  if (!numbers.length) return '-';
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
  return sorted[mid].toFixed(2);
};

const calculatePercent = (numbers, predicate) => {
  if (!numbers.length) return '-';
  const total = numbers.length;
  const count = numbers.filter(predicate).length;
  return `${((count / total) * 100).toFixed(1)}%`;
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

const getRatingQuestions = () => {
  const ratings = cachedQuestions
    .filter((q) => q.type === 'rating')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!ratings.length) return defaultQuestions.filter((q) => q.type === 'rating');
  return ratings;
};

const getTextQuestions = () =>
  (cachedQuestions.length ? cachedQuestions : defaultQuestions).filter((q) => q.type === 'text');

const extractAnswer = (response, questionId) => {
  if (response.answers && response.answers[questionId] !== undefined) return response.answers[questionId];
  return response[questionId];
};

const getNumericValues = (questionId) =>
  cachedResponses
    .map((response) => Number(extractAnswer(response, questionId)))
    .filter((value) => Number.isFinite(value));

const renderStats = () => {
  const ratings = getRatingQuestions();
  const first = ratings[0];
  const second = ratings[1];

  const q1Values = first ? getNumericValues(first.id) : [];
  const q2Values = second ? getNumericValues(second.id) : [];

  totalResponsesEl.textContent = cachedResponses.length.toString();
  avgQ1El.textContent = calculateAverage(q1Values);
  avgQ2El.textContent = calculateAverage(q2Values);

  const mode1 = calculateMode(q1Values);
  const mode2 = calculateMode(q2Values);
  modeQ1El.textContent = mode1.value;
  modeQ1CountEl.textContent = mode1.count ? `${mode1.count} votos` : '';
  modeQ2El.textContent = mode2.value;
  modeQ2CountEl.textContent = mode2.count ? `${mode2.count} votos` : '';

  medianQ1El.textContent = calculateMedian(q1Values);
  medianQ2El.textContent = calculateMedian(q2Values);

  positiveQ1El.textContent = calculatePercent(q1Values, (n) => n >= 8);
  positiveQ2El.textContent = calculatePercent(q2Values, (n) => n >= 8);
  detractorsQ1El.textContent = positiveQ1El.textContent === '-' ? '' : `Bajos (1-4): ${calculatePercent(q1Values, (n) => n <= 4)}`;
  detractorsQ2El.textContent = positiveQ2El.textContent === '-' ? '' : `Bajos (1-4): ${calculatePercent(q2Values, (n) => n <= 4)}`;
};

const buildCounts = (values, scaleMax = 10) => {
  const counts = Array.from({ length: scaleMax }, (_, i) => ({ label: i + 1, count: 0 }));
  values.forEach((n) => {
    if (n >= 1 && n <= scaleMax) counts[n - 1].count += 1;
  });
  return counts;
};

const renderCharts = () => {
  const ratings = getRatingQuestions();
  const q1 = ratings[0];
  const q2 = ratings[1];

  chartQ1Title.textContent = q1 ? q1.text : 'Grafica Pregunta 1';
  chartQ2Title.textContent = q2 ? q2.text : 'Grafica Pregunta 2';

  const q1Counts = buildCounts(q1 ? getNumericValues(q1.id) : [], q1?.scaleMax || 10);
  const q2Counts = buildCounts(q2 ? getNumericValues(q2.id) : [], q2?.scaleMax || 10);
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

const renderDetail = () => {
  const ratingQuestions = getRatingQuestions();
  detailGrid.innerHTML = '';

  if (!ratingQuestions.length) {
    detailGrid.innerHTML = '<p class="muted">No hay preguntas numéricas configuradas.</p>';
    return;
  }

  ratingQuestions.forEach((question) => {
    const counts = buildCounts(getNumericValues(question.id), question.scaleMax || 10);
    const maxCount = Math.max(...counts.map((c) => c.count), 0);
    const wrapper = document.createElement('div');
    wrapper.className = 'detail-card';
    wrapper.innerHTML = `
      <header>
        <p class="eyebrow">${question.id}</p>
        <h4>${question.text}</h4>
        <small class="muted">Escala 1 - ${question.scaleMax || 10}</small>
      </header>
      <ul class="detail-list">
        ${counts
          .map(
            (entry) => `
            <li>
              <span>${entry.label}</span>
              <div class="bar" aria-hidden="true">
                <span style="width:${maxCount ? (entry.count / maxCount) * 100 : 0}%"></span>
              </div>
              <strong>${entry.count}</strong>
            </li>
          `,
          )
          .join('')}
      </ul>
    `;
    detailGrid.appendChild(wrapper);
  });
};

const renderComments = () => {
  const filterText = searchInput.value.trim().toLowerCase();
  const textQuestion = getTextQuestions()[0];
  const comments = cachedResponses
    .map((r) => ({ text: (textQuestion && extractAnswer(r, textQuestion.id)) || '', createdAt: r.createdAt?.toDate?.() }))
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
  const questions = cachedQuestions.length ? cachedQuestions : defaultQuestions;
  const headers = [...questions.map((q) => q.id), 'createdAt'];
  const rows = [
    headers,
    ...cachedResponses.map((r) => {
      const answers = questions.map((q) => extractAnswer(r, q.id) ?? '');
      const created = r.createdAt?.toDate?.()?.toISOString?.() || '';
      return [...answers, created];
    }),
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

const renderInsights = () => {
  const ratingQuestions = getRatingQuestions();
  insightsList.innerHTML = '';

  if (!ratingQuestions.length) {
    insightsList.innerHTML = '<p class="muted">No hay datos para analizar.</p>';
    return;
  }

  ratingQuestions.forEach((question) => {
    const values = getNumericValues(question.id);
    const highShare = calculatePercent(values, (n) => n >= 8);
    const lowShare = calculatePercent(values, (n) => n <= 4);
    const median = calculateMedian(values);
    const mode = calculateMode(values);
    const max = values.length ? Math.max(...values) : '-';
    const min = values.length ? Math.min(...values) : '-';

    const card = document.createElement('article');
    card.className = 'insight-card';
    card.innerHTML = `
      <header>
        <p class="eyebrow">${question.id}</p>
        <h4>${question.text}</h4>
      </header>
      <ul>
        <li><strong>Mediana:</strong> ${median}</li>
        <li><strong>Moda:</strong> ${mode.value}${mode.count ? ` (${mode.count} votos)` : ''}</li>
        <li><strong>Altos (8-10):</strong> ${highShare} · <strong>Bajos (1-4):</strong> ${lowShare}</li>
        <li><strong>Máximo:</strong> ${max} · <strong>Mínimo:</strong> ${min}</li>
      </ul>
    `;
    insightsList.appendChild(card);
  });
};

const ensureAdminClaim = async () => {
  const token = await auth.currentUser?.getIdTokenResult?.();
  if (token?.claims?.admin) return true;
  throw new Error('missing-admin-claim');
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
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  await loadDashboardData();
  refreshBtn.disabled = false;
});

pinFormAdmin.addEventListener('submit', async (event) => {
  event.preventDefault();
  pinFeedback.textContent = '';

  const currentValue = sanitizePinValue(currentPin.value);
  const newValue = sanitizePinValue(newPin.value);
  const confirmValue = sanitizePinValue(confirmPin.value);
  const submitButton = pinFormAdmin.querySelector('button[type="submit"]');

  if (currentAccessPin && currentValue !== currentAccessPin) {
    pinFeedback.textContent = 'El PIN actual no coincide.';
    return;
  }

  if (!newValue) {
    pinFeedback.textContent = 'Ingresa el nuevo PIN.';
    return;
  }

  if (newValue.length < 4) {
    pinFeedback.textContent = 'El PIN debe tener al menos 4 caracteres.';
    return;
  }

  if (newValue !== confirmValue) {
    pinFeedback.textContent = 'El nuevo PIN no coincide en la confirmación.';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Guardando...';

  try {
    await setDoc(doc(db, 'settings', 'access'), { pin: newValue });
    currentAccessPin = newValue;
    pinFeedback.textContent = 'PIN actualizado. Usa este valor en la encuesta.';
    pinFormAdmin.reset();
  } catch (error) {
    console.error('No se pudo actualizar el PIN', error);
    pinFeedback.textContent =
      error.code === 'permission-denied'
        ? 'No tienes permisos para actualizar el PIN. Revisa las reglas de Firestore.'
        : 'Error al guardar el PIN.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Actualizar PIN';
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  showDashboard();

  try {
    await ensureAdminClaim();
    await loadDashboardData();
  } catch (error) {
    console.error('No se pudieron leer respuestas', error);
  }
});
