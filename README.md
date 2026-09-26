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

## Supabase 設定步驟（讓大家看到同一份寵物資料，選填）

預設狀態下，「更新寵物資料」抓回來的最新資料只會存在你自己的瀏覽器裡（`localStorage`），
別人打開網站看到的還是內建的舊資料。如果想要「大家看到同一份資料」，需要自己申請一個
免費的 Supabase 專案當共用資料庫，設定一次就好：

1. 到 [supabase.com](https://supabase.com) 免費註冊，建立一個新專案（New Project）。
2. 進到專案後，左側選單找 **SQL Editor**，貼上下面的 SQL 並執行一次，
   會建立一張叫 `pets` 的資料表，並允許任何人讀取/寫入（因為這裡只是拿來放公開的寵物資料，
   不涉及個人帳號隱私，所以直接開放讀寫最簡單）：

   ```sql
   create table pets (
     id bigint generated always as identity primary key,
     official_id integer,
     name text unique not null,
     race text,
     hp numeric,
     atk numeric,
     def numeric,
     agi numeric,
     mp numeric,
     bprate numeric,
     skill_slot numeric,
     attr text,
     skills text,
     source text,
     updated_at timestamptz default now()
   );

   alter table pets enable row level security;

   create policy "public can read pets" on pets
     for select using (true);

   create policy "public can insert pets" on pets
     for insert with check (true);

   create policy "public can update pets" on pets
     for update using (true);
   ```

   （`name` 欄位有加 `unique`，是因為程式在上傳/更新時會用寵物名稱判斷是「新增」還是
   「覆蓋既有資料」，一定要有這個限制上傳才不會出錯。）

3. 左側選單找 **Settings → API**，會看到：
   - **Project URL**（例如 `https://xxxxxxxxxxxx.supabase.co`）
   - **anon public** 這組 API Key（一長串英數字）
4. 打開 `supabase-config.js`，把這兩個值填進去：

   ```js
   const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9......";
   ```

5. 存檔後重新上傳 `supabase-config.js` 到 GitHub repo（覆蓋原本空白的版本），
   等 GitHub Pages 更新完，重新整理網站。

設定完成後，畫面上「資料同步」那排按鈕才會真正動作：

- **上傳到共用資料庫**：把你目前畫面上的寵物資料（不管是用「更新寵物資料」抓回來的、
  還是自己匯入 JSON 檔案套用的）整批覆蓋到 Supabase，其他人打開網站就會看到這份資料。
- **重新讀取共用資料庫**：手動把雲端目前的資料拉回來，不用重新整理整個網頁。
- **匯出目前資料 (JSON)** / **匯入並套用**：不需要設定 Supabase 也能用，純粹是方便你在
  不同電腦之間搬資料，或是先把資料整理好、確認沒問題後，再用「上傳到共用資料庫」正式同步
  給大家（例如：管理者自己先手動核對、修正過某幾筆寵物資料，再一次上傳，而不是完全依賴
  容易失敗的自動抓取）。

沒有設定 Supabase 也完全不影響原本的功能，只是資料不會在不同人、不同瀏覽器之間同步。

### 飾品道具資料庫（items.html）也要用共用資料庫的話

`items.html` 跟 `pets.html` 是共用同一個 Supabase 專案、同一份 `supabase-config.js`，
所以如果你已經照上面的步驟設定好寵物資料的共用資料庫，**不用重新申請專案**，
只要多建一張表就好：

1. 一樣到 Supabase 後台的 **SQL Editor**，貼上下面的 SQL 執行一次：

   ```sql
   create table items (
     id bigint generated always as identity primary key,
     category text,
     name text,
     level text,
     durability text,
     hp text, mp text, atk text, def text, agi text,
     crit text, counter text, hit text, dodge text,
     regen text, spirit text, matk text, mres text,
     poison text, petrify text, confuse text, forget text,
     drunk text, curse text, charm text,
     earth text, water text, fire text, wind text,
     skill_reduction text,
     icon text,
     effect text,
     updated_at timestamptz default now()
   );

   alter table items enable row level security;

   create policy "public can read items" on items
     for select using (true);

   create policy "public can insert items" on items
     for insert with check (true);

   create policy "public can update items" on items
     for update using (true);

   create policy "public can delete items" on items
     for delete using (true);
   ```

   （這些數值欄位刻意設成 `text` 而不是 `numeric`，是因為道具數值常常是像「-100~100」這樣的
   浮動區間，不是單一數字，`numeric` 欄位存不了這種文字。畫面上排序、篩選的時候，
   程式會自動取區間的上限來比較，不用擔心存成文字會影響排序或「更多搜尋」的功能。）

   如果你**已經**照舊版說明建過 `items` 表（欄位是 `numeric`），要改用區間功能的話，
   先把整張表刪掉重建最簡單：
   ```sql
   drop table items;
   ```
   然後再執行上面新的建表 SQL。

   （道具沒有像寵物名稱那樣可以當唯一值的欄位——例如「大地鼠帽」在資料裡就出現兩次、數值還不一樣——
   所以這張表**沒有**加 `unique` 限制，「上傳到共用資料庫」的動作是整批覆蓋：
   會先把雲端這張表清空，再把畫面上目前的資料整批寫進去，而不是用寵物頁那種比對名稱的更新方式。）

2. 不用改 `supabase-config.js`，兩個頁面本來就讀同一份設定。

設定完成後，`items.html` 畫面上「資料同步」那排的「☁ 上傳到共用資料庫」「⟲ 重新讀取共用資料庫」
按鈕就會變成可以點的狀態，用法跟寵物頁一樣。

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
