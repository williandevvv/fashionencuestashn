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
const avgQ3El = document.getElementById('avgQ3');
const avgQ4El = document.getElementById('avgQ4');
const modeQ1El = document.getElementById('modeQ1');
const modeQ1CountEl = document.getElementById('modeQ1Count');
const modeQ2El = document.getElementById('modeQ2');
const modeQ2CountEl = document.getElementById('modeQ2Count');
const modeQ3El = document.getElementById('modeQ3');
const modeQ3CountEl = document.getElementById('modeQ3Count');
const modeQ4El = document.getElementById('modeQ4');
const modeQ4CountEl = document.getElementById('modeQ4Count');
const medianQ1El = document.getElementById('medianQ1');
const medianQ2El = document.getElementById('medianQ2');
const medianQ3El = document.getElementById('medianQ3');
const medianQ4El = document.getElementById('medianQ4');
const positiveQ1El = document.getElementById('positiveQ1');
const positiveQ2El = document.getElementById('positiveQ2');
const positiveQ3El = document.getElementById('positiveQ3');
const positiveQ4El = document.getElementById('positiveQ4');
const detractorsQ1El = document.getElementById('detractorsQ1');
const detractorsQ2El = document.getElementById('detractorsQ2');
const detractorsQ3El = document.getElementById('detractorsQ3');
const detractorsQ4El = document.getElementById('detractorsQ4');
const commentsList = document.getElementById('commentsList');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const detailGrid = document.getElementById('detailGrid');
const chartQ1Title = document.getElementById('chartQ1Title');
const chartQ2Title = document.getElementById('chartQ2Title');
const chartQ3Title = document.getElementById('chartQ3Title');
const chartQ4Title = document.getElementById('chartQ4Title');
const insightsList = document.getElementById('insightsList');

let chartQ1;
let chartQ2;
let chartQ3;
let chartQ4;
let cachedResponses = [];
let cachedQuestions = [];

const defaultQuestions = [
  {
    id: 'q1',
    text: '¿Cómo evalúa la fiesta navideña proporcionada por la empresa? (1 - 10)',
    type: 'rating',
    required: true,
    scaleMax: 10,
    order: 1,
  },
  { id: 'q2', text: '¿Cómo evalúa la animación (Banda y DJ)? (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 2 },
  { id: 'q3', text: '¿Cómo evalúa la comida? (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 3 },
  { id: 'q4', text: '¿Cómo evalúa el salón? (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 4 },
  { id: 'q5', text: 'Comentarios adicionales (opcional, máx. 250 caracteres)', type: 'text', required: false, maxLength: 250, order: 5 },
];

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
  await fetchQuestions();
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

const ratingStatElements = [
  { avg: avgQ1El, mode: modeQ1El, modeCount: modeQ1CountEl, median: medianQ1El, positive: positiveQ1El, detractors: detractorsQ1El },
  { avg: avgQ2El, mode: modeQ2El, modeCount: modeQ2CountEl, median: medianQ2El, positive: positiveQ2El, detractors: detractorsQ2El },
  { avg: avgQ3El, mode: modeQ3El, modeCount: modeQ3CountEl, median: medianQ3El, positive: positiveQ3El, detractors: detractorsQ3El },
  { avg: avgQ4El, mode: modeQ4El, modeCount: modeQ4CountEl, median: medianQ4El, positive: positiveQ4El, detractors: detractorsQ4El },
];

const getNumericValues = (questionId) =>
  cachedResponses
    .map((response) => Number(extractAnswer(response, questionId)))
    .filter((value) => Number.isFinite(value));

const renderStats = () => {
  const ratings = getRatingQuestions();
  totalResponsesEl.textContent = cachedResponses.length.toString();

  ratingStatElements.forEach((elements, index) => {
    if (!elements.avg || !elements.mode || !elements.median || !elements.positive || !elements.detractors) return;
    const question = ratings[index];
    if (!question) {
      elements.avg.textContent = '-';
      elements.mode.textContent = '-';
      elements.modeCount.textContent = '';
      elements.median.textContent = '-';
      elements.positive.textContent = '-';
      elements.detractors.textContent = '';
      return;
    }

    const values = getNumericValues(question.id);
    const mode = calculateMode(values);

    elements.avg.textContent = calculateAverage(values);
    elements.mode.textContent = mode.value;
    elements.modeCount.textContent = mode.count ? `${mode.count} votos` : '';
    elements.median.textContent = calculateMedian(values);
    elements.positive.textContent = calculatePercent(values, (n) => n >= 8);
    elements.detractors.textContent =
      elements.positive.textContent === '-' ? '' : `Bajos (1-4): ${calculatePercent(values, (n) => n <= 4)}`;
  });
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
  const chartConfigs = [
    { canvasId: 'chartQ1', titleEl: chartQ1Title, getInstance: () => chartQ1, setInstance: (chart) => (chartQ1 = chart) },
    { canvasId: 'chartQ2', titleEl: chartQ2Title, getInstance: () => chartQ2, setInstance: (chart) => (chartQ2 = chart) },
    { canvasId: 'chartQ3', titleEl: chartQ3Title, getInstance: () => chartQ3, setInstance: (chart) => (chartQ3 = chart) },
    { canvasId: 'chartQ4', titleEl: chartQ4Title, getInstance: () => chartQ4, setInstance: (chart) => (chartQ4 = chart) },
  ];

  const commonOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
    plugins: {
      legend: { display: false },
    },
  };

  chartConfigs.forEach((config, index) => {
    const ctx = document.getElementById(config.canvasId);
    if (!ctx || !config.titleEl || !config.getInstance || !config.setInstance) return;
    const question = ratings[index];
    config.titleEl.textContent = question ? question.text : `Gráfica Pregunta ${index + 1}`;

    const counts = buildCounts(question ? getNumericValues(question.id) : [], question?.scaleMax || 10);
    const labels = counts.map((c) => c.label);

    const dataset = {
      labels,
      datasets: [
        {
          label: 'Conteo',
          data: counts.map((c) => c.count),
          backgroundColor: '#b08b73',
          borderRadius: 8,
        },
      ],
    };

    if (config.getInstance()) config.getInstance().destroy();
    config.setInstance(new Chart(ctx, { type: 'bar', data: dataset, options: commonOptions }));
  });
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
