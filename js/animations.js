/**
 * animations.js — SVG 三环进度 + count-up 动画 + 按钮波纹
 */

const Animations = {

    // ============================================================
    // SVG 三环进度环
    // ============================================================
    createProgressRings(weightPct, trainingPct, proteinPct, centerText) {
        const size = 200;
        const center = size / 2;

        const rings = [
            { pct: weightPct, r: 85, color: '#4f7df7', width: 10, label: '体重' },
            { pct: trainingPct, r: 68, color: '#10b981', width: 10, label: '训练' },
            { pct: proteinPct, r: 51, color: '#7c3aed', width: 10, label: '蛋白' }
        ];

        const ringsHTML = rings.map((ring, i) => {
            const circumference = 2 * Math.PI * ring.r;
            const offset = circumference * (1 - Math.min(1, ring.pct / 100));
            return `
        <circle cx="${center}" cy="${center}" r="${ring.r}" fill="none"
          stroke="rgba(255,255,255,0.05)" stroke-width="${ring.width}" />
        <circle cx="${center}" cy="${center}" r="${ring.r}" fill="none"
          stroke="${ring.color}" stroke-width="${ring.width}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          transform="rotate(-90 ${center} ${center})"
          class="ring-animated" data-target-offset="${offset}"
          style="transition: stroke-dashoffset 1s ease-out ${i * 0.15}s" />
      `;
        }).join('');

        return `
      <div class="progress-rings-container">
        <svg viewBox="0 0 ${size} ${size}" class="progress-rings-svg">
          ${ringsHTML}
          <text x="${center}" y="${center - 8}" text-anchor="middle" 
            class="ring-center-value" fill="white" font-size="28" font-weight="800">
            ${centerText}
          </text>
          <text x="${center}" y="${center + 16}" text-anchor="middle" 
            fill="#8888aa" font-size="11" font-weight="500">
            当前体重
          </text>
        </svg>
        <div class="ring-legends">
          ${rings.map(r => `
            <span class="ring-legend">
              <span class="ring-dot" style="background:${r.color}"></span>
              ${r.label} ${Math.round(r.pct)}%
            </span>
          `).join('')}
        </div>
      </div>
    `;
    },

    // 触发进度环动画
    animateRings() {
        requestAnimationFrame(() => {
            document.querySelectorAll('.ring-animated').forEach(circle => {
                const targetOffset = circle.dataset.targetOffset;
                circle.style.strokeDashoffset = targetOffset;
            });
        });
    },

    // ============================================================
    // 数字 count-up 动画
    // ============================================================
    countUp(element, targetValue, duration = 600, suffix = '') {
        const start = parseFloat(element.textContent) || 0;
        const startTime = performance.now();
        const decimals = String(targetValue).includes('.') ? 1 : 0;

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (targetValue - start) * eased;
            element.textContent = current.toFixed(decimals) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    },

    // ============================================================
    // 按钮波纹效果
    // ============================================================
    initRipple() {
        document.addEventListener('click', e => {
            const btn = e.target.closest('.btn');
            if (!btn) return;

            const ripple = document.createElement('span');
            ripple.className = 'ripple-effect';
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 2;
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);
        });
    },

    // ============================================================
    // 同步状态指示器
    // ============================================================
    renderSyncBadge(status) {
        const badges = {
            synced: '<span class="sync-badge synced">✅ 已同步</span>',
            syncing: '<span class="sync-badge syncing">⟳ 同步中</span>',
            offline: '<span class="sync-badge offline">📴 离线</span>'
        };
        return badges[status] || badges.offline;
    }
};
