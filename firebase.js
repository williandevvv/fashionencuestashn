// Firebase CDN modules (sin bundler)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

// Configuración del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyCjWB8gBuXhkkiYqgJZD9WZnbP50qZsduo",
  authDomain: "fashionencuestashn.firebaseapp.com",
  projectId: "fashionencuestashn",
  storageBucket: "fashionencuestashn.firebasestorage.app",
  messagingSenderId: "945445364712",
  appId: "1:945445364712:web:87a8309dba7cd9d6ef3a5d"
};

// Inicializa Firebase y expone Firestore para el resto de la app
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
