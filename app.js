import { db } from './firebase.js';
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  getDoc,
  query,
  orderBy,
  doc,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinButton = document.getElementById('pinButton');
const pinError = document.getElementById('pinError');
const statusPill = document.getElementById('status-pill');
const surveyCard = document.getElementById('survey-card');
const surveyForm = document.getElementById('surveyForm');
const questionsContainer = document.getElementById('questionsContainer');
const pinHint = document.getElementById('pinHint');
const submitBtn = document.getElementById('submitBtn');
const resetBtn = document.getElementById('resetBtn');
const successMsg = document.getElementById('successMsg');
const errorMsg = document.getElementById('errorMsg');

let surveyState = 'locked';
let questions = [];
const DEFAULT_ACCESS_PIN = 'FCHN2025';
let accessPin = DEFAULT_ACCESS_PIN;

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
  {
    id: 'q5',
    text: 'En que podríamos mejorar ? ( máximo 500 caracteres)',
    type: 'text',
    required: true,
    maxLength: 500,
    order: 5,
  },
];

const loadQuestions = async () => {
  const snapshot = await getDocs(query(collection(db, 'questions'), orderBy('order', 'asc')));
  questions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (!questions.length) questions = [...defaultQuestions];
};

const loadAccessPin = async () => {
  const pinDoc = await getDoc(doc(db, 'settings', 'access'));
  accessPin = pinDoc.exists() ? pinDoc.data()?.pin || DEFAULT_ACCESS_PIN : DEFAULT_ACCESS_PIN;
  pinHint.textContent = 'PIN administrado desde el panel. Solicítalo a tu coordinador.';
};

const setStatusPill = (text, variant) => {
  statusPill.textContent = text;
  statusPill.className = `pill ${variant}`;
};

const getControls = () => Array.from(questionsContainer.querySelectorAll('input, select, textarea'));

const setFormDisabled = (disabled) => {
  getControls().forEach((el) => {
    el.disabled = disabled;
  });
  submitBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  surveyCard.classList.toggle('locked', disabled);
};

const unlockSurvey = () => {
  surveyState = 'ready';
  setFormDisabled(false);
  setStatusPill('Listo para responder', 'ready');
  pinError.textContent = '';
  successMsg.textContent = '';
  errorMsg.textContent = '';
};

const lockSurvey = () => {
  surveyState = 'locked';
  setFormDisabled(true);
  setStatusPill('Bloqueado', 'locked');
};

const isValidPin = (value) => value.trim() === accessPin;

const renderQuestions = () => {
  const items = (questions.length ? questions : defaultQuestions).sort((a, b) => (a.order || 0) - (b.order || 0));
  questionsContainer.innerHTML = '';

  items.forEach((question, index) => {
    const field = document.createElement('label');
    field.className = 'field';
    field.dataset.questionId = question.id;

    const title = document.createElement('span');
    title.textContent = `${index + 1}) ${question.text}`;
    field.appendChild(title);

    if (question.type === 'rating') {
      const select = document.createElement('select');
      select.required = question.required;
      select.innerHTML = `<option value="" disabled selected>Selecciona un número</option>`;
      const scaleMax = question.scaleMax || 10;
      Array.from({ length: scaleMax }, (_, i) => i + 1).forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      field.appendChild(select);
    } else {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Escribe tu respuesta';
      textarea.maxLength = question.maxLength || 250;
      textarea.required = question.required;
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      const counterValue = document.createElement('span');
      counterValue.textContent = '0';
      counter.appendChild(counterValue);
      counter.insertAdjacentText('beforeend', `/${textarea.maxLength}`);
      textarea.addEventListener('input', () => {
        counterValue.textContent = textarea.value.length.toString();
      });
      field.appendChild(textarea);
      field.appendChild(counter);
    }

    questionsContainer.appendChild(field);
  });
};

const validatePin = () => {
  if (!isValidPin(pinInput.value)) {
    pinError.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
    lockSurvey();
    pinInput.focus();
    return false;
  }
  unlockSurvey();
  getControls()[0]?.focus();
  return true;
};

const resetForm = () => {
  surveyForm.reset();
  questionsContainer.querySelectorAll('.char-counter span:first-child').forEach((el) => {
    el.textContent = '0';
  });
  successMsg.textContent = '';
  errorMsg.textContent = '';
  pinError.textContent = '';
  lockSurvey();
  pinInput.value = '';
  pinInput.focus();
};

const sanitizeNumber = (value, scaleMax = 10) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= scaleMax ? num : null;
};

const handleSubmit = async (event) => {
  event.preventDefault();

  if (surveyState === 'sent') {
    errorMsg.textContent = 'Esta respuesta ya fue enviada. Ingresa el PIN para responder de nuevo.';
    pinInput.focus();
    return;
  }

  if (surveyState !== 'ready') {
    errorMsg.textContent = 'Debes ingresar el PIN para responder.';
    pinInput.focus();
    return;
  }

  const orderedQuestions = (questions.length ? questions : defaultQuestions).sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  const answers = {};

  for (const question of orderedQuestions) {
    const field = questionsContainer.querySelector(`[data-question-id="${question.id}"]`);
    const control = field?.querySelector('select, textarea, input');
    if (!control) continue;

    let value = '';
    if (question.type === 'rating') {
      value = sanitizeNumber(control.value, question.scaleMax || 10);
    } else {
      value = (control.value || '').trim().slice(0, question.maxLength || 250);
    }

    if (question.required && (value === '' || value === null)) {
      errorMsg.textContent = 'Completa todas las preguntas obligatorias.';
      control.focus();
      return;
    }

    answers[question.id] = value;
  }

  surveyState = 'sending';
  setFormDisabled(true);
  errorMsg.textContent = '';
  successMsg.textContent = 'Enviando...';
  setStatusPill('Enviando...', 'sending');

  try {
    const payload = { answers, createdAt: serverTimestamp() };
    if (Number.isFinite(answers.q1)) payload.q1 = answers.q1;
    if (Number.isFinite(answers.q2)) payload.q2 = answers.q2;
    if (Number.isFinite(answers.q3)) payload.q3 = answers.q3;
    if (Number.isFinite(answers.q4)) payload.q4 = answers.q4;
    if (answers.q5) payload.q5 = answers.q5;
    await addDoc(collection(db, 'responses'), payload);
    surveyState = 'sent';
    surveyForm.reset();
    questionsContainer.querySelectorAll('.char-counter span:first-child').forEach((el) => {
      el.textContent = '0';
    });
    setFormDisabled(true);
    setStatusPill('Enviado ✅', 'sent');
    successMsg.textContent = 'Gracias por participar';
    pinInput.value = '';
    pinInput.focus();
    document.getElementById('pin-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('Error al guardar', error);
    surveyState = 'ready';
    setFormDisabled(false);
    setStatusPill('Listo para responder', 'ready');
    successMsg.textContent = '';
    errorMsg.textContent = 'No pudimos guardar la respuesta. Intenta de nuevo.';
  } finally {
    if (surveyState !== 'sent') {
      submitBtn.disabled = false;
      resetBtn.disabled = false;
    }
  }
};

pinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  validatePin();
});

pinInput.addEventListener('input', () => {
  if (pinError.textContent) pinError.textContent = '';

  if (surveyState === 'ready' || surveyState === 'sending') return;

  if (isValidPin(pinInput.value)) {
    unlockSurvey();
    getControls()[0]?.focus();
  }
});

resetBtn.addEventListener('click', resetForm);
surveyForm.addEventListener('submit', handleSubmit);

const bootstrap = async () => {
  try {
    setStatusPill('Cargando...', 'sending');
    setFormDisabled(true);
    await Promise.all([loadAccessPin(), loadQuestions()]);
    renderQuestions();
    lockSurvey();
  } catch (error) {
    console.error('No se pudieron cargar las preguntas', error);
    pinError.textContent = 'No se pudieron cargar las preguntas. Intenta recargar la página.';
  }
};

bootstrap();
