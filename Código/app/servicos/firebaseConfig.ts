import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD1OZLTsL1huQLKX3QTQCp4HT3IkhTQBlQ",
    authDomain: "tcc2026-8b866.firebaseapp.com",
    projectId: "tcc2026-8b866",
    storageBucket: "tcc2026-8b866.firebasestorage.app",
    messagingSenderId: "763745306432",
    appId: "1:763745306432:web:825a7ba7bac5e01d185ca5"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);