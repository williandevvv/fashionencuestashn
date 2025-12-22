import { db } from './firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const PIN = 'FCHN2025@';
const pinInput = document.getElementById('pinInput');
const pinButton = document.getElementById('pinButton');
const pinError = document.getElementById('pinError');
const statusPill = document.getElementById('status-pill');
const surveyCard = document.getElementById('survey-card');
const surveyForm = document.getElementById('surveyForm');
const q1Select = document.getElementById('q1');
const q2Select = document.getElementById('q2');
const q3Input = document.getElementById('q3');
const submitBtn = document.getElementById('submitBtn');
const resetBtn = document.getElementById('resetBtn');
const successMsg = document.getElementById('successMsg');
const errorMsg = document.getElementById('errorMsg');
const charCount = document.getElementById('charCount');

let surveyState = 'locked';

const setStatusPill = (text, variant) => {
  statusPill.textContent = text;
  statusPill.className = `pill ${variant}`;
};

const setFormDisabled = (disabled) => {
  [q1Select, q2Select, q3Input, submitBtn, resetBtn].forEach((el) => {
    if (el) el.disabled = disabled;
  });
  surveyCard.classList.toggle('locked', disabled);
};

const ensurePinReady = () => {
  pinInput.disabled = false;
  pinButton.disabled = false;
};

const unlockSurvey = () => {
  surveyState = 'ready';
  setFormDisabled(false);
  setStatusPill('Listo para responder', 'ready');
  pinError.textContent = '';
  successMsg.textContent = '';
  errorMsg.textContent = '';
  ensurePinReady();
};

const lockSurvey = () => {
  surveyState = 'locked';
  setFormDisabled(true);
  setStatusPill('Bloqueado', 'locked');
  ensurePinReady();
};

const buildNumberOptions = () => {
  const options = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((value) => `<option value="${value}">${value}</option>`)
    .join('');
  q1Select.insertAdjacentHTML('beforeend', options);
  q2Select.insertAdjacentHTML('beforeend', options);
};

const validatePin = () => {
  const value = pinInput.value.trim();
  if (value !== PIN) {
    pinError.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
    lockSurvey();
    return;
  }
  unlockSurvey();
};

const resetForm = () => {
  surveyForm.reset();
  charCount.textContent = '0';
  successMsg.textContent = '';
  errorMsg.textContent = '';
  pinError.textContent = '';
  lockSurvey();
  pinInput.value = '';
  pinInput.focus();
};

const sanitizeNumber = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 10 ? num : null;
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

  const q1 = sanitizeNumber(q1Select.value);
  const q2 = sanitizeNumber(q2Select.value);
  const q3 = (q3Input.value || '').trim().slice(0, 250);

  if (!q1 || !q2) {
    errorMsg.textContent = 'Las preguntas 1 y 2 son obligatorias.';
    return;
  }

  surveyState = 'sending';
  setFormDisabled(true);
  ensurePinReady();
  errorMsg.textContent = '';
  successMsg.textContent = 'Enviando...';
  setStatusPill('Enviando...', 'sending');

  try {
    await addDoc(collection(db, 'responses'), {
      q1,
      q2,
      q3,
      createdAt: serverTimestamp(),
    });
    surveyForm.reset();
    charCount.textContent = '0';
    surveyState = 'locked';
    setFormDisabled(true);
    setStatusPill('Enviado ✅', 'sent');
    successMsg.textContent = 'Gracias por participar';
    pinInput.value = '';
    ensurePinReady();
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

pinButton.addEventListener('click', validatePin);
pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    validatePin();
  }
});

q3Input.addEventListener('input', () => {
  charCount.textContent = q3Input.value.length.toString();
});

resetBtn.addEventListener('click', resetForm);
surveyForm.addEventListener('submit', handleSubmit);

buildNumberOptions();
lockSurvey();
