// Firebase Configuration for UTS Platform
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Configuración vinculada al archivo .env
  apiKey: "AIzaSyCF_hTu8Jdl5FTJ_4KfVCGgezwWb5j6f5Q",
  authDomain: "studio-1948386112-e1436.firebaseapp.com",
  projectId: "studio-1948386112-e1436",
  storageBucket: "studio-1948386112-e1436.firebasestorage.app",
  messagingSenderId: "316511192927",
  appId: "1:316511192927:web:77f6024a4aa8e3d81798ea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
