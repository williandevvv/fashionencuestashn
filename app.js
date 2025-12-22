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

const unlockSurvey = () => {
  surveyCard.classList.remove('locked');
  submitBtn.disabled = false;
  statusPill.textContent = 'Listo para responder';
  statusPill.style.background = 'rgba(76, 175, 125, 0.15)';
  statusPill.style.color = '#2f7d55';
  pinError.textContent = '';
};

const lockSurvey = () => {
  surveyCard.classList.add('locked');
  submitBtn.disabled = true;
  statusPill.textContent = 'Bloqueado';
  statusPill.style.background = 'rgba(176, 139, 115, 0.14)';
  statusPill.style.color = '#b08b73';
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
  if (submitBtn.disabled) {
    errorMsg.textContent = 'Debes ingresar el PIN para responder.';
    return;
  }

  const q1 = sanitizeNumber(q1Select.value);
  const q2 = sanitizeNumber(q2Select.value);
  const q3 = (q3Input.value || '').trim().slice(0, 250);

  if (!q1 || !q2) {
    errorMsg.textContent = 'Las preguntas 1 y 2 son obligatorias.';
    return;
  }

  submitBtn.disabled = true;
  errorMsg.textContent = '';
  successMsg.textContent = 'Guardando...';

  try {
    await addDoc(collection(db, 'responses'), {
      q1,
      q2,
      q3,
      createdAt: serverTimestamp(),
    });
    successMsg.textContent = '¡Gracias! Tu respuesta fue enviada de forma anónima.';
    surveyForm.reset();
    charCount.textContent = '0';
    lockSurvey();
  } catch (error) {
    console.error('Error al guardar', error);
    errorMsg.textContent = 'No pudimos guardar la respuesta. Intenta de nuevo.';
  } finally {
    submitBtn.disabled = true;
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
