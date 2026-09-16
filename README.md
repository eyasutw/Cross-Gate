# Cross-Gate 工具站（寵物算檔模擬 + 飾品資料庫）

把「寵物算檔模擬」跟「飾品資料庫」整合成同一個網站，左側選單切換顯示。

## 架構說明

用最單純、最不會出錯的方式整合：**左側選單 + iframe**。
`index.html` 是入口頁面，只負責顯示左側選單，右邊用 iframe 載入你要看的頁面
（`pets.html` 或 `items.html`）。這兩個頁面本身完全獨立、互不影響——
不會因為兩邊的樣式或程式碼剛好重複命名而互相打架。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | **入口頁面**，左側選單 + iframe 容器 |
| `pets.html` | 寵物算檔模擬（原本的 `index.html`，改了檔名） |
| `items.html` | 飾品資料庫（你上傳的檔案，原封不動） |
| `calc.js` `app.js` `pet_data.js` `pet_data.json` | 寵物算檔模擬需要的檔案，`pets.html` 會用到 |
| `supabase-config.js` | Supabase 連線設定（選填） |
| `cloudflare-worker-proxy.js` | Cloudflare Worker 代理程式碼（選填，只需貼到 Cloudflare 後台，不用上傳 GitHub） |

## 怎麼發布到 GitHub Pages

1. 把上面表格裡除了 `cloudflare-worker-proxy.js` 之外的**所有檔案**上傳到同一個 repo 的根目錄
   （檔案彼此的相對位置要維持在同一層，不要分別放到不同資料夾）
2. 進 repo 的 **Settings → Pages**，Source 選 `Deploy from a branch`，Branch 選 `main` / `/ (root)`
3. 等 1-2 分鐘，打開 `https://你的帳號.github.io/repo名稱/` 就會看到左側選單的入口頁面

## 之後如果想再加更多功能頁面

1. 把新的頁面（例如 `xxx.html`）也上傳到同一個資料夾
2. 打開 `index.html`，在 `<div class="sidebar">` 裡面照樣式加一行：
   ```html
   <div class="menu-item" data-page="xxx.html">你的選單名稱</div>
   ```
3. 存檔上傳即可，不用改任何其他程式碼

## 飾品資料庫（items.html）的其他功能

這個檔案是你提供的內容，我沒有另外修改內部邏輯，如果之後想幫這個部分加功能
（例如加搜尋、加自動更新資料），跟原本寵物算檔模擬工具一樣直接說需求即可。
