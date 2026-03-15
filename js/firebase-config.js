/**
 * firebase-config.js — Firebase 初始化配置
 * 
 * ⚠️ 使用前需要：
 * 1. 去 https://console.firebase.google.com/ 创建项目
 * 2. 启用 Authentication → Google 登录
 * 3. 启用 Realtime Database
 * 4. 将下方 firebaseConfig 中的占位符替换为你的项目配置
 */

const firebaseConfig = (typeof FIREBASE_CONFIG !== 'undefined') ? FIREBASE_CONFIG : {
    apiKey: "REDACTED_API_KEY",
    authDomain: "REDACTED_AUTH_DOMAIN",
    databaseURL: "REDACTED_DATABASE_URL",
    projectId: "REDACTED_PROJECT_ID",
    storageBucket: "REDACTED_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "REDACTED_SENDER_ID",
    appId: "1:REDACTED_SENDER_ID:web:placeholder"
};

// 初始化 Firebase
let firebaseApp, firebaseAuth, firebaseDB;
let isFirebaseReady = false;

function initFirebase() {
    try {
        // 检查配置是否已填写
        if (firebaseConfig.apiKey.startsWith("REDACTED")) {
            console.warn('⚠️ Firebase 配置未填写，将使用离线模式（localStorage）');
            return false;
        }

        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDB = firebase.database();

        // 启用离线持久化
        firebaseDB.goOnline();

        isFirebaseReady = true;
        console.log('✅ Firebase 初始化成功');
        return true;
    } catch (e) {
        console.error('Firebase 初始化失败，使用离线模式', e);
        return false;
    }
}
