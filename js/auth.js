/**
 * auth.js — Firebase 认证 + 降级到离线模式
 */

const Auth = {
    _user: null,
    _onAuthChangeCallbacks: [],

    init() {
        if (!isFirebaseReady) {
            // 离线模式：模拟一个匿名用户
            this._user = { uid: 'local-user', displayName: '离线用户', email: '' };
            this._triggerCallbacks();
            return;
        }

        firebaseAuth.onAuthStateChanged(user => {
            this._user = user;
            this._triggerCallbacks();
        });
    },

    onAuthChange(callback) {
        this._onAuthChangeCallbacks.push(callback);
    },

    _triggerCallbacks() {
        this._onAuthChangeCallbacks.forEach(cb => cb(this._user));
    },

    getUser() {
        return this._user;
    },

    getUid() {
        return this._user ? this._user.uid : null;
    },

    isLoggedIn() {
        return !!this._user;
    },

    isOnlineMode() {
        return isFirebaseReady && this._user && this._user.uid !== 'local-user';
    },

    async signInWithGoogle() {
        if (!isFirebaseReady) {
            console.warn('Firebase 未初始化，无法登录');
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebaseAuth.signInWithPopup(provider);
        } catch (e) {
            console.error('Google 登录失败', e);
            throw e;
        }
    },

    async signOut() {
        if (!isFirebaseReady) return;
        try {
            await firebaseAuth.signOut();
        } catch (e) {
            console.error('登出失败', e);
        }
    }
};
