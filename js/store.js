/**
 * store.js — V2 数据层
 * 
 * 双模式：Firebase 实时同步 / localStorage 离线降级
 * API 接口与 V1 兼容
 */

const STORAGE_KEY = 'muscle-tracker-v2-data';

const DEFAULT_TEMPLATES = {
    // V3 居家版：推（胸+肩+三头）
    A: [
        { name: '哑铃地板卧推', defaultSets: 4, defaultReps: '8-12', muscle: '胸三头' },
        { name: '俯卧撑', defaultSets: 3, defaultReps: '力竭', muscle: '胸三头核心' },
        { name: '哑铃站姿肩推', defaultSets: 3, defaultReps: '10-12', muscle: '肩' },
        { name: '哑铃侧平举', defaultSets: 3, defaultReps: '12-15', muscle: '三角肌中束' },
        { name: '哑铃颈后臂屈伸', defaultSets: 3, defaultReps: '10-15', muscle: '三头' },
        { name: '钻石俯卧撑', defaultSets: 2, defaultReps: '力竭', muscle: '三头内胸' }
    ],
    // V3 居家版：拉（背+二头）
    B: [
        { name: '哑铃俯身划船', defaultSets: 4, defaultReps: '8-12', muscle: '背阔中背' },
        { name: '哑铃单臂划船', defaultSets: 3, defaultReps: '10-12/侧', muscle: '背阔' },
        { name: '哑铃罗马尼亚硬拉', defaultSets: 3, defaultReps: '8-10', muscle: '腘绳臀下背' },
        { name: '超人式', defaultSets: 3, defaultReps: '12-15', muscle: '竖脊下背' },
        { name: '哑铃弯举', defaultSets: 3, defaultReps: '10-15', muscle: '二头' },
        { name: '哑铃锤式弯举', defaultSets: 3, defaultReps: '10-12', muscle: '肱桡二头' }
    ],
    // V3 居家版：腿+核心
    C: [
        { name: '哑铃高脚杯深蹲', defaultSets: 4, defaultReps: '10-15', muscle: '股四臀' },
        { name: '哑铃箭步蹲', defaultSets: 3, defaultReps: '10/腿', muscle: '股四臀' },
        { name: '哑铃罗马尼亚硬拉', defaultSets: 3, defaultReps: '10-12', muscle: '腘绳臀' },
        { name: '保加利亚分腿蹲', defaultSets: 3, defaultReps: '8-10/腿', muscle: '股四臀' },
        { name: '哑铃提踵', defaultSets: 3, defaultReps: '15-20', muscle: '小腿' },
        { name: '平板支撑', defaultSets: 3, defaultReps: '30-60秒', muscle: '核心' },
        { name: '卷腹', defaultSets: 3, defaultReps: '15-20', muscle: '腹直肌' }
    ]
};

const DEFAULT_PROFILE = {
    height: 165, startWeight: 50, targetWeight: 62,
    startDate: new Date().toISOString().split('T')[0], age: 28
};

const Store = {
    _data: null,
    _listeners: [],
    _syncStatus: 'offline', // 'synced' | 'syncing' | 'offline'
    _dbRef: null,

    // ============================================================
    // 初始化
    // ============================================================
    async init() {
        // 先从 localStorage 加载作为缓存
        this._loadLocal();

        if (Auth.isOnlineMode()) {
            await this._initFirebase();
        } else {
            this._syncStatus = 'offline';
        }

        // 监听认证变化
        Auth.onAuthChange(async user => {
            if (user && Auth.isOnlineMode()) {
                await this._initFirebase();
            } else {
                this._syncStatus = 'offline';
                this._notifyListeners();
            }
        });
    },

    async _initFirebase() {
        const uid = Auth.getUid();
        if (!uid || !isFirebaseReady) return;

        this._syncStatus = 'syncing';
        this._notifyListeners();

        this._dbRef = firebaseDB.ref(`users/${uid}`);

        // 检查远程是否有数据
        const snapshot = await this._dbRef.once('value');
        if (!snapshot.exists()) {
            // 首次使用：上传本地数据
            await this._dbRef.set(this._data);
        }

        // 实时监听
        this._dbRef.on('value', snap => {
            if (snap.exists()) {
                this._data = snap.val();
                this._ensureArrays();
                this._saveLocal();
                this._syncStatus = 'synced';
                this._notifyListeners();
            }
        });

        this._syncStatus = 'synced';
        this._notifyListeners();
    },

    _loadLocal() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                this._data = JSON.parse(raw);
            } catch (e) {
                this._data = this._getDefault();
            }
        } else {
            this._data = this._getDefault();
        }
        this._ensureArrays();
    },

    _saveLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    },

    _getDefault() {
        return {
            profile: { ...DEFAULT_PROFILE },
            weightLog: [],
            measurementLog: [],
            trainingLog: [],
            nutritionLog: [],
            weeklyReview: [],
            trainingTemplates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))
        };
    },

    _ensureArrays() {
        // Firebase 存储时空数组可能丢失，确保所有数组存在
        const arrays = ['weightLog', 'measurementLog', 'trainingLog', 'nutritionLog', 'weeklyReview'];
        arrays.forEach(key => {
            if (!this._data[key]) this._data[key] = [];
            // Firebase 返回 object 而非 array，需要转换
            if (!Array.isArray(this._data[key])) {
                this._data[key] = Object.values(this._data[key]);
            }
        });
        if (!this._data.profile) this._data.profile = { ...DEFAULT_PROFILE };
        if (!this._data.trainingTemplates) {
            this._data.trainingTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
        }
    },

    // ============================================================
    // Firebase 写入（自动降级）
    // ============================================================
    async _write(path, value) {
        // 更新本地
        this._setNestedValue(path, value);
        this._saveLocal();

        // 同步到 Firebase
        if (this._dbRef && Auth.isOnlineMode()) {
            try {
                this._syncStatus = 'syncing';
                this._notifyListeners();
                await this._dbRef.child(path).set(value);
                this._syncStatus = 'synced';
            } catch (e) {
                console.error('Firebase 写入失败', e);
                this._syncStatus = 'offline';
            }
            this._notifyListeners();
        }
    },

    async _push(path, value) {
        // 本地
        if (!this._data[path]) this._data[path] = [];
        if (!Array.isArray(this._data[path])) {
            this._data[path] = Object.values(this._data[path]);
        }
        this._data[path].push(value);
        this._saveLocal();

        // Firebase
        if (this._dbRef && Auth.isOnlineMode()) {
            try {
                this._syncStatus = 'syncing';
                this._notifyListeners();
                await this._dbRef.child(path).push(value);
                this._syncStatus = 'synced';
            } catch (e) {
                console.error('Firebase push 失败', e);
                this._syncStatus = 'offline';
            }
            this._notifyListeners();
        }
    },

    _setNestedValue(path, value) {
        const parts = path.split('/');
        let obj = this._data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    },

    // ============================================================
    // 数据监听
    // ============================================================
    onDataChange(callback) {
        this._listeners.push(callback);
    },

    _notifyListeners() {
        this._listeners.forEach(cb => cb(this._data, this._syncStatus));
    },

    getSyncStatus() {
        return this._syncStatus;
    },

    // ============================================================
    // Profile
    // ============================================================
    getProfile() { return this._data.profile; },

    async updateProfile(updates) {
        Object.assign(this._data.profile, updates);
        await this._write('profile', this._data.profile);
    },

    // ============================================================
    // 体重
    // ============================================================
    getWeightLog() {
        return [...this._data.weightLog].sort((a, b) => a.date.localeCompare(b.date));
    },

    async addWeight(date, weight) {
        const log = this._data.weightLog;
        const idx = log.findIndex(w => w.date === date);
        if (idx >= 0) {
            log[idx].weight = weight;
            await this._write('weightLog', log);
        } else {
            await this._push('weightLog', { date, weight });
        }
    },

    getLatestWeight() {
        const log = this.getWeightLog();
        return log.length > 0 ? log[log.length - 1].weight : this._data.profile.startWeight;
    },

    // ============================================================
    // 围度
    // ============================================================
    getMeasurementLog() {
        return [...this._data.measurementLog].sort((a, b) => a.date.localeCompare(b.date));
    },

    async addMeasurement(date, waist, chest, armLeft, armRight) {
        await this._push('measurementLog', { date, waist, chest, armLeft, armRight });
    },

    // ============================================================
    // 训练
    // ============================================================
    getTrainingLog() {
        return [...this._data.trainingLog].sort((a, b) => a.date.localeCompare(b.date));
    },

    async addTraining(record) {
        await this._push('trainingLog', record);
    },

    getTrainingThisWeek() {
        const mondayStr = this._getMondayStr();
        return this._data.trainingLog.filter(t => t.date >= mondayStr);
    },

    getLastTrainingForExercise(exerciseName) {
        const logs = this.getTrainingLog();
        for (let i = logs.length - 1; i >= 0; i--) {
            const ex = logs[i].exercises.find(e => e.name === exerciseName);
            if (ex && ex.sets && ex.sets.length > 0) return ex.sets;
        }
        return null;
    },

    // ============================================================
    // 饮食
    // ============================================================
    getNutritionLog() {
        return [...this._data.nutritionLog].sort((a, b) => a.date.localeCompare(b.date));
    },

    async addNutrition(date, calories, protein) {
        const onTarget = calories >= 2300 && protein >= 90;
        const log = this._data.nutritionLog;
        const idx = log.findIndex(n => n.date === date);
        if (idx >= 0) {
            Object.assign(log[idx], { calories, protein, onTarget });
            await this._write('nutritionLog', log);
        } else {
            await this._push('nutritionLog', { date, calories, protein, onTarget });
        }
    },

    getProteinDaysThisWeek() {
        const mondayStr = this._getMondayStr();
        return this._data.nutritionLog.filter(n => n.date >= mondayStr && n.onTarget).length;
    },

    // ============================================================
    // 周复盘
    // ============================================================
    getWeeklyReviews() {
        return [...this._data.weeklyReview].sort((a, b) => a.weekOf.localeCompare(b.weekOf));
    },

    async addWeeklyReview(review) {
        const log = this._data.weeklyReview;
        const idx = log.findIndex(r => r.weekOf === review.weekOf);
        if (idx >= 0) {
            log[idx] = review;
            await this._write('weeklyReview', log);
        } else {
            await this._push('weeklyReview', review);
        }
    },

    hasReviewThisWeek() {
        const mondayStr = this._getMondayStr();
        return this._data.weeklyReview.some(r => r.weekOf === mondayStr);
    },

    getConsecutiveReviewWeeks() {
        const reviews = this.getWeeklyReviews();
        if (reviews.length === 0) return 0;
        let count = 0;
        let checkDate = new Date(this._getMondayStr());
        for (let i = 0; i < 52; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (reviews.some(r => r.weekOf === dateStr)) {
                count++;
                checkDate.setDate(checkDate.getDate() - 7);
            } else break;
        }
        return count;
    },

    // ============================================================
    // 模板
    // ============================================================
    getTemplates() { return this._data.trainingTemplates; },

    async resetTemplates() {
        this._data.trainingTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
        await this._write('trainingTemplates', this._data.trainingTemplates);
    },

    // ============================================================
    // 导出/导入/迁移
    // ============================================================
    exportData() {
        const blob = new Blob([JSON.stringify(this._data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `muscle-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async importData(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            const requiredKeys = ['profile', 'weightLog', 'trainingLog', 'nutritionLog', 'weeklyReview'];
            for (const key of requiredKeys) {
                if (!(key in imported)) throw new Error(`缺少字段: ${key}`);
            }
            this._data = imported;
            this._ensureArrays();
            this._saveLocal();
            if (this._dbRef && Auth.isOnlineMode()) {
                await this._dbRef.set(this._data);
            }
            return { success: true, summary: this.getDataSummary() };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    // V1 数据迁移
    async migrateFromV1() {
        const v1Raw = localStorage.getItem('muscle-tracker-data');
        if (!v1Raw) return { success: false, error: '未找到 V1 数据' };
        try {
            const v1Data = JSON.parse(v1Raw);
            // 合并 V1 数据到当前数据
            if (v1Data.weightLog) this._data.weightLog = [...this._data.weightLog, ...v1Data.weightLog];
            if (v1Data.trainingLog) this._data.trainingLog = [...this._data.trainingLog, ...v1Data.trainingLog];
            if (v1Data.nutritionLog) this._data.nutritionLog = [...this._data.nutritionLog, ...v1Data.nutritionLog];
            if (v1Data.weeklyReview) this._data.weeklyReview = [...this._data.weeklyReview, ...v1Data.weeklyReview];
            if (v1Data.profile) Object.assign(this._data.profile, v1Data.profile);

            // 去重（按 date 字段）
            ['weightLog', 'nutritionLog'].forEach(key => {
                const seen = new Set();
                this._data[key] = this._data[key].filter(item => {
                    if (seen.has(item.date)) return false;
                    seen.add(item.date);
                    return true;
                });
            });

            this._saveLocal();
            if (this._dbRef && Auth.isOnlineMode()) {
                await this._dbRef.set(this._data);
            }
            return { success: true, summary: this.getDataSummary() };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    hasV1Data() {
        return !!localStorage.getItem('muscle-tracker-data');
    },

    getDataSummary() {
        return {
            weightRecords: this._data.weightLog.length,
            measurementRecords: this._data.measurementLog.length,
            trainingRecords: this._data.trainingLog.length,
            nutritionRecords: this._data.nutritionLog.length,
            reviewRecords: this._data.weeklyReview.length
        };
    },

    async clearAll() {
        this._data = this._getDefault();
        this._saveLocal();
        if (this._dbRef && Auth.isOnlineMode()) {
            await this._dbRef.set(this._data);
        }
    },

    // ============================================================
    // 工具方法
    // ============================================================
    _getMondayStr() {
        const today = new Date();
        const day = today.getDay() || 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - day + 1);
        return monday.toISOString().split('T')[0];
    },

    getWeekStartDate() { return this._getMondayStr(); },

    getWeightChangeThisWeek() {
        const log = this.getWeightLog();
        const mondayStr = this._getMondayStr();
        const thisWeek = log.filter(w => w.date >= mondayStr);
        if (thisWeek.length === 0) return null;
        const before = log.filter(w => w.date < mondayStr);
        if (before.length === 0) return null;
        return +(thisWeek[0].weight - before[before.length - 1].weight).toFixed(1);
    }
};
