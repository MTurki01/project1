import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, get, update, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA735gzATiqOdi3VXkC_A_J3hQJJSRRVxA",
  authDomain: "mystore-54aa2.firebaseapp.com",
  databaseURL: "https://mystore-54aa2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mystore-54aa2",
  storageBucket: "mystore-54aa2.firebasestorage.app",
  messagingSenderId: "739490293031",
  appId: "1:739490293031:web:dc734ae36a886ae4287502",
  measurementId: "G-5PPFGKZB61"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export instances and useful database methods
export { db, ref, set, push, onValue, get, update, remove };
