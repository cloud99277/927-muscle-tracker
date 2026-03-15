# 🔐 Firebase 密钥泄露修复报告

**时间**: 2026-03-15  
**仓库**: [927-muscle-tracker](https://github.com/cloud99277/927-muscle-tracker)  
**严重性**: 🔴 高

---

## 问题描述

`tracker-app-v2/js/firebase-config.js` 文件中硬编码了 Firebase 配置密钥，并被直接推送到了公开的 GitHub 仓库。

**泄露的信息**:
| 字段 | 值 |
|------|-----|
| API Key | `AIzaSyDxvk...z5-U` |
| Auth Domain | `muscle-tracker-cloud927.firebaseapp.com` |
| Database URL | `...asia-southeast1.firebasedatabase.app` |
| Project ID | `muscle-tracker-cloud927` |
| Storage Bucket | `...firebasestorage.app` |
| Messaging Sender ID | `494655013393` |
| App ID | `1:494655013393:web:...` |

---

## ✅ 已执行的修复操作

### 1. 代码文件重构

| 文件 | 操作 |
|------|------|
| [firebase-config.js](file:///wsl.localhost/Ubuntu/home/yangyy/projects/fitness-muscle-building/tracker-app-v2/js/firebase-config.js) | 移除硬编码密钥，改为从 `FIREBASE_CONFIG` 变量加载 |
| [firebase-config.local.js](file:///wsl.localhost/Ubuntu/home/yangyy/projects/fitness-muscle-building/tracker-app-v2/js/firebase-config.local.js) | 新建，存放真实密钥（被 .gitignore 忽略） |
| [firebase-config.local.example.js](file:///wsl.localhost/Ubuntu/home/yangyy/projects/fitness-muscle-building/tracker-app-v2/js/firebase-config.local.example.js) | 新建，配置模板供他人参考 |
| [.gitignore](file:///wsl.localhost/Ubuntu/home/yangyy/projects/fitness-muscle-building/tracker-app-v2/.gitignore) | 新建，忽略 `firebase-config.local.js` 等敏感文件 |
| [index.html](file:///wsl.localhost/Ubuntu/home/yangyy/projects/fitness-muscle-building/tracker-app-v2/index.html) | 添加 `firebase-config.local.js` 的 script 标签 |

### 2. Git 历史清洗
- 使用 `git-filter-repo --replace-text` **彻底替换了所有 3 个历史提交中的密钥**
- 所有密钥已被替换为 `REDACTED_*` 占位符

### 3. GitHub 同步
- 使用 `git push --force` 覆盖了 GitHub 上的旧历史记录
- 验证确认：**所有历史提交中无密钥泄露**

---

## ⚠️ 还需要你手动执行的操作

> [!CAUTION]
> 即使 Git 历史已清洗，GitHub 可能仍然缓存了旧的 commit 数据。密钥应视为已泄露。

### 1. 🔄 轮换 Firebase API Key（强烈建议）
1. 打开 [Google Cloud Console → API 和服务 → 凭据](https://console.cloud.google.com/apis/credentials)
2. 找到项目 `muscle-tracker-cloud927`
3. **重新生成 API Key**（旧的自动失效）
4. 更新你本地的 `js/firebase-config.local.js`

### 2. 🔒 加强 Firebase 安全规则
1. 打开 [Firebase Console](https://console.firebase.google.com/) → 你的项目
2. **Database → 规则**: 确保不是 `".read": true, ".write": true`
3. **Authentication → 设置**: 添加授权域名白名单
4. **API Key 限制**: 在 Google Cloud Console 中限制 API Key 只能从你的域名调用

### 3. 🧹 请求 GitHub 清除缓存（可选但推荐）
联系 [GitHub Support](https://support.github.com/contact) 请求清除以下旧 commit 的缓存：
- `3b3a533`
- `ec9366f`  
- `deac70c`

---

## 新的文件架构

```
tracker-app-v2/
├── .gitignore                          # 忽略敏感文件
├── index.html                          # 加载顺序: local.js → config.js
├── js/
│   ├── firebase-config.local.js        # 🔒 真实密钥 (gitignored)
│   ├── firebase-config.local.example.js # 📝 配置模板 (tracked)
│   ├── firebase-config.js              # 初始化逻辑 (tracked, 无密钥)
│   └── ...
```

> [!TIP]
> 以后部署到 GitHub Pages 时，`firebase-config.local.js` 不会在仓库中，需要通过 CI/CD 的环境变量注入或手动部署。
