// calc.js — 魔力寶貝寵物檔次計算核心引擎（網頁版）
// 忠實移植自已驗證過的 calc.py，邏輯與 Python 桌面版完全一致。
// 原始演算法移植自開源專案 cg-pet-calc (MIT License, by TonyQ)

// ─────────────────────────────────────────────────────────────
// 每級成長係數表 (index = 該軸檔次 0~110)
// ─────────────────────────────────────────────────────────────
const FULL_RATES = {
  0: 0.00, 1: 0.04, 2: 0.08, 3: 0.12, 4: 0.16, 5: 0.205, 6: 0.25, 7: 0.29,
  8: 0.33, 9: 0.37, 10: 0.415, 11: 0.46, 12: 0.50, 13: 0.54, 14: 0.58,
  15: 0.625, 16: 0.67, 17: 0.71, 18: 0.75, 19: 0.79, 20: 0.835, 21: 0.88,
  22: 0.92, 23: 0.96, 24: 1.00, 25: 1.045, 26: 1.09, 27: 1.13, 28: 1.17,
  29: 1.21, 30: 1.255, 31: 1.30, 32: 1.34, 33: 1.38, 34: 1.42, 35: 1.465,
  36: 1.51, 37: 1.55, 38: 1.59, 39: 1.63, 40: 1.675, 41: 1.72, 42: 1.76,
  43: 1.80, 44: 1.84, 45: 1.885, 46: 1.93, 47: 1.97, 48: 2.01, 49: 2.05,
  50: 2.095, 51: 2.14, 52: 2.18, 53: 2.22, 54: 2.26, 55: 2.305, 56: 2.35,
  57: 2.39, 58: 2.43, 59: 2.47, 60: 2.515, 61: 2.56, 62: 2.60, 63: 2.64,
  64: 2.68, 65: 2.725, 66: 2.77, 67: 2.81, 68: 2.85, 69: 2.89, 70: 2.935,
  71: 2.98, 72: 3.02, 73: 3.06, 74: 3.10, 75: 3.145, 76: 3.19, 77: 3.23,
  78: 3.27, 79: 3.31, 80: 3.355, 81: 3.40, 82: 3.44, 83: 3.48, 84: 3.52,
  85: 3.565, 86: 3.61, 87: 3.65, 88: 3.69, 89: 3.73, 90: 3.775, 91: 3.82,
  92: 3.86, 93: 3.90, 94: 3.94, 95: 3.985, 96: 4.03, 97: 4.07, 98: 4.11,
  99: 4.15, 100: 4.195, 101: 4.24, 102: 4.28, 103: 4.32, 104: 4.36,
  105: 4.405, 106: 4.45, 107: 4.49, 108: 4.53, 109: 4.57, 110: 4.615,
};

// BP -> 能力值 轉換矩陣（列：血/魔/攻/防/敏，欄：體/力/防/敏/魔 五種 BP）
const M_BP = [
  [8, 2, 3, 3, 1],
  [1, 2, 2, 2, 10],
  [0.2, 2.7, 0.3, 0.3, 0.2],
  [0.2, 0.3, 3, 0.3, 0.2],
  [0.1, 0.2, 0.2, 2, 0.1],
];
const M_WIS = [-0.3, -0.1, 0.2, -0.1, 0.8];
const M_RES = [0.8, -0.1, -0.1, 0.2, -0.3];

function fixPos(n) {
  // 先四捨五入去除浮點雜訊，再無條件捨去
  return Math.floor(Math.round(n * 10000) / 10000);
}

function fixStat(n) {
  return Math.floor(Math.round(n * 10000) / 10000) + 20;
}

function dot5(v, row) {
  return v[0]*row[0] + v[1]*row[1] + v[2]*row[2] + v[3]*row[3] + v[4]*row[4];
}

// ─────────────────────────────────────────────────────────────
// BP：一組「假想能力點」(hpp/attackp/defendp/agip/mpp)
// ─────────────────────────────────────────────────────────────
class BP {
  constructor(hp, attack, defend, agi, mp) {
    this.hpp = hp; this.attackp = attack; this.defendp = defend;
    this.agip = agi; this.mpp = mp;
  }
  toArray() { return [this.hpp, this.attackp, this.defendp, this.agip, this.mpp]; }
  calcHp() { return dot5(this.toArray(), M_BP[0]); }
  calcMp() { return dot5(this.toArray(), M_BP[1]); }
  calcAtk() { return dot5(this.toArray(), M_BP[2]); }
  calcDef() { return dot5(this.toArray(), M_BP[3]); }
  calcAgi() { return dot5(this.toArray(), M_BP[4]); }
  calcWis() { return dot5(this.toArray(), M_WIS); }
  calcRes() { return dot5(this.toArray(), M_RES); }
  sum() { return this.hpp + this.attackp + this.defendp + this.agip + this.mpp; }

  calcRealNum() {
    const base5 = 20;
    return {
      hp: fixPos(this.calcHp()) + base5,
      mp: fixPos(this.calcMp()) + base5,
      attack: fixPos(this.calcAtk()) + base5,
      defend: fixPos(this.calcDef()) + base5,
      agi: fixPos(this.calcAgi()) + base5,
      wis: fixPos(this.calcWis()) + 100,
      res: fixPos(this.calcRes()) + 100,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Stat：玩家實際觀測到的寵物能力
// ─────────────────────────────────────────────────────────────
class Stat {
  constructor(lvl, hp, mp, attack, defend, agi) {
    this.lvl = lvl; this.hp = hp; this.mp = mp;
    this.attack = attack; this.defend = defend; this.agi = agi;
  }
  toBP() {
    // 解線性方程組 M_BP * x = b（5x5 高斯消去法，取代 numpy.linalg.solve）
    const b = [this.hp - 20, this.mp - 20, this.attack - 20, this.defend - 20, this.agi - 20];
    const x = solve5x5(M_BP, b);
    return new BP(x[0], x[1], x[2], x[3], x[4]);
  }
}

function solve5x5(mat, b) {
  const n = 5;
  const A = mat.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col] / A[col][col];
      for (let c = col; c <= n; c++) A[r][c] -= factor * A[col][c];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

// ─────────────────────────────────────────────────────────────
// GrowRange：一組「候選最高成長檔」+ 成長倍率(bprate)
// ─────────────────────────────────────────────────────────────
class GrowRange {
  constructor(hp, attack, defend, agi, mp, bprate = 0.2) {
    this.hpp = hp; this.attackp = attack; this.defendp = defend;
    this.agip = agi; this.mpp = mp;
    this.bprate = bprate == null ? 0.2 : bprate;
  }
  toArray() { return [this.hpp, this.attackp, this.defendp, this.agip, this.mpp]; }
  bps() { return this.toArray(); }
  sum() { return this.hpp + this.attackp + this.defendp + this.agip + this.mpp; }

  contains(other) {
    return this.hpp <= other.hpp && this.mpp <= other.mpp &&
           this.attackp <= other.attackp && this.defendp <= other.defendp &&
           this.agip <= other.agip;
  }

  calcBpAtLevel(lvl, lvlpoint) {
    const bps = [this.hpp * this.bprate, this.attackp * this.bprate,
                 this.defendp * this.bprate, this.agip * this.bprate, this.mpp * this.bprate];
    const lvldiff = lvl - 1;
    const tiers = [this.hpp, this.attackp, this.defendp, this.agip, this.mpp];
    for (let i = 0; i < 5; i++) bps[i] += FULL_RATES[Math.round(tiers[i])] * lvldiff;
    if (lvlpoint == null) lvlpoint = lvldiff;
    const sumBase = bps.reduce((a, v) => a + v, 0);
    return {
      baseBP: new BP(bps[0], bps[1], bps[2], bps[3], bps[4]),
      sumBaseBP: sumBase + 10 * this.bprate,
      sumFullBP: sumBase + 10 * this.bprate + lvlpoint,
    };
  }

  loopRange(cb) {
    const sumBp = this.sum();
    const ranges = [
      [this.hpp - 4, this.hpp], [this.attackp - 4, this.attackp],
      [this.defendp - 4, this.defendp], [this.agip - 4, this.agip],
      [this.mpp - 4, this.mpp],
    ];
    for (let a = ranges[0][0]; a <= ranges[0][1] + 1e-9; a++)
      for (let b = ranges[1][0]; b <= ranges[1][1] + 1e-9; b++)
        for (let c = ranges[2][0]; c <= ranges[2][1] + 1e-9; c++)
          for (let d = ranges[3][0]; d <= ranges[3][1] + 1e-9; d++)
            for (let e = ranges[4][0]; e <= ranges[4][1] + 1e-9; e++)
              cb(sumBp, new GrowRange(a, b, c, d, e, this.bprate));
  }

  mockLoopRange(grow, cb) { cb(this.sum(), grow); }

  guess(stat, notorderpoint, targetGrow, opts) {
    opts = opts || {};
    const mode = opts.mode || "exact";
    const biasAxis = opts.biasAxis == null ? null : opts.biasAxis;
    const strictPoint = !!opts.strictPoint;
    const fixedRandom = opts.fixedRandom || null;
    const point = stat.lvl - 1 - notorderpoint;

    const rungs = [];
    const ladder = (tol) => {
      rungs.push([point, tol]);
      if (stat.lvl !== 1 && !strictPoint) rungs.push([0, tol]);
    };
    if (mode === "auto") {
      ladder(null);
      ladder(observerTolerance(stat.lvl, opts.catchLvl || 0));
    } else if (mode === "observer") {
      ladder(observerTolerance(stat.lvl, opts.catchLvl || 0));
    } else {
      ladder(null);
    }

    for (const [p, tol] of rungs) {
      const res = this.guessWithSpecificLvlPoint(stat, p, targetGrow, tol, biasAxis, fixedRandom);
      if (res.length) return res;
    }
    return [];
  }

  guessWithSpecificLvlPoint(stat, point, targetGrow, nudgeTol, biasAxis, fixedRandom) {
    const result = [];
    const statUp = new Stat(stat.lvl, stat.hp + 1, stat.mp + 1, stat.attack + 1, stat.defend + 1, stat.agi + 1);
    const calcUpBp = statUp.toBP();

    const handle = (sumBp, growRange) => {
      this._handleGuessingGrowRange(growRange, stat, point, calcUpBp, result, sumBp, nudgeTol, biasAxis, fixedRandom);
    };

    if (targetGrow != null) {
      this.mockLoopRange(targetGrow, handle);
    } else {
      this.loopRange(handle);
    }
    return result;
  }

  _handleGuessingGrowRange(growRange, stat, point, calcUpBp, result, sumBp, nudgeTol, biasAxis, fixedRandom) {
    if (!growRange.contains(this)) return;

    const res = growRange.calcBpAtLevel(stat.lvl, point);

    let nudges = null, useNudges = false;
    let slack = { stat: [0, 0, 0, 0, 0], sum: 0 };
    if (nudgeTol != null) {
      nudges = growRange.toArray().map((t) => tierNudges(t, nudgeTol));
      useNudges = nudges.some((n) => n.length > 1);
      if (useNudges) slack = nudgeSlack(nudges, nudgeTol);
    }

    const calcBp = stat.toBP();
    const oSum = calcBp.sum();
    const oUpSum = calcUpBp.sum();
    if (!(oSum - slack.sum <= res.sumFullBP && res.sumFullBP <= oUpSum + slack.sum)) return;

    const baseArr = res.baseBP.toArray();
    const upArr = calcUpBp.toArray();
    const sl = [0, 1, 2, 3, 4].map((i) => upArr[i] - baseArr[i] + 1);
    const [bp0, bp1, bp2, bp3, bp4] = baseArr;
    const bprate = growRange.bprate;
    const [tHp, tMp, tAtk, tDef, tAgi] = [stat.hp, stat.mp, stat.attack, stat.defend, stat.agi];

    const minHpR = bprate * 10, maxHpR = bprate * 80;
    const minMpR = bprate * 10, maxMpR = bprate * 100;
    const minAtkR = bprate * 2, maxAtkR = bprate * 27;
    const minDefR = bprate * 2, maxDefR = bprate * 30;
    const minAgiR = bprate * 1, maxAgiR = bprate * 20;

    const maxBps = this.bps();
    const possibleLost = possibleLostRange(growRange, maxBps);
    const grSum = growRange.sum();
    const [sHp, sMp, sAtk, sDef, sAgi] = slack.stat;

    const tryManualPoint = (a, b, c, d, e) => {
      const m0 = bp0 + a, m1 = bp1 + b, m2 = bp2 + c, m3 = bp3 + d, m4 = bp4 + e;

      const hpBase = 8*m0 + 2*m1 + 3*m2 + 3*m3 + m4;
      if (tHp - 19 - hpBase + sHp <= minHpR || tHp - 20 - hpBase - sHp >= maxHpR) return;
      const mpBase = m0 + 2*m1 + 2*m2 + 2*m3 + 10*m4;
      if (tMp - 19 - mpBase + sMp <= minMpR || tMp - 20 - mpBase - sMp >= maxMpR) return;
      const atkBase = 0.2*m0 + 2.7*m1 + 0.3*m2 + 0.3*m3 + 0.2*m4;
      if (tAtk - 19 - atkBase + sAtk <= minAtkR || tAtk - 20 - atkBase - sAtk >= maxAtkR) return;
      const defBase = 0.2*m0 + 0.3*m1 + 3*m2 + 0.3*m3 + 0.2*m4;
      if (tDef - 19 - defBase + sDef <= minDefR || tDef - 20 - defBase - sDef >= maxDefR) return;
      const agiBase = 0.1*m0 + 0.2*m1 + 0.2*m2 + 2*m3 + 0.1*m4;
      if (tAgi - 19 - agiBase + sAgi <= minAgiR || tAgi - 20 - agiBase - sAgi >= maxAgiR) return;

      if (fixedRandom != null) {
        const [r0, r1, r2, r3, r4] = fixedRandom;
        const x0 = m0 + bprate*r0, x1 = m1 + bprate*r1, x2 = m2 + bprate*r2,
              x3 = m3 + bprate*r3, x4 = m4 + bprate*r4;
        if (isBurst(x0, x1, x2, x3, x4)) return;
        const hp = fixStat(8*x0 + 2*x1 + 3*x2 + 3*x3 + x4);
        const mp = fixStat(x0 + 2*x1 + 2*x2 + 2*x3 + 10*x4);
        const atk = fixStat(0.2*x0 + 2.7*x1 + 0.3*x2 + 0.3*x3 + 0.2*x4);
        const deff = fixStat(0.2*x0 + 0.3*x1 + 3*x2 + 0.3*x3 + 0.2*x4);
        const agi = fixStat(0.1*x0 + 0.2*x1 + 0.2*x2 + 2*x3 + 0.1*x4);
        if (hp === tHp && mp === tMp && atk === tAtk && deff === tDef && agi === tAgi) {
          const bp = new BP(x0, x1, x2, x3, x4);
          result.push({
            SumGrowBPs: sumBp, MaxGrowBPs: maxBps, GuessRange: growRange,
            LostBP: grSum - sumBp, PossibleLost: possibleLost,
            guess: bp.calcRealNum(), ManualPoints: [a, b, c, d, e],
            RandomRange: [r0, r1, r2, r3, r4], isNudged: false,
          });
        }
        return;
      }

      for (let r0 = 0; r0 <= 10; r0++) {
        const x0 = m0 + bprate * r0;
        for (let r1 = 0; r1 <= 10 - r0; r1++) {
          const x1 = m1 + bprate * r1;
          for (let r2 = 0; r2 <= 10 - r0 - r1; r2++) {
            const x2 = m2 + bprate * r2;
            for (let r3 = 0; r3 <= 10 - r0 - r1 - r2; r3++) {
              const r4 = 10 - r0 - r1 - r2 - r3;
              const x3 = m3 + bprate * r3, x4 = m4 + bprate * r4;

              if (isBurst(x0, x1, x2, x3, x4)) continue;

              let nudged = false;
              if (useNudges) {
                const verdict = observerMatch(nudges, [x0, x1, x2, x3, x4], tHp, tMp, tAtk, tDef, tAgi);
                if (verdict < 0) continue;
                nudged = verdict === 1;
              } else {
                if (fixStat(8*x0 + 2*x1 + 3*x2 + 3*x3 + x4) !== tHp) continue;
                if (fixStat(x0 + 2*x1 + 2*x2 + 2*x3 + 10*x4) !== tMp) continue;
                if (fixStat(0.2*x0 + 2.7*x1 + 0.3*x2 + 0.3*x3 + 0.2*x4) !== tAtk) continue;
                if (fixStat(0.2*x0 + 0.3*x1 + 3*x2 + 0.3*x3 + 0.2*x4) !== tDef) continue;
                if (fixStat(0.1*x0 + 0.2*x1 + 0.2*x2 + 2*x3 + 0.1*x4) !== tAgi) continue;
              }

              const bp = new BP(x0, x1, x2, x3, x4);
              result.push({
                SumGrowBPs: sumBp, MaxGrowBPs: maxBps, GuessRange: growRange,
                LostBP: grSum - sumBp, PossibleLost: possibleLost,
                guess: bp.calcRealNum(), ManualPoints: [a, b, c, d, e],
                RandomRange: [r0, r1, r2, r3, r4], isNudged: nudged,
              });
            }
          }
        }
      }
    };

    if (biasAxis != null) {
      if (0 <= point && point <= sl[biasAxis]) {
        const pt = [0, 0, 0, 0, 0];
        pt[biasAxis] = point;
        tryManualPoint(...pt);
      }
      return;
    }

    const ub = (x) => (x < 0 ? -1 : Math.floor(x + 1e-9));
    const aMax = ub(Math.min(sl[0], point));
    for (let a = 0; a <= aMax; a++) {
      const remA = point - a;
      const bMax = ub(Math.min(sl[1], remA));
      for (let b = 0; b <= bMax; b++) {
        const remB = remA - b;
        const cMax = ub(Math.min(sl[2], remB));
        for (let c = 0; c <= cMax; c++) {
          const remC = remB - c;
          const dMax = ub(Math.min(sl[3], remC));
          for (let d = 0; d <= dMax; d++) {
            const e = remC - d;
            if (e < 0 || e > sl[4]) continue;
            tryManualPoint(a, b, c, d, e);
          }
        }
      }
    }
  }
}

function isBurst(x0, x1, x2, x3, x4) {
  const vals = [x0, x1, x2, x3, x4];
  const total = vals.reduce((a, v) => a + v, 0);
  return vals.some((v) => v > total - v);
}

function possibleLostRange(growRange, maxBp) {
  const maxBasePos = 10;
  const guessRange = growRange.toArray();
  const sureLost = guessRange.map((v, i) => (v < maxBp[i] ? maxBp[i] - v : 0));
  const sumSureLost = sureLost.reduce((a, v) => a + v, 0);
  const sureBaseOver = guessRange.map((v, i) => (v > maxBp[i] ? v - maxBp[i] : 0));
  const sumSureBase = sureBaseOver.reduce((a, v) => a + v, 0);

  const ranges = guessRange.map((v, i) => {
    const maxV = maxBp[i];
    const thisOverBase = v - maxV;
    const otherOverBase = sumSureBase - thisOverBase;
    const localMax = maxBasePos - otherOverBase;
    return [Math.max(0, maxV - v), Math.min(4, maxV + localMax - v)];
  });

  return {
    sumSureLost, sureLost,
    possibleLostRange: ranges.map((r) => `${r[0]}~${r[1]}`),
  };
}

const OBSERVER_TOL_MIN = 0.01, OBSERVER_TOL_MAX = 0.1;
function observerTolerance(lvl, catchLvl) {
  const raw = (lvl - (catchLvl || 0)) / 200;
  return Math.min(OBSERVER_TOL_MAX, Math.max(OBSERVER_TOL_MIN, raw));
}

function tierNudges(tier, tol) {
  const r = Math.round(tier) % 5;
  if (r === 0 && tier > 1) return [0, -tol, tol];
  if (r === 1) return [0, -tol];
  return [0];
}

function nudgeSlack(nudges, tol) {
  const movable = nudges.map((n) => n.length > 1);
  const rowSlack = (row) => tol * row.reduce((a, c, i) => a + (movable[i] ? Math.abs(c) : 0), 0);
  return {
    stat: M_BP.map(rowSlack),
    sum: tol * movable.filter(Boolean).length,
  };
}

function statsEqual(x0, x1, x2, x3, x4, tHp, tMp, tAtk, tDef, tAgi) {
  return fixStat(8*x0+2*x1+3*x2+3*x3+x4) === tHp &&
         fixStat(x0+2*x1+2*x2+2*x3+10*x4) === tMp &&
         fixStat(0.2*x0+2.7*x1+0.3*x2+0.3*x3+0.2*x4) === tAtk &&
         fixStat(0.2*x0+0.3*x1+3*x2+0.3*x3+0.2*x4) === tDef &&
         fixStat(0.1*x0+0.2*x1+0.2*x2+2*x3+0.1*x4) === tAgi;
}

function observerMatch(nudges, x, tHp, tMp, tAtk, tDef, tAgi) {
  let total = 1;
  for (const n of nudges) total *= n.length;
  for (let combo = 0; combo < total; combo++) {
    let rest = combo, nudged = false;
    const v = [...x];
    for (let i = 0; i < 5; i++) {
      const k = rest % nudges[i].length;
      rest = Math.floor(rest / nudges[i].length);
      if (k !== 0) { v[i] += nudges[i][k]; nudged = true; }
    }
    if (statsEqual(v[0], v[1], v[2], v[3], v[4], tHp, tMp, tAtk, tDef, tAgi)) {
      return nudged ? 1 : 0;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────
// 對外主要入口
// ─────────────────────────────────────────────────────────────
function realGuessByPet(pet, lvl, hp, mp, attack, defend, agi, notorderpoint, targetGrow, opts) {
  const bpsArr = [pet[3], pet[4], pet[5], pet[6], pet[7]];
  const bprate = pet[8] == null ? 0.2 : Number(pet[8]);
  const rng = new GrowRange(bpsArr[0], bpsArr[1], bpsArr[2], bpsArr[3], bpsArr[4], bprate);
  const stat = new Stat(lvl, hp, mp, attack, defend, agi);
  const results = rng.guess(stat, notorderpoint || 0, targetGrow || null, opts || {});
  return { pet: { name: pet[1], find: true, lvl }, bps: bpsArr, results };
}

// 直接用一等的「體/力/防/敏/魔」BP 值反推候選檔次+隨機檔（不搭配一等能力時使用）。
// 一等時 BP = 成長倍率 × (最高檔次 + 隨機檔)，但遊戲面板上的 BP 只會顯示整數
// （四捨五入後的結果），資訊量比小數少很多，單靠這個反推容易得到大量候選
// （因為同一個整數 BP 可能對應到很多組檔次+隨機檔分配）。建議搭配「一等能力」一起填，
// 這裡只在使用者沒填一等能力時，作為退而求其次的做法。
function getBpTierOptions(pet, bpValues) {
  const maxTiers = [pet[3], pet[4], pet[5], pet[6], pet[7]];
  const bprate = pet[8] == null ? 0.2 : Number(pet[8]);
  const perAxis = [];
  for (let i = 0; i < 5; i++) {
    const targetInt = Math.round(bpValues[i]);
    const tiers = new Set();
    for (let tier = 0; tier <= Math.round(maxTiers[i]); tier++) {
      for (let r = 0; r <= 10; r++) {
        if (Math.round(bprate * (tier + r)) === targetInt) { tiers.add(tier); break; }
      }
    }
    perAxis.push(tiers);
  }
  return perAxis;
}

function solveLvl1FromBp(pet, bpValues) {
  const maxTiers = [pet[3], pet[4], pet[5], pet[6], pet[7]];
  const bprate = pet[8] == null ? 0.2 : Number(pet[8]);

  const perAxis = [];
  for (let i = 0; i < 5; i++) {
    const targetInt = Math.round(bpValues[i]);
    const options = [];
    for (let tier = 0; tier <= Math.round(maxTiers[i]); tier++) {
      for (let r = 0; r <= 10; r++) {
        if (Math.round(bprate * (tier + r)) === targetInt) options.push([tier, r]);
      }
    }
    perAxis.push(options);
    if (!options.length) return [];
  }

  const results = [];
  for (const c0 of perAxis[0]) {
    if (c0[1] > 10) continue;
    for (const c1 of perAxis[1]) {
      const r01 = c0[1] + c1[1];
      if (r01 > 10) continue;
      for (const c2 of perAxis[2]) {
        const r012 = r01 + c2[1];
        if (r012 > 10) continue;
        for (const c3 of perAxis[3]) {
          const r0123 = r012 + c3[1];
          if (r0123 > 10) continue;
          for (const c4 of perAxis[4]) {
            if (r0123 + c4[1] === 10) {
              results.push({ tiers: [c0[0], c1[0], c2[0], c3[0], c4[0]], randomRange: [c0[1], c1[1], c2[1], c3[1], c4[1]] });
            }
          }
        }
      }
    }
  }
  return results;
}
