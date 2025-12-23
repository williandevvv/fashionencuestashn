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
  updateDoc,
  addDoc,
  deleteDoc,
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
const refreshBtn = document.getElementById('refreshBtn');
const detailGrid = document.getElementById('detailGrid');
const chartQ1Title = document.getElementById('chartQ1Title');
const chartQ2Title = document.getElementById('chartQ2Title');
const questionsAdmin = document.getElementById('questionsAdmin');
const questionForm = document.getElementById('questionForm');
const questionText = document.getElementById('questionText');
const questionType = document.getElementById('questionType');
const questionScale = document.getElementById('questionScale');
const questionRequired = document.getElementById('questionRequired');
const questionOrder = document.getElementById('questionOrder');
const questionFeedback = document.getElementById('questionFeedback');
const scaleField = document.getElementById('scaleField');
const pinFormAdmin = document.getElementById('pinForm');
const currentPin = document.getElementById('currentPin');
const newPin = document.getElementById('newPin');
const confirmPin = document.getElementById('confirmPin');
const pinFeedback = document.getElementById('pinFeedback');
const visibilityToggles = document.querySelectorAll('.toggle-visibility');

let chartQ1;
let chartQ2;
let cachedResponses = [];
let cachedQuestions = [];
let currentAccessPin = '';

const defaultQuestions = [
  { id: 'q1', text: 'Califica tu experiencia general (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 1 },
  { id: 'q2', text: '¿Qué tan probable es que nos recomiendes? (1 - 10)', type: 'rating', required: true, scaleMax: 10, order: 2 },
  { id: 'q3', text: 'Comentarios', type: 'text', required: false, order: 3 },
];

const setQuestionFeedbackMessage = (message) => {
  questionFeedback.textContent = message;
};

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
  currentAccessPin = pinDoc.exists() ? pinDoc.data()?.pin || '' : '';
};

const fetchResponses = async () => {
  const snapshot = await getDocs(query(collection(db, 'responses'), orderBy('createdAt', 'desc')));
  cachedResponses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderStats();
  renderCharts();
  renderComments();
  renderDetail();
};

const loadDashboardData = async () => {
  await Promise.all([fetchQuestions(), fetchAccessPin()]);
  await fetchResponses();
  renderQuestionsAdmin();
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

const renderQuestionsAdmin = () => {
  const questions = (cachedQuestions.length ? cachedQuestions : defaultQuestions).sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  questionsAdmin.innerHTML = '';

  questions.forEach((q) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'question-admin';
    wrapper.dataset.id = q.id;
    wrapper.innerHTML = `
      <div class="question-admin__header">
        <div>
          <p class="eyebrow">${q.id}</p>
          <h4>${q.text}</h4>
        </div>
        <div class="question-actions">
          <button class="btn ghost" type="button" data-action="save">Guardar</button>
          <button class="btn danger" type="button" data-action="delete">Eliminar</button>
        </div>
      </div>
      <div class="grid two-cols">
        <label class="field">
          <span>Título</span>
          <input type="text" class="qa-text" value="${q.text || ''}">
        </label>
        <label class="field">
          <span>Tipo</span>
          <select class="qa-type">
            <option value="rating" ${q.type === 'rating' ? 'selected' : ''}>Escala numérica</option>
            <option value="text" ${q.type === 'text' ? 'selected' : ''}>Texto</option>
          </select>
        </label>
      </div>
      <div class="grid two-cols">
        <label class="field">
          <span>Escala máx. (solo numérica)</span>
          <input type="number" class="qa-scale" min="2" max="10" value="${q.scaleMax || 10}" ${q.type !== 'rating' ? 'disabled' : ''}>
        </label>
        <label class="field">
          <span>Obligatoria</span>
          <select class="qa-required">
            <option value="true" ${q.required ? 'selected' : ''}>Sí</option>
            <option value="false" ${!q.required ? 'selected' : ''}>No</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>Orden</span>
        <input type="number" class="qa-order" min="1" value="${q.order || 1}">
      </label>
      <p class="muted qa-feedback"></p>
    `;
    questionsAdmin.appendChild(wrapper);
  });
};

const saveQuestion = async (id, payload) => {
  await setDoc(doc(db, 'questions', id), payload, { merge: true });
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

questionType.addEventListener('change', () => {
  scaleField.classList.toggle('hidden', questionType.value !== 'rating');
});

questionsAdmin.addEventListener('change', (event) => {
  if (!event.target.classList.contains('qa-type')) return;
  const card = event.target.closest('.question-admin');
  const scaleInput = card?.querySelector('.qa-scale');
  if (scaleInput) scaleInput.disabled = event.target.value !== 'rating';
});

questionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  questionFeedback.textContent = '';

  const payload = {
    text: questionText.value.trim(),
    type: questionType.value,
    required: questionRequired.value === 'true',
    order: Number(questionOrder.value) || 1,
    scaleMax: Number(questionScale.value) || 10,
  };

  if (!payload.text) {
    questionFeedback.textContent = 'Ingresa el texto de la pregunta.';
    return;
  }

  try {
    await addDoc(collection(db, 'questions'), payload);
    questionFeedback.textContent = 'Pregunta guardada correctamente.';
    questionForm.reset();
    scaleField.classList.remove('hidden');
    await loadDashboardData();
  } catch (error) {
    console.error('No se pudo guardar la pregunta', error);
    questionFeedback.textContent = 'Hubo un error al guardar.';
  }
});

questionsAdmin.addEventListener('click', async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.target.closest('.question-admin');
  const id = card?.dataset.id;
  const textInput = card.querySelector('.qa-text');
  const typeSelect = card.querySelector('.qa-type');
  const scaleInput = card.querySelector('.qa-scale');
  const requiredSelect = card.querySelector('.qa-required');
  const orderInput = card.querySelector('.qa-order');
  const cardFeedback = card.querySelector('.qa-feedback');

  const payload = {
    text: textInput.value.trim(),
    type: typeSelect.value,
    scaleMax: Math.min(Math.max(Number(scaleInput.value) || 10, 2), 10),
    required: requiredSelect.value === 'true',
    order: Math.max(Number(orderInput.value) || 1, 1),
  };

  cardFeedback.textContent = '';

  if (!id) return;

  if (!payload.text) {
    cardFeedback.textContent = 'Escribe el título de la pregunta.';
    return;
  }

  event.target.disabled = true;
  if (action === 'delete' && !confirm('¿Eliminar esta pregunta del catálogo?')) {
    event.target.disabled = false;
    return;
  }

  try {
    if (action === 'save') {
      if (payload.type !== 'rating') delete payload.scaleMax;
      await saveQuestion(id, payload);
      cardFeedback.textContent = 'Guardado. La encuesta mostrará esta versión.';
      setQuestionFeedbackMessage('Pregunta actualizada correctamente.');
    } else if (action === 'delete') {
      await deleteDoc(doc(db, 'questions', id));
      cardFeedback.textContent = 'Pregunta eliminada.';
      setQuestionFeedbackMessage('Pregunta eliminada del catálogo.');
    }
    await loadDashboardData();
  } catch (error) {
    console.error('No se pudo actualizar la pregunta', error);
    cardFeedback.textContent = 'No se pudo completar la acción.';
  } finally {
    event.target.disabled = false;
  }
});

pinFormAdmin.addEventListener('submit', async (event) => {
  event.preventDefault();
  pinFeedback.textContent = '';

  const currentValue = sanitizePinValue(currentPin.value);
  const newValue = sanitizePinValue(newPin.value);
  const confirmValue = sanitizePinValue(confirmPin.value);

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

  try {
    await setDoc(doc(db, 'settings', 'access'), { pin: newValue });
    currentAccessPin = newValue;
    pinFeedback.textContent = 'PIN actualizado. Usa este valor en la encuesta.';
    pinFormAdmin.reset();
  } catch (error) {
    console.error('No se pudo actualizar el PIN', error);
    pinFeedback.textContent = 'Error al guardar el PIN.';
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
