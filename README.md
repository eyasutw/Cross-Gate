# 初心寵物算檔模擬（網頁版）

《魔力寶貝》寵物檔次計算工具，純前端網頁版，不需要安裝 Python、不需要伺服器，
用瀏覽器打開就能用，也可以直接發布到 GitHub Pages 讓別人用網址連結使用。

## 這是什麼

跟你原本的 Python 桌面版功能完全對應：搜尋寵物、算檔（含一等能力輔助、剩餘點數、
升級點法、爆點規則）、四大結果區塊、模擬成長（可拖曳浮動視窗、+/- 手動配點）、
更新寵物資料。核心計算邏輯（`calc.js`）是從已經驗證過的 Python `calc.py`
逐行忠實移植，用相同的真實案例交叉測試過，數字完全一致。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `index.html` | 主頁面（結構＋樣式） |
| `calc.js` | 核心算檔引擎 |
| `pet_data.js` | 內建寵物資料庫（開頁就有，不用另外載入檔案） |
| `pet_data.json` | 同一份資料的 JSON 格式，給「切換檔案」功能用，也方便你自己編輯資料 |
| `app.js` | 介面邏輯（搜尋、算檔、模擬成長、更新資料） |
| `supabase-config.js` | Supabase 連線設定（選填，見下方「Supabase 設定步驟」） |
| `cloudflare-worker-proxy.js` | Cloudflare Worker 代理程式碼（選填，見下方「自建 Cloudflare Worker 代理」，要部署到 Cloudflare 上，不用上傳到 GitHub Pages 也可以） |

## 怎麼發布到 GitHub Pages

1. 在 GitHub 上開一個新的 repository（例如叫 `mowuz-web`）
2. 把這 6 個檔案全部上傳到 repo 的根目錄（或建一個資料夾，例如 `docs/`，都可以）
3. 進 repo 的 **Settings → Pages**
4. **Source** 選 `Deploy from a branch`，**Branch** 選 `main`（資料夾選你放檔案的那個，
   根目錄就選 `/ (root)`，如果放在 `docs/` 就選 `docs`）
5. 存檔後等 1～2 分鐘，畫面會顯示網址，通常長這樣：
   `https://你的帳號.github.io/mowuz-web/`
6. 打開這個網址就是能用的網頁版，之後把這個網址分享給別人即可

## 自建 Cloudflare Worker 代理（取代免費公開代理，更穩定）

免費公開的 CORS 代理（corsproxy.io 這類）常常會失效、被限流、或哪天開始要求申請帳號。
自己架一個 Cloudflare Worker 當代理，完全自己掌控、免費額度很高（每天 10 萬次請求），
不會再被別人的服務狀況影響。

### 1. 建立 Cloudflare 帳號並建立 Worker

1. 到 https://dash.cloudflare.com 註冊帳號（免費）
2. 左側選單找到 **Workers 及 Pages**，點「建立應用程式」→「建立 Worker」
3. 幫 Worker 取個名字（例如 `mowuz-proxy`），建立完成

### 2. 貼上程式碼

1. 點「編輯程式碼」，會打開一個線上編輯器
2. 把整個 `cloudflare-worker-proxy.js` 的內容複製貼上去（覆蓋預設範例程式碼）
3. 點右上角「部署」

### 3. 取得 Worker 網址

部署完成後，會看到一個網址，長得像：

```
https://mowuz-proxy.你的帳號.workers.dev
```

### 4. 填進網頁版設定

打開 `app.js`，找到這一行（在檔案偏上方位置）：

```js
const OWN_WORKER_PROXY_URL = "";
```

把剛剛的 Worker 網址填進去（**結尾不要加斜線 `/`**）：

```js
const OWN_WORKER_PROXY_URL = "https://mowuz-proxy.你的帳號.workers.dev";
```

存檔後重新上傳 `app.js` 到 GitHub 覆蓋掉舊的。

### 之後的運作方式

- 「更新寵物資料」會**優先使用你自己的 Worker**，失敗才會依序退回使用那些免費公開代理當備援
- 這個 Worker 有做網域白名單限制，只能拿來抓取本專案需要的兩個網站，不會被別人拿去當任意用途的代理濫用
- Cloudflare Workers 免費額度是每天 10 萬次請求，一般使用完全用不完，不會有額外費用

## 「更新寵物資料」按鈕的重要限制（老實說）

網頁版沒辦法像 Python 版一樣直接用 `requests` 抓資料——瀏覽器的**跨域安全限制（CORS）**
會擋掉直接對其他網站發出的請求。我在程式碼裡用了 4 個公開的跨域代理服務接力嘗試
（corsproxy.io、allorigins.win、proxy.cors.sh、thingproxy.freeboard.io），
依序試過去，其中一個能用就會成功；4 個都失敗才會跳出錯誤訊息，不會讓程式當掉，
而且錯誤訊息會列出每一個代理各自失敗的原因，方便判斷問題。

這些代理服務都是**免費公開的第三方服務**，不是我們自己架的，會不定期改規則、
限流、甚至關站（例如 corsproxy.io 目前已經開始要求申請帳號/API key，
免費匿名呼叫可能會收到 401）。如果「更新寵物資料」持續 4 個都失敗，可以：

- 過一段時間再試一次（代理服務可能只是暫時不穩）
- 或者，繼續用 Python 桌面版來更新（它不受瀏覽器 CORS 限制），
  更新完後把產生的 `pet_data.json` 上傳覆蓋這個網頁版 repo 裡的同名檔案，
  網頁版一樣讀得到最新資料

這部分我這邊沒有網路，**沒辦法實際連線測試更新功能跑不跑得動**，麻煩你發布後實際點一次測試，
有問題把錯誤訊息回報給我。

## Supabase 設定步驟（共用寵物資料庫）

這個功能讓「更新寵物資料」變成大家共用一份：有人按更新，資料會同步寫進 Supabase，
其他人打開網頁時會優先讀 Supabase 上最新的內容。

**⚠️ 安全性提醒**：這裡採用最簡單的設定方式——任何人都可以直接寫入這個共用資料庫
（因為前端網頁本來就會把 anon key 整個曝露出來，這是靜態網站的先天限制）。
也就是說理論上任何懂技術的人都可能亂改資料庫內容。這個做法**適合小範圍、信任的使用者一起用**，
不建議放到人多、公開的場合。如果要更嚴謹的權限控管，需要另外寫 Supabase Edge Function
搭配密碼驗證，這裡先不做。

### 1. 建立 Supabase 專案

1. 到 https://supabase.com 註冊帳號（免費方案就夠用）
2. 建立一個新專案（New Project），設定好專案名稱、資料庫密碼、選一個離你近的地區
3. 等專案建立完成（約 1-2 分鐘）

### 2. 建立資料表

進專案的 **SQL Editor**，貼上以下指令並執行：

```sql
create table pets (
  id bigserial primary key,
  official_id integer,
  name text not null unique,
  race text,
  hp numeric,
  atk numeric,
  def numeric,
  agi numeric,
  mp numeric,
  bprate numeric default 0.2,
  skill_slot numeric,
  attr text,
  skills text,
  source text,
  updated_at timestamptz default now()
);

alter table pets enable row level security;

create policy "anyone can read" on pets for select using (true);
create policy "anyone can insert" on pets for insert with check (true);
create policy "anyone can update" on pets for update using (true);
```

### 3. 取得連線資訊

進專案的 **Settings → API**，複製兩個值：
- **Project URL**（長得像 `https://xxxxxxxxxxxx.supabase.co`）
- **anon public** key（一長串英數字）

### 4. 填進網頁版設定檔

打開 `supabase-config.js`，把剛剛複製的兩個值貼進去：

```js
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9......";
```

存檔後重新發布到 GitHub Pages（或本機重新整理測試）。

### 5. 把內建的 1307 筆資料匯入 Supabase（只需要做一次）

網頁打開後，按 F12 打開瀏覽器的開發者工具，切到 **Console** 分頁，貼上這一行執行：

```js
pushPetsToSupabase(PET_DATA).then(r => console.log("匯入完成", r));
```

等主控台顯示「匯入完成」，Supabase 的 `pets` 資料表裡就會有這 1307 筆初始資料了。
之後只要有人按「更新寵物資料」，就會自動同步覆蓋/新增到這個共用資料表。

### 之後的運作方式

- 網頁打開時會**自動優先讀 Supabase** 上的資料；讀取失敗或還沒設定的話，會自動退回使用內建的 `pet_data.js`，不會壞掉
- 按「更新寵物資料」時，除了更新自己瀏覽器裡看到的清單，也會**同步寫回 Supabase**，其他人重新整理網頁後就看得到
- 如果想暫時不要共用、只用自己本機的資料，把 `supabase-config.js` 裡兩個值清空存檔即可


按這個按鈕可以選一個你自己的 `pet_data.json`（例如 Python 版更新後產生的那份）
載入到網頁版裡，不用重新發布網站就能換資料。這個切換只在你當下瀏覽器分頁裡有效，
重新整理網頁就會恢復成 `pet_data.js` 內建的那份。

## 已知跟桌面版的差異

- 沒有「打包成 exe」這件事，本身就是可以直接分享網址使用的形式
- 拖曳浮動視窗目前只支援滑鼠拖曳（沒有特別測試觸控裝置的手勢拖曳）
- 我這邊環境沒有瀏覽器可以實際打開網頁測試畫面渲染，只驗證了 JavaScript 邏輯本身
  （用 Node.js 跑過跟 Python 版一致的真實案例，數字完全吻合），
  麻煩你發布後實際打開測試一次，畫面或互動有問題的話回報給我
