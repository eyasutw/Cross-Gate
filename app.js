// app.js — 初心寵物算檔模擬 網頁版主邏輯

const AXIS_NAMES = ["體力", "力量", "防禦", "敏捷", "魔法"];
const TIER_LABELS = ["體力", "力量", "強度", "速度", "魔法"];
const COMBAT_LABELS = { attack: "攻擊", defend: "防禦", agi: "敏捷", wis: "精神", res: "回復" };

let pets = PET_DATA.slice();
let selectedPet = null;
let selectedIdx = null;
let lastResults = null;
let calcGrowthMode = "智";
let sortState = {};
let simWindows = [];
let windowOffset = 0;

// ── Supabase：大家共用的寵物資料庫（選填，見 supabase-config.js） ─────────
let supabaseClient = null;
if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== "undefined") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function petRowToSupabaseRecord(p) {
  return {
    official_id: p[0], name: p[1], race: p[2], hp: p[3], atk: p[4], def: p[5], agi: p[6], mp: p[7],
    bprate: p[8], skill_slot: p[9], attr: p[10], skills: p[11], source: p[12],
  };
}

function supabaseRecordToPetRow(r) {
  return [r.official_id, r.name, r.race, r.hp, r.atk, r.def, r.agi, r.mp, r.bprate, r.skill_slot, r.attr, r.skills, r.source];
}

async function loadPetsFromSupabase() {
  if (!supabaseClient) return null;
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseClient.from("pets").select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data.map(supabaseRecordToPetRow));
    if (data.length < pageSize) break;
  }
  return all.length ? all : null;
}

async function pushPetsToSupabase(petList) {
  if (!supabaseClient) return { skipped: true };
  const rows = petList.map(petRowToSupabaseRecord);
  const chunkSize = 500; // 分批寫入，避免一次送太多筆
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseClient.from("pets").upsert(chunk, { onConflict: "name" });
    if (error) throw error;
  }
  return { skipped: false, count: rows.length };
}

// ── 小工具 ──────────────────────────────────────────────
function toast(msg, ms = 4000) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = "none"; }, ms);
}

function confirmDialog(msg) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmModal");
    document.getElementById("confirmMsg").textContent = msg;
    overlay.style.display = "flex";
    const cleanup = (result) => {
      overlay.style.display = "none";
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    };
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");
    const onYes = () => cleanup(true);
    const onNo = () => cleanup(false);
    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

function fixnum(n) { return Math.floor(Math.round(n * 10000) / 10000); }

function stripBasicSkills(s) {
  if (!s) return s;
  return s.split("、").map((x) => x.trim()).filter((x) => x && x !== "攻擊" && x !== "防禦").join("、");
}

// ── 寵物清單 ──────────────────────────────────────────────
function clearSelectedDisplay() {
  selectedPet = null; selectedIdx = null;
  const lbl = document.getElementById("selectedPetLabel");
  lbl.textContent = "尚未選取寵物"; lbl.classList.remove("active");
  document.getElementById("infoRace").textContent = "種族：-";
  document.getElementById("infoAttr").textContent = "屬性：-";
  document.getElementById("infoSkillSlot").textContent = "技能欄：-格";
  document.getElementById("infoBprate").textContent = "能力倍率：-";
  document.getElementById("simPetName").textContent = "寵物名稱：請在右側選擇寵物";
  document.getElementById("simPetInfo").textContent = "基礎資訊：種族:- | 屬性:- | 技能欄:-格";
  document.getElementById("simPetSkills").textContent = "技能清單：-";
}

function renderPetList(keyword) {
  clearSelectedDisplay();
  const kw = (keyword || "").trim();
  const tbody = document.getElementById("petTableBody");
  tbody.innerHTML = "";
  pets.forEach((p, idx) => {
    if (kw && !p[1].includes(kw) && String(p[0]) !== kw) return;
    const idDisp = p[0] == null ? "-" : p[0];
    const attr = p[10] != null ? p[10] : "-";
    const skills = stripBasicSkills(p[11]) || "-";
    const skillSlot = p[9] != null ? Math.round(p[9]) : "-";
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;
    tr.innerHTML = `
      <td>${idDisp}</td><td class="name-col">${p[1]}</td><td>${p[2]}</td><td>${attr}</td>
      <td>${Math.round(p[3])}</td><td>${Math.round(p[4])}</td><td>${Math.round(p[5])}</td>
      <td>${Math.round(p[6])}</td><td>${Math.round(p[7])}</td><td>${skillSlot}</td>
      <td class="skill-col">${skills}</td>`;
    tr.addEventListener("click", () => selectPet(idx));
    tbody.appendChild(tr);
  });
}

function selectPet(idx) {
  const pet = pets[idx];
  selectedPet = pet; selectedIdx = idx;
  const skillSlot = pet[9] != null ? Math.round(pet[9]) : "-";
  const attr = pet[10] != null ? pet[10] : "-";
  const skills = stripBasicSkills(pet[11]) || "-";

  const lbl = document.getElementById("selectedPetLabel");
  lbl.textContent = `已選擇：${pet[1]}`; lbl.classList.add("active");
  document.getElementById("infoRace").textContent = `種族：${pet[2]}`;
  document.getElementById("infoAttr").textContent = `屬性：${attr}`;
  document.getElementById("infoSkillSlot").textContent = `技能欄：${skillSlot}格`;
  document.getElementById("infoBprate").textContent = `能力倍率：${pet[8]}`;
  document.getElementById("simPetName").textContent = `寵物名稱：${pet[1]}`;
  document.getElementById("simPetInfo").textContent = `基礎資訊：種族:${pet[2]} | 屬性:${attr} | 技能欄:${skillSlot}格`;
  document.getElementById("simPetSkills").textContent = `技能清單：${skills}`;

  document.querySelectorAll("#petTableBody tr").forEach((tr) => tr.classList.remove("selected"));
  const row = document.querySelector(`#petTableBody tr[data-idx="${idx}"]`);
  if (row) row.classList.add("selected");
}

document.getElementById("searchBox").addEventListener("input", (e) => renderPetList(e.target.value));

document.querySelectorAll("#petTable th").forEach((th) => {
  th.addEventListener("click", () => sortByColumn(th.dataset.col));
});

const COL_INDEX = { id: 0, name: 1, race: 2, attr: 10, hp: 3, atk: 4, def: 5, agi: 6, mp: 7, skillSlot: 9, skills: 11 };

function sortByColumn(col) {
  const reverse = sortState[col] || false;
  const idx = COL_INDEX[col];
  // 依目前表格中顯示的列排序（保留搜尋過濾後的結果）
  const visibleIdxs = Array.from(document.querySelectorAll("#petTableBody tr")).map((tr) => Number(tr.dataset.idx));
  visibleIdxs.sort((a, b) => {
    let va = pets[a][idx], vb = pets[b][idx];
    if (va == null) va = "";
    if (vb == null) vb = "";
    const na = Number(va), nb = Number(vb);
    let cmp;
    if (!isNaN(na) && !isNaN(nb) && va !== "" && vb !== "") cmp = na - nb;
    else cmp = String(va).localeCompare(String(vb), "zh-Hant");
    return reverse ? -cmp : cmp;
  });
  const tbody = document.getElementById("petTableBody");
  const rows = {};
  document.querySelectorAll("#petTableBody tr").forEach((tr) => { rows[tr.dataset.idx] = tr; });
  visibleIdxs.forEach((i) => tbody.appendChild(rows[i]));
  sortState[col] = !reverse;
}

// ── 計算 (算檔) ──────────────────────────────────────────────
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setGrowthMode(btn.dataset.mode, btn.dataset.map));
});

function setGrowthMode(mode, map) {
  calcGrowthMode = mode;
  if (map) document.getElementById("simGrowType").value = map;
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
}

function parseStatInput(str) {
  const parts = (str || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n))) return null;
  return nums; // [hp, mp, atk, def, agi]
}

document.getElementById("btnCalc").addEventListener("click", onCalculate);

function onCalculate() {
  if (!selectedPet) { toast("未選取寵物，無法計算"); return; }
  const raw = parseStatInput(document.getElementById("curStats").value);
  if (!raw) { toast("請輸入 5 個數值（血 魔 攻 防 敏），用空格隔開"); return; }
  const [hp, mp, atk, de, agi] = raw;
  const lvl = parseInt(document.getElementById("calcLvl").value, 10);
  const leftover = parseInt(document.getElementById("leftoverPoints").value, 10) || 0;

  const axisMap = { "體": 0, "力": 1, "防": 2, "敏": 3, "魔": 4 };
  const biasAxis = axisMap[calcGrowthMode] != null ? axisMap[calcGrowthMode] : null;

  let notorderpoint = null, strictPoint = false;
  if (leftover > 0) { notorderpoint = leftover; strictPoint = true; }
  else if (calcGrowthMode === "無") { notorderpoint = lvl - 1; strictPoint = true; }

  const available = notorderpoint == null ? lvl - 1 : lvl - 1 - notorderpoint;
  if (biasAxis != null && available <= 0) {
    toast(`目前設定下沒有可分配的等級點數（剩餘點數＝${leftover}，已達等級上限），\n「單獨點${calcGrowthMode}」這個假設不成立，無法算出來。\n請改選「智」或「無」再計算。`);
    document.getElementById("statusMsg").textContent = "無法計算：沒有可分配的點數可供單軸假設";
    return;
  }

  const lvl1Raw = parseStatInput(document.getElementById("lvl1Stats").value);

  document.getElementById("statusMsg").textContent = "計算中…";

  setTimeout(() => {
    let res;
    let candidates = null;

    if (lvl1Raw) {
      const lvl1Res = realGuessByPet(selectedPet, 1, lvl1Raw[0], lvl1Raw[1], lvl1Raw[2], lvl1Raw[3], lvl1Raw[4], 0, null, { mode: "auto" });
      const seen = new Set();
      candidates = [];
      for (const r of lvl1Res.results) {
        const key = JSON.stringify(r.GuessRange.toArray()) + "|" + JSON.stringify(r.RandomRange);
        if (!seen.has(key)) { seen.add(key); candidates.push([r.GuessRange, r.RandomRange]); }
      }
      if (!candidates.length) {
        document.getElementById("statusMsg").textContent = "計算完成";
        toast("一等能力與資料庫最高檔次不符，無解");
        setPanel1(["（一等能力與資料庫最高檔次不符，無解）"]);
        setTable2([]); setTable3([]); setTable4([]);
        return;
      }
    }

    if (candidates) {
      let combined = [];
      for (const [cand, randArr] of candidates) {
        const sub = realGuessByPet(selectedPet, lvl, hp, mp, atk, de, agi, notorderpoint, cand,
          { mode: "auto", biasAxis, strictPoint, fixedRandom: randArr });
        combined = combined.concat(sub.results);
      }
      res = { pet: { name: selectedPet[1], find: true, lvl }, bps: [selectedPet[3], selectedPet[4], selectedPet[5], selectedPet[6], selectedPet[7]], results: combined };
    } else {
      res = realGuessByPet(selectedPet, lvl, hp, mp, atk, de, agi, notorderpoint, null, { mode: "auto", biasAxis, strictPoint });
    }
    onCalcDone(res, lvl);
  }, 10);
}

function onCalcDone(res, lvl) {
  const results = res.results;
  lastResults = results;
  if (!results.length) {
    document.getElementById("statusMsg").textContent = "計算完成，找不到符合的解（共比對 0 組），請確認輸入數值";
    setPanel1(["無符合解"]);
    setTable2([]); setTable3([]); setTable4([]);
    return;
  }
  const analysis = analyzeResults(res.bps, results, lvl);
  document.getElementById("statusMsg").textContent = `計算完成，共 ${analysis.total} 組可能解`;

  if (analysis.sureLost) {
    const lines = [];
    let any = false;
    AXIS_NAMES.forEach((name, i) => {
      if (analysis.sureLost[i] > 0) { lines.push(`必掉 ${Math.round(analysis.sureLost[i])} 檔 ${name}`); any = true; }
    });
    setPanel1(any ? lines : ["沒有必掉的檔次"]);
  } else {
    setPanel1(["（非一等寵物，不顯示必掉檔次）"]);
  }

  setTable2(analysis.topCombos);
  setTable3(analysis.axisHist);
  setTable4(lvl !== 1 ? analysis.manualDist : []);
}

function analyzeResults(petBps, results, lvl) {
  const total = results.length;
  const out = { sureLost: null, topCombos: [], axisHist: [], manualDist: [], total };
  if (!total) return out;

  if (lvl === 1) {
    const dropPerResult = results.map((r) => {
      const gr = r.GuessRange.toArray();
      return [0, 1, 2, 3, 4].map((i) => petBps[i] - gr[i]);
    });
    out.sureLost = [0, 1, 2, 3, 4].map((i) => {
      const col = dropPerResult.map((d) => d[i]);
      const m = Math.min(...col);
      return m > 0 ? m : 0;
    });
  }

  const comboCounter = new Map(), comboExample = new Map();
  for (const r of results) {
    const gr = r.GuessRange.toArray();
    const drop = [0, 1, 2, 3, 4].map((i) => Math.round(petBps[i] - gr[i]));
    const key = drop.join(",");
    comboCounter.set(key, (comboCounter.get(key) || 0) + 1);
    if (!comboExample.has(key)) comboExample.set(key, r);
  }
  const ranked = [...comboCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [key, cnt] of ranked) {
    const drop = key.split(",").map(Number);
    const r = comboExample.get(key);
    const code = r.RandomRange.map((x) => Math.round(x)).join("");
    out.topCombos.push({ drop, totalDrop: drop.reduce((a, v) => a + v, 0), pct: (cnt / total) * 100, code });
  }

  for (let i = 0; i < 5; i++) {
    const counts = [0, 0, 0, 0, 0];
    for (const r of results) {
      const gr = r.GuessRange.toArray();
      let d = Math.round(petBps[i] - gr[i]);
      d = Math.max(0, Math.min(4, d));
      counts[d]++;
    }
    out.axisHist.push(counts.map((c) => (c / total) * 100));
  }

  if (lvl !== 1) {
    const mpCounter = new Map();
    for (const r of results) {
      const key = r.ManualPoints.join(",");
      mpCounter.set(key, (mpCounter.get(key) || 0) + 1);
    }
    const rankedMp = [...mpCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [key, cnt] of rankedMp) {
      out.manualDist.push({ points: key.split(",").map(Number), pct: (cnt / total) * 100 });
    }
  }

  return out;
}

function setPanel1(lines) {
  document.getElementById("panel1").innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function setTable2(topCombos) {
  const el = document.getElementById("panel2");
  if (!topCombos.length) { el.innerHTML = "<div>無資料</div>"; return; }
  let html = `<table class="res-table"><tr><th>檔</th><th>體力</th><th>力量</th><th>防禦</th><th>敏捷</th><th>魔法</th><th>隨機碼</th><th>機率</th></tr>`;
  for (const c of topCombos) {
    html += `<tr><td>${c.totalDrop}檔</td>${c.drop.map((d) => `<td>${d}</td>`).join("")}<td>${c.code}</td><td>${c.pct.toFixed(2)}%</td></tr>`;
  }
  html += "</table>";
  el.innerHTML = html;
}

function setTable3(axisHist) {
  const el = document.getElementById("panel3");
  if (!axisHist.length) { el.innerHTML = "<div>無資料</div>"; return; }
  let html = `<table class="res-table"><tr><th>項目</th><th>0檔</th><th>1檔</th><th>2檔</th><th>3檔</th><th>4檔</th></tr>`;
  AXIS_NAMES.forEach((name, i) => {
    html += `<tr><td>${name}</td>${axisHist[i].map((h) => `<td>${h.toFixed(0)}%</td>`).join("")}</tr>`;
  });
  html += "</table>";
  el.innerHTML = html;
}

function setTable4(manualDist) {
  const el = document.getElementById("panel4");
  if (!manualDist.length) { el.innerHTML = "<div>（一等寵物尚未升級加點，不顯示，或無資料）</div>"; return; }
  let html = `<table class="res-table"><tr><th>體力</th><th>力量</th><th>防禦</th><th>敏捷</th><th>魔法</th><th>機率</th></tr>`;
  for (const m of manualDist) {
    html += `<tr>${m.points.map((p) => `<td>${p}</td>`).join("")}<td>${m.pct.toFixed(2)}%</td></tr>`;
  }
  html += "</table>";
  el.innerHTML = html;
}

// ── 模擬成長 ──────────────────────────────────────────────
document.getElementById("btnResetRandom").addEventListener("click", () => {
  for (let i = 0; i < 5; i++) document.getElementById(`rand${i}`).value = 2;
});

document.getElementById("btnClearSim").addEventListener("click", () => {
  simWindows.forEach((w) => w.el.remove());
  simWindows = [];
  updateSimWindowCount();
});

function updateSimWindowCount() {
  document.getElementById("simWindowCount").textContent = `目前開啟中的模擬視窗：${simWindows.length} 個`;
}

document.getElementById("btnSimulate").addEventListener("click", async () => {
  if (!selectedPet) { toast("未選取寵物，無法計算"); return; }
  const targetLvl = parseInt(document.getElementById("simTargetLvl").value, 10);
  const drop = [0, 1, 2, 3, 4].map((i) => parseInt(document.getElementById(`drop${i}`).value, 10) || 0);
  const randomTiers = [0, 1, 2, 3, 4].map((i) => parseInt(document.getElementById(`rand${i}`).value, 10) || 0);

  const randSum = randomTiers.reduce((a, v) => a + v, 0);
  if (randSum !== 10) {
    const ok = await confirmDialog(`隨機檔總和目前是 ${randSum}（正常應該=10），仍要繼續計算嗎？`);
    if (!ok) return;
  }

  const pet = selectedPet;
  const petBps = [pet[3], pet[4], pet[5], pet[6], pet[7]];
  const bprate = pet[8] || 0.2;
  const candidateTiers = petBps.map((v, i) => v - drop[i]);
  if (candidateTiers.some((t) => t < 0)) { toast("掉檔數值超過該寵物最高檔次上限"); return; }

  const grow = new GrowRange(candidateTiers[0], candidateTiers[1], candidateTiers[2], candidateTiers[3], candidateTiers[4], bprate);
  const growType = document.getElementById("simGrowType").value;
  const base = grow.calcBpAtLevel(targetLvl, 0).baseBP.toArray();
  const manualPoints = targetLvl - 1;
  const alloc = allocPoints(grow, growType, targetLvl, randomTiers, bprate);

  const state = {
    petName: pet[1], race: pet[2], attr: pet[10] != null ? pet[10] : "-",
    skills: stripBasicSkills(pet[11]) || "-", skillSlot: pet[9] != null ? Math.round(pet[9]) : "-",
    targetLvl, growType, drop, randomTiers, base, bprate, manualPoints, alloc,
  };
  openSimWindow(state);
});

function allocPoints(grow, growType, targetLvl, randomTiers, bprate) {
  const totalPoints = targetLvl - 1;
  const alloc = [0, 0, 0, 0, 0];
  if (growType === "完全不點" || totalPoints <= 0) return alloc;

  const biasMap = { "統加體力": 0, "統加力量": 1, "統加防禦": 2, "統加敏捷": 3, "統加魔法": 4 };
  const biasAxis = biasMap[growType];
  const tiers = grow.toArray();

  for (let lvl = 2; lvl <= targetLvl; lvl++) {
    const baseAtLvl = grow.calcBpAtLevel(lvl, 0).baseBP.toArray();
    const totals = [0, 1, 2, 3, 4].map((i) => baseAtLvl[i] + alloc[i] + bprate * randomTiers[i]);
    const axisOrder = biasAxis != null ? [biasAxis] : [0, 1, 2, 3, 4].slice().sort((a, b) => tiers[b] - tiers[a]);
    for (const axis of axisOrder) {
      const nt = totals.slice(); nt[axis] += 1;
      const s = nt.reduce((a, v) => a + v, 0);
      if (nt[axis] > s - nt[axis]) continue;
      alloc[axis] += 1;
      break;
    }
  }
  return alloc;
}

function computeStats(base, alloc, randomTiers, bprate) {
  const x = [0, 1, 2, 3, 4].map((i) => base[i] + alloc[i] + bprate * randomTiers[i]);
  const bp = new BP(x[0], x[1], x[2], x[3], x[4]);
  const r = bp.calcRealNum();
  return {
    hp: Math.round((fixnum(bp.calcHp()) + 20) * 100) / 100,
    mp: Math.round((fixnum(bp.calcMp()) + 20) * 100) / 100,
    attack: Math.round((fixnum(bp.calcAtk()) + 20) * 100) / 100,
    defend: Math.round((fixnum(bp.calcDef()) + 20) * 100) / 100,
    agi: Math.round((fixnum(bp.calcAgi()) + 20) * 100) / 100,
    wis: Math.round((fixnum(bp.calcWis()) + 100) * 100) / 100,
    res: Math.round((fixnum(bp.calcRes()) + 100) * 100) / 100,
    bp: x.map((v) => Math.round(v * 100) / 100),
  };
}

function wouldBurst(state, i, delta) {
  const totals = [0, 1, 2, 3, 4].map((j) => state.base[j] + state.alloc[j] + state.bprate * state.randomTiers[j]);
  totals[i] += delta;
  const s = totals.reduce((a, v) => a + v, 0);
  return totals[i] > s - totals[i];
}

function openSimWindow(state) {
  windowOffset++;
  const container = document.getElementById("simWindows");
  const el = document.createElement("div");
  el.className = "sim-window";
  // 直接停靠在畫面右側，往下依序錯開，避免疊在版面中間蓋住寵物清單
  el.style.right = "16px";
  el.style.top = (16 + (windowOffset % 8) * 28) + "px";
  el.style.left = "auto";

  el.innerHTML = `
    <div class="titlebar">
      <span class="name">名字 ${escapeHtml(state.petName)}</span>
      <button class="closeBtn">✕ 關閉</button>
    </div>
    <div class="body">
      <div class="line2">等級 ${state.targetLvl} <span class="sub">[${escapeHtml(state.growType)}] 掉檔 [${state.drop.join(",")}] 隨機檔 [${state.randomTiers.join(",")}]</span></div>
      <div class="line2" id="hpLine"></div>
      <div class="line2" id="mpLine"></div>
      <div style="color:#f2d98d;margin-top:6px">基本數值（可用 -/+ 手動微調配點）</div>
      <div class="sim-grid" id="simGrid"></div>
      <div class="sub" id="bpLine"></div>
      <div class="sub">技能欄：${state.skillSlot}格　種族：${escapeHtml(state.race)}　屬性：${escapeHtml(state.attr)}</div>
      <div class="skills-line">技能：${escapeHtml(state.skills)}</div>
    </div>`;
  container.appendChild(el);

  const win = { el, state };
  simWindows.push(win);
  updateSimWindowCount();

  el.querySelector(".closeBtn").addEventListener("click", () => {
    el.remove();
    simWindows = simWindows.filter((w) => w !== win);
    updateSimWindowCount();
  });

  makeDraggable(el, el.querySelector(".titlebar"));

  const grid = el.querySelector("#simGrid");
  const combatOrder = ["attack", "defend", "agi", "wis", "res"];

  function refresh(skipFocused) {
    const s = computeStats(state.base, state.alloc, state.randomTiers, state.bprate);
    const remain = state.manualPoints - state.alloc.reduce((a, v) => a + v, 0);
    el.querySelector("#hpLine").textContent = `生命 ${s.hp.toFixed(2)}`;
    el.querySelector("#mpLine").textContent = `魔力 ${s.mp.toFixed(2)}`;
    el.querySelector("#bpLine").textContent = "BP：" + s.bp.map((v) => v.toFixed(2)).join(" ");

    let html = `<div class="remain">剩餘點數 ${remain}</div>`;
    for (let i = 0; i < 5; i++) {
      const baseVal = state.base[i] + state.bprate * state.randomTiers[i];
      const val = (baseVal + state.alloc[i]).toFixed(2);
      const combatKey = combatOrder[i];
      const combatVal = s[combatKey].toFixed(2);
      const maxAllowed = state.manualPoints - (state.alloc.reduce((a, v) => a + v, 0) - state.alloc[i]);
      html += `
        <span>${TIER_LABELS[i]}</span>
        <span class="val">${val}</span>
        <span>${COMBAT_LABELS[combatKey]}</span>
        <span class="val">${combatVal}</span>
        <input type="number" class="alloc-input" data-i="${i}" value="${state.alloc[i]}" min="0" max="${maxAllowed}">`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll(".alloc-input").forEach((inp) => {
      inp.addEventListener("change", () => setAllocDirect(Number(inp.dataset.i), inp));
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); });
    });
  }

  function adjust(i, delta) {
    if (delta > 0) {
      if (state.alloc.reduce((a, v) => a + v, 0) >= state.manualPoints) return;
      if (wouldBurst(state, i, 1)) {
        toast(`「${TIER_LABELS[i]}」這項 BP 已經高於其他四項加總，\n遊戲規則不允許繼續往這項加點（爆點），已擋下這次操作。`);
        return;
      }
    } else {
      if (state.alloc[i] <= 0) return;
    }
    state.alloc[i] += delta;
    refresh();
  }

  function setAllocDirect(i, inputEl) {
    // 讓使用者直接輸入目標配點數，不用一次一次按 -/+（例如要加到 +99 很慢）。
    const raw = inputEl.value.trim();
    let target = parseInt(raw, 10);
    if (isNaN(target)) {
      toast("配點數請輸入整數");
      inputEl.value = state.alloc[i];
      return;
    }
    if (target < 0) target = 0;
    const otherSum = state.alloc.reduce((a, v) => a + v, 0) - state.alloc[i];
    const maxAllowed = state.manualPoints - otherSum;
    if (target > maxAllowed) {
      toast(`點數不夠，這一項最多只能點到 ${maxAllowed}（剩餘點數不足）`);
      target = maxAllowed;
    }
    const old = state.alloc[i];
    state.alloc[i] = target;
    if (wouldBurst(state, i, 0)) {
      toast(`「${TIER_LABELS[i]}」這項 BP 會高於其他四項加總，\n遊戲規則不允許，已經自動調整成能點到的最大值。`);
      // 從 old 到 target 之間二分搜尋找到不會爆點的最大值
      let lo = old, hi = target, best = old;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        state.alloc[i] = mid;
        if (wouldBurst(state, i, 0)) { hi = mid - 1; } else { best = mid; lo = mid + 1; }
      }
      state.alloc[i] = best;
    }
    refresh();
  }

  refresh();
}

function makeDraggable(el, handle) {
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  handle.addEventListener("mousedown", (e) => {
    dragging = true; sx = e.clientX; sy = e.clientY;
    ox = el.offsetLeft; oy = el.offsetTop;
    el.style.right = "auto";  // 開始拖曳後改用 left 定位，避免跟原本的 right 定位互相打架
    el.style.left = ox + "px";
    el.style.zIndex = String(++makeDraggable._z || 20);
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    el.style.left = (ox + e.clientX - sx) + "px";
    el.style.top = (oy + e.clientY - sy) + "px";
  });
  document.addEventListener("mouseup", () => { dragging = false; });
}

// ── 更新寵物資料（跨域抓取） ──────────────────────────────────
const PET_LIST_URL = "https://cg-originmood-dc.github.io/%E5%AF%B5%E7%89%A9%E6%B8%85%E5%96%AE/";
const NEWS_LIST_URL = "https://cg.originmood.com/news.html";
// 自建的 Cloudflare Worker 代理（選填，見 cloudflare-worker-proxy.js 與 README.md）。
// 有填的話會第一個優先嘗試，比依賴別人的免費公開代理穩定很多。
const OWN_WORKER_PROXY_URL = "https://mowuz-proxy.eyasutw.workers.dev/"; // 例如: "https://mowuz-proxy.your-name.workers.dev"

const CORS_PROXIES = [
  ...(OWN_WORKER_PROXY_URL ? [(u) => `${OWN_WORKER_PROXY_URL}/?url=${encodeURIComponent(u)}`] : []),
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://proxy.cors.sh/${u}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

async function fetchViaProxy(url) {
  const errors = [];
  for (const makeUrl of CORS_PROXIES) {
    const proxyUrl = makeUrl(url);
    try {
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (!text || text.trim().length < 20) throw new Error("回應內容是空的");
      return text;
    } catch (err) {
      errors.push(`${proxyUrl} → ${err.message}`);
    }
  }
  // 免費的公開代理服務常常會失效、被限流、或需要另外申請 key，這裡把每一個嘗試過的
  // 代理和對應的錯誤都列出來，方便直接看出目前是「全部都失效了」還是特定一個有問題。
  throw new Error("所有跨域代理都失敗了，明細：\n" + errors.join("\n"));
}

function toNum(s) {
  s = (s || "").trim();
  if (s === "" || s === "-") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function fetchPetListFromWeb() {
  const html = await fetchViaProxy(PET_LIST_URL);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = [...doc.querySelectorAll("table")];
  if (!tables.length) throw new Error("網頁裡找不到任何 <table>，網站排版可能已變更");
  let table = tables[0], maxRows = 0;
  for (const t of tables) {
    const n = t.querySelectorAll("tr").length;
    if (n > maxRows) { maxRows = n; table = t; }
  }
  const rows = [...table.querySelectorAll("tr")].slice(1);
  const out = [];
  rows.forEach((row, i) => {
    const cells = [...row.querySelectorAll("td,th")].map((c) => c.textContent.trim());
    if (cells.length < 14) return;
    const name = cells[2], race = cells[4];
    const hp = toNum(cells[5]), atk = toNum(cells[6]), de = toNum(cells[7]), agi = toNum(cells[8]), mp = toNum(cells[9]);
    const skillSlot = toNum(cells[10]);
    const attr = cells[12], skills = cells[13], source = cells[3];
    out.push([i + 1, name, race, hp, atk, de, agi, mp, 0.2, skillSlot, attr, skills, source]);
  });
  return out;
}

function parsePetCardsFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results = [];
  const norm = (s) => (s || "").trim().replace(/[:：]$/, "").trim();
  for (const table of doc.querySelectorAll("table")) {
    const cells = [...table.querySelectorAll("td,th")].map((c) => norm(c.textContent));
    const nonEmpty = cells.filter((c) => c);
    if (nonEmpty.length < 24) continue;
    if (nonEmpty[0] !== "寵物名稱" || nonEmpty[2] !== "能力總檔" || nonEmpty[3] !== "屬性") continue;
    try {
      const name = nonEmpty[4], total = nonEmpty[5], attr = nonEmpty[6];
      if (nonEmpty[7] !== "體力" || nonEmpty[9] !== "種族") continue;
      const hp = nonEmpty[8], race = nonEmpty[10];
      if (nonEmpty[11] !== "力量" || nonEmpty[13] !== "技能格") continue;
      const atk = nonEmpty[12], skillSlot = nonEmpty[14];
      if (nonEmpty[15] !== "防禦" || nonEmpty[17] !== "初始技能") continue;
      const de = nonEmpty[16], initialSkills = nonEmpty[18];
      if (nonEmpty[19] !== "速度") continue;
      const agi = nonEmpty[20], skillsFull = nonEmpty[21];
      if (nonEmpty[22] !== "魔法") continue;
      const mp = nonEmpty[23];
      let skills = skillsFull ? `${initialSkills}、${skillsFull}` : initialSkills;
      skills = stripBasicSkills(skills);
      results.push({ name, race, hp: toNum(hp), atk: toNum(atk), def: toNum(de), agi: toNum(agi), mp: toNum(mp),
        skillSlot: toNum(skillSlot), attr, skills, total: toNum(total) });
    } catch (e) { /* 格式跟預期不符，跳過這個表格 */ }
  }
  return results;
}

async function fetchLatestNewsPets(maxPosts = 10) {
  const html = await fetchViaProxy(NEWS_LIST_URL);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [];
  const seen = new Set();
  for (const a of doc.querySelectorAll("a[href]")) {
    let href = a.getAttribute("href");
    if (href && href.includes("NewsContent")) {
      const full = new URL(href, NEWS_LIST_URL).href;
      if (!seen.has(full)) { seen.add(full); links.push(full); }
    }
    if (links.length >= maxPosts) break;
  }
  if (!links.length) throw new Error("在公告列表頁裡找不到任何公告連結，網站排版可能已變更");

  const found = new Map();
  const errors = [];
  for (const link of links) {
    try {
      const pageHtml = await fetchViaProxy(link);
      for (const pet of parsePetCardsFromHtml(pageHtml)) found.set(pet.name, pet);
    } catch (err) { errors.push(`${link}: ${err.message}`); }
  }
  if (!found.size && errors.length) throw new Error("公告連結都抓取失敗，例如：" + errors[0]);
  return [...found.values()];
}

function mergeNewsPets(basePets, newsPets) {
  const byName = new Map(basePets.map((p, i) => [p[1], i]));
  let updated = 0, added = 0;
  const addedNames = [];
  for (const np of newsPets) {
    const row = [null, np.name, np.race, np.hp, np.atk, np.def, np.agi, np.mp, 0.2, np.skillSlot, np.attr, np.skills, "官方最新公告"];
    if (byName.has(np.name)) {
      const idx = byName.get(np.name);
      row[0] = basePets[idx][0];
      basePets[idx] = row;
      updated++;
    } else {
      basePets.push(row);
      added++;
      addedNames.push(np.name);
    }
  }
  return { updated, added, addedNames };
}

document.getElementById("btnUpdate").addEventListener("click", async () => {
  const shareNote = supabaseClient
    ? "\n\n這個網頁版已經設定共用資料庫（Supabase），更新完成後也會同步寫回去，\n讓其他人打開網頁時也能看到這次更新的內容。"
    : "";
  const ok = await confirmDialog(
    "即將從寵物清單網站抓取最新資料，並額外檢查官網「最新資訊」公告頁裡\n" +
    "近期公告出現的新寵物資料，然後覆蓋目前的寵物資料。\n\n" +
    "注意：網頁版需要透過公開的跨域代理服務才能抓取，若代理服務當下不穩定可能會失敗，\n可以稍後再試一次。" +
    shareNote + "\n\n確定要更新嗎？");
  if (!ok) return;

  document.getElementById("statusMsg").textContent = "更新中，正在連線抓取資料…";
  try {
    let newPets = await fetchPetListFromWeb();
    let newsUpdated = 0, newsAdded = 0, newsError = null, addedNames = [];
    try {
      const newsPets = await fetchLatestNewsPets();
      const r = mergeNewsPets(newPets, newsPets);
      newsUpdated = r.updated; newsAdded = r.added; addedNames = r.addedNames;
    } catch (err) {
      newsError = err.message;
    }
    if (addedNames.length) {
      // 把這次新增的寵物排到清單最前面，讓使用者一打開就先看到新寵物
      const addedSet = new Set(addedNames);
      const newRows = newPets.filter((p) => addedSet.has(p[1]));
      const oldRows = newPets.filter((p) => !addedSet.has(p[1]));
      newPets = newRows.concat(oldRows);
    }
    pets = newPets;
    renderPetList(document.getElementById("searchBox").value);
    document.getElementById("statusMsg").textContent = `更新完成，共 ${pets.length} 筆寵物資料`;

    let shareResult = "";
    if (supabaseClient) {
      try {
        await pushPetsToSupabase(newPets);
        shareResult = "\n已同步寫入共用資料庫，其他人打開網頁也能看到這次更新。";
      } catch (err) {
        shareResult = `\n\n⚠️ 寫入共用資料庫失敗（本機資料仍正常更新）：\n${err.message}`;
      }
    }

    let extra = "";
    if (newsUpdated || newsAdded) {
      extra = `\n另外從最新公告頁面更新了 ${newsUpdated} 筆、新增了 ${newsAdded} 筆寵物資料`;
      if (addedNames.length) extra += "（新寵物已排到清單最上方）：\n" + addedNames.join("、");
      extra += "。";
    } else if (newsError) extra = `\n\n⚠️ 公告頁面的寵物資料抓取失敗（主清單仍正常更新）：\n${newsError}`;
    toast(`已更新為最新的 ${pets.length} 筆寵物資料。${extra}${shareResult}`, 10000);
  } catch (err) {
    document.getElementById("statusMsg").textContent = "更新失敗";
    toast("更新失敗：" + err.message, 8000);
  }
});

// ── 左側模擬面板收合/展開 ──────────────────────────────────
function expandLeftPanel() {
  document.getElementById("leftExpanded").style.display = "block";
}
function collapseLeftPanel() {
  document.getElementById("leftExpanded").style.display = "none";
}
document.getElementById("btnCollapseLeft").addEventListener("click", collapseLeftPanel);
document.getElementById("btnOpenSimPanel").addEventListener("click", expandLeftPanel);

// ── 初始化 ──────────────────────────────────────────────
renderPetList("");
if (supabaseClient) {
  document.getElementById("statusMsg").textContent = "正在讀取共用資料庫…";
  loadPetsFromSupabase()
    .then((cloudPets) => {
      if (cloudPets) {
        pets = cloudPets;
        renderPetList(document.getElementById("searchBox").value);
        document.getElementById("statusMsg").textContent = `已讀取共用資料庫，共 ${pets.length} 筆寵物資料`;
      } else {
        document.getElementById("statusMsg").textContent = "共用資料庫目前是空的，使用內建資料";
      }
    })
    .catch((err) => {
      document.getElementById("statusMsg").textContent = "讀取共用資料庫失敗，使用內建資料";
      console.error("Supabase 讀取失敗：", err);
    });
}
