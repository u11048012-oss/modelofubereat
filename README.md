# Convenience Store Simulator (便利商店模擬器)

這是一個模擬便利商店外送接單與撿貨的一頁式網頁應用程式 (SPA)。
使用 React + Vite + Tailwind CSS 構建。

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```

### 3. 建置生產版本
```bash
npm run build
```

## 📦 部署到 GitHub Pages

本專案已設定好 GitHub Actions 自動部署流程。

### 1. 準備工作
- 將程式碼 Push 到 GitHub Repository。
- 到 Repository Settings > **Pages**，將 "Build and deployment" Source 設定為 **GitHub Actions**。

### 2. 設定環境變數 (Environment Variables)
請參考 `.env.example` 檔案查看所有需要的環境變數。

到 Repository Settings > **Secrets and variables** > **Actions** > **Variables** (或 Secrets) 中新增：

| 變數名稱 | 說明 | 範例值 |
|----------|------|--------|
| `VITE_APP_TITLE` | 應用程式標題 | Convenience Store Simulator |
| `VITE_API_URL` | API 網址 (如果有的話) | https://api.example.com |

### 3. 自動部署
- 每次 Push 到 `main` 分支時，GitHub Actions 會自動觸發建置並部署。
- 你可以在 Actions 分頁查看部署進度。

## 🛠️ 技術棧
- React 18
- Vite
- Tailwind CSS
- Lucide React (Icons)
