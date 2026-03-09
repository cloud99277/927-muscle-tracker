/**
 * app.js — V2 主程序
 */

const App = {
    _currentPage: 'login',
    _trainingType: null,
    _importData: null,

    async init() {
        // 1. Firebase 初始化
        const fbReady = initFirebase();

        // 2. Auth 初始化
        Auth.init();

        // 3. 波纹效果
        Animations.initRipple();

        // 4. 路由
        window.addEventListener('hashchange', () => this._onRoute());

        // 5. 认证回调
        Auth.onAuthChange(async user => {
            if (user) {
                await Store.init();
                Store.onDataChange(() => this._render());
                const hash = window.location.hash.slice(2) || 'dashboard';
                this.navigate(hash);
            }
        });

        // 如果 Firebase 未配置，直接检查是否有本地数据决定显示
        if (!fbReady) {
            this._render();
        }
    },

    // ---- 路由 ----
    navigate(page) { window.location.hash = `/${page}`; },

    _onRoute() {
        const hash = window.location.hash.slice(2) || 'dashboard';
        this._currentPage = hash;
        this._render();
        this._updateNav();
        window.scrollTo(0, 0);
    },

    _render() {
        const el = document.getElementById('app-content');
        const page = this._currentPage;

        switch (page) {
            case 'login': el.innerHTML = Components.renderLogin(); break;
            case 'dashboard': el.innerHTML = Components.renderDashboard(); break;
            case 'weight': el.innerHTML = Components.renderWeight(); break;
            case 'training':
                if (this._trainingType) {
                    el.innerHTML = Components.renderTrainingForm(this._trainingType);
                    this._trainingType = null;
                } else {
                    el.innerHTML = Components.renderTraining();
                }
                break;
            case 'more': el.innerHTML = Components.renderMore(); break;
            case 'review': el.innerHTML = Components.renderReview(); break;
            case 'diagnosis': el.innerHTML = Components.renderDiagnosis(); break;
            default: el.innerHTML = Components.renderDashboard();
        }

        el.className = 'page active';

        // 切到 dashboard 时触发动画
        if (page === 'dashboard') {
            setTimeout(() => Animations.animateRings(), 100);
        }

        // 控制底部导航显隐
        const nav = document.getElementById('bottom-nav');
        if (page === 'login') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
    },

    _updateNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            const target = item.dataset.page;
            const current = this._currentPage;
            item.classList.toggle('active',
                target === current ||
                (current === 'review' && target === 'more') ||
                (current === 'diagnosis' && target === 'more')
            );
        });
    },

    // ---- 认证 ----
    async login() {
        try {
            await Auth.signInWithGoogle();
        } catch (e) {
            this.toast('登录失败: ' + e.message, 'error');
        }
    },

    async skipLogin() {
        // 离线模式
        Auth._user = { uid: 'local-user', displayName: '离线用户', email: '' };
        Auth._triggerCallbacks();
    },

    async logout() {
        await Auth.signOut();
        this.navigate('login');
    },

    // ---- 体重 ----
    showWeightModal() {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-content').innerHTML = Components.renderWeightModal();
        modal.classList.add('show');
        setTimeout(() => { const i = document.getElementById('weight-value'); if (i) i.focus(); }, 300);
    },

    async saveWeight() {
        const date = document.getElementById('weight-date').value;
        const weight = parseFloat(document.getElementById('weight-value').value);
        if (!date || isNaN(weight) || weight <= 0) { this.toast('请输入有效体重', 'error'); return; }
        await Store.addWeight(date, weight);
        this.closeModal();
        this.toast(`✅ 已记录 ${weight}kg`, 'success');
        this._render();
    },

    // ---- 训练 ----
    startTraining(type) { this._trainingType = type; this.navigate('training'); },

    async saveTraining(type) {
        const date = document.getElementById('training-date').value;
        const notes = document.getElementById('training-notes').value;
        const templates = Store.getTemplates();
        const exercises = templates[type] || [];
        const record = { date, type, exercises: [], notes };
        let hasData = false;

        exercises.forEach((ex, ei) => {
            const sets = [];
            for (let si = 0; si < ex.defaultSets; si++) {
                const w = parseFloat(document.getElementById(`ex${ei}-s${si}-w`)?.value);
                const r = parseInt(document.getElementById(`ex${ei}-s${si}-r`)?.value);
                if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) { sets.push({ weight: w, reps: r }); hasData = true; }
            }
            record.exercises.push({ name: ex.name, sets });
        });

        if (!hasData) { this.toast('请至少填一组数据', 'error'); return; }
        await Store.addTraining(record);
        this.toast(`✅ 训练 ${type} 已保存！`, 'success');
        this.navigate('dashboard');
    },

    // ---- 饮食 ----
    showNutritionModal() {
        document.getElementById('modal-content').innerHTML = Components.renderNutritionModal();
        document.getElementById('modal-overlay').classList.add('show');
    },

    async saveNutrition() {
        const date = document.getElementById('nut-date').value;
        const cal = parseInt(document.getElementById('nut-cal').value);
        const pro = parseInt(document.getElementById('nut-pro').value);
        if (!date || isNaN(cal) || isNaN(pro)) { this.toast('请填写完整', 'error'); return; }
        await Store.addNutrition(date, cal, pro);
        this.closeModal();
        const ok = cal >= 2300 && pro >= 90;
        this.toast(ok ? '✅ 今日达标！' : '📝 已记录', ok ? 'success' : '');
        this._render();
    },

    // ---- 围度 ----
    showMeasurementModal() {
        document.getElementById('modal-content').innerHTML = Components.renderMeasurementModal();
        document.getElementById('modal-overlay').classList.add('show');
    },

    async saveMeasurement() {
        const date = document.getElementById('meas-date').value;
        const waist = parseFloat(document.getElementById('meas-waist').value);
        const chest = parseFloat(document.getElementById('meas-chest').value);
        const armL = parseFloat(document.getElementById('meas-armL').value);
        const armR = parseFloat(document.getElementById('meas-armR').value);
        if (!date) { this.toast('请选择日期', 'error'); return; }
        await Store.addMeasurement(date, waist || 0, chest || 0, armL || 0, armR || 0);
        this.closeModal();
        this.toast('✅ 围度已记录', 'success');
        this._render();
    },

    // ---- 周复盘 ----
    showReviewPage() { this.navigate('review'); },

    async submitReview() {
        const weekStart = Store.getWeekStartDate();
        const review = {
            weekOf: weekStart,
            trainingSessions: Store.getTrainingThisWeek().length,
            proteinDaysOnTarget: Store.getProteinDaysThisWeek(),
            weightChange: Store.getWeightChangeThisWeek(),
            notes: document.getElementById('review-notes')?.value || ''
        };
        await Store.addWeeklyReview(review);
        const streak = Store.getConsecutiveReviewWeeks();
        this.toast(`✅ 已提交！${streak > 1 ? `🔥 连续 ${streak} 周` : ''}`, 'success');
        this._render();
    },

    // ---- 导入/导出 ----
    showImportModal() {
        document.getElementById('modal-content').innerHTML = Components.renderImportModal();
        document.getElementById('modal-overlay').classList.add('show');
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                this._importData = e.target.result;
                const preview = document.getElementById('import-preview');
                const sum = document.getElementById('import-summary');
                preview.classList.remove('hidden');
                sum.innerHTML = `体重: ${(data.weightLog || []).length} 条<br>训练: ${(data.trainingLog || []).length} 条<br>饮食: ${(data.nutritionLog || []).length} 条`;
            } catch { this.toast('文件格式错误', 'error'); }
        };
        reader.readAsText(file);
    },

    async confirmImport() {
        if (!this._importData) return;
        const result = await Store.importData(this._importData);
        if (result.success) { this.closeModal(); this.toast('✅ 导入成功', 'success'); this._importData = null; this.navigate('dashboard'); }
        else { this.toast(`失败: ${result.error}`, 'error'); }
    },

    async migrateV1() {
        if (!confirm('从 V1 迁移数据到 V2？V1 数据不会被删除。')) return;
        const result = await Store.migrateFromV1();
        if (result.success) { this.toast('✅ 迁移成功！', 'success'); this._render(); }
        else { this.toast(`迁移失败: ${result.error}`, 'error'); }
    },

    async confirmClear() {
        if (confirm('⚠️ 确定清除所有数据？不可恢复！')) {
            await Store.clearAll();
            this.toast('已清除', '');
            this.navigate('dashboard');
        }
    },

    // ---- Modal / Toast ----
    closeModal() { document.getElementById('modal-overlay').classList.remove('show'); },

    toast(msg, type) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = `toast ${type || ''} show`;
        setTimeout(() => t.classList.remove('show'), 2500);
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
document.addEventListener('click', e => { if (e.target.id === 'modal-overlay') App.closeModal(); });
