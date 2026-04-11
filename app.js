// ══════════════════════════════════════════════════════
//  HYBRS — app.js v2.0
//  変更点: JSONバックアップ削除 → スプシ復元に統一
// ══════════════════════════════════════════════════════

const SHEET_ID = "1Ifxf58OVebL7KcWvOBXSPwK7K_xkGfzk5cSJPumRI58";

// ── 選択肢定数
const O = {
  time: ["朝","昼","夕方","夜","深夜"],
  action: [
    "無言で耐えた","深呼吸した","その場を離れた","冷静に対応した","心の中で毒づいた","その他"
  ],
  monster: [
    "きぐるい","ゾンビ","妖怪","機械","害虫","自然災害","ボス系モンスター","幽霊","毒キノコ","臭悪",
    "エイリアン(理解不能)","スライム(粘着質)","猛獣(攻撃的)","吸血鬼（時間・気力を吸う）",
    "ゴブリン（小悪党）","暴走機関車（止まらない）","泥人形（話が通じない）",
    "カメレオン（意見が変わる）","裸の王様（権力振りかざし）","バグ・エラー（システム的理不尽）",
    "寄生植物（養分を奪う）","bot（定型文しか言わない）","ノイズ（ただうるさい）","その他"
  ],
  body: [
    "胃がギュッとなった","顔が熱くなった",
    "心拍数が跳ね上がった","手が震えた","無表情になった","その他"
  ],
  trigger: [
    "プライドを傷つけられた","期待を裏切られた",
    "不公平を感じた","無視・軽視された",
    "価値観を否定された","努力を無駄にされた",
    "嘘・誤魔化し","非効率を強要された","その他"
  ],
  before: [
    "不安","疲れ","悲しみ","焦り",
    "睡眠不足","空腹・体調不良","集中を邪魔された","何も感じてなかった","その他"
  ],
  music: [
    "激しく叫ぶ","静かに語りかける","皮肉っぽく歌う","泣きながら歌う","リズムで刻む",
    "壮大なオーケストラで絶望を表現","ポップで明るく狂気を歌う",
    "呪文のようにブツブツと唱える（お経風）","民族音楽風に怒りを鎮める",
    "8ビット（ファミコン風）でコミカルに","EDMでテンションに任せて踊り狂う",
    "昭和歌謡風に哀愁を漂わせる","ゲームのボス戦BGM風","不協和音の現代音楽"
  ],
};

// ── localStorage
const lsGet = (k, d, r) => {
  try {
    const v = localStorage.getItem(k);
    if (v === null) return d;
    const p = JSON.parse(v);
    return r ? r(p) : p;
  } catch { return d; }
};
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ══════════════════════════════════════════════════════
//  GASバックアップ（自動追記 + 復元）
// ══════════════════════════════════════════════════════
let GAS_BACKUP_URL = lsGet("af_gas_url", "");

// 1件をGASに送信
async function sendToGAS(log) {
  if (!GAS_BACKUP_URL) return;
  const d = new Date(log.date);
  const jst = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
  const payload = {
    datetime:    jst.toLocaleString("ja-JP"),
    time:        log.time        || "",
    place:       log.place       || "",
    fact:        log.fact        || "",
    action:      log.action      || "",
    monster:     log.monster     || "",
    skill:       log.skill       || "",
    monsterName: log.monsterName || "",
    intensity:   log.intensity   || "",
    body:        log.body        || "",
    quote:       log.quote       || "",
    fantasy:     log.fantasy     || "",
    trigger:     log.trigger     || "",
    before:      log.before      || "",
    music:       log.music       || "",
    title:       log.title       || "",
    note:        log.note        || "",
    result:      log.reacted ? "記録のみ" : "勝利",
    pts:         calcPts(log)
  };
  try {
    await fetch(GAS_BACKUP_URL, { method: "POST", body: JSON.stringify(payload) });
    log.gasSynced = true;
    lsSet("af_logs", logs);
  } catch (e) {
    console.warn("GAS backup failed:", e);
  }
}

// 未送信ログだけをスプシに追記
async function syncToGAS() {
  if (!GAS_BACKUP_URL) { alert("設定タブでGAS URLを先に登録してください"); return; }
  var unsent = logs.filter(function(l) { return !l.gasSynced; });
  if (unsent.length === 0) { alert("すべて同期済みです ✓"); return; }
  if (!confirm(unsent.length + "件の未送信ログをスプシに送信しますか？")) return;
  var btn = document.getElementById("btn-sync-gas");
  if (btn) { btn.disabled = true; btn.textContent = "送信中…"; }
  var ok = 0;
  // 古い順に送信（スプシの行順を時系列にする）
  var sorted = unsent.slice().sort(function(a, b) { return a.date - b.date; });
  for (var i = 0; i < sorted.length; i++) {
    try {
      await sendToGAS(sorted[i]);
      sorted[i].gasSynced = true;
      ok++;
    } catch (e) { console.warn("sync fail:", e); }
  }
  lsSet("af_logs", logs);
  if (btn) { btn.disabled = false; btn.textContent = "☁️ スプシに同期"; }
  alert("✅ " + ok + "/" + unsent.length + "件を送信しました");
}

// ★ スプシから復元（CSV公開エンドポイント経由 — CORS問題なし）
// 簡易CSVパーサー（ダブルクォート・カンマ・改行対応）
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuote = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i++; }
        else { inQuote = false; }
      } else { field += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
        if (c === '\r') i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function restoreFromGAS() {
  if (!confirm("スプシのバックアップシートからデータを復元しますか？\n現在のローカルデータは上書きされます。")) return;

  var btn = document.getElementById("btn-restore-gas");
  if (btn) { btn.disabled = true; btn.textContent = "復元中…"; }

  try {
    // スプシの「バックアップ」シートをCSVで直接取得（褒め言葉と同じ仕組み）
    var csvUrl = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent("バックアップ");
    var res = await fetch(csvUrl);
    if (!res.ok) throw new Error("スプシの取得に失敗しました（" + res.status + "）");
    var text = await res.text();

    var parsed = parseCSV(text);
    if (parsed.length <= 1) { alert("スプシにデータがありません"); return; }

    // 1行目=ヘッダー、2行目以降=データ
    var headers = parsed[0];
    var dataRows = parsed.slice(1);

    // ヘッダー名 → インデックスのマップ
    var col = {};
    headers.forEach(function(h, i) { col[h.trim()] = i; });

    // 必須列チェック
    if (col["日時"] === undefined) {
      alert("「日時」列が見つかりません。バックアップシートのヘッダーを確認してください。");
      return;
    }

    var get = function(row, key) { return col[key] !== undefined ? (row[col[key]] || "") : ""; };

    var restored = dataRows.map(function(row, i) {
      // 日時文字列からタイムスタンプを復元
      var dateMs = Date.now() - (dataRows.length - i) * 60000; // フォールバック
      var dtStr = get(row, "日時");
      if (dtStr) {
        // "2025/4/11 18:30:00" 形式をパース
        var parsed2 = new Date(dtStr.replace(/\//g, "-"));
        if (!isNaN(parsed2.getTime())) {
          dateMs = parsed2.getTime() - 540 * 60000; // JSTからUTCに戻す
        }
      }

      var result = get(row, "結果");
      var isWin = result !== "記録のみ";

      return {
        id: dateMs + i,
        time:        get(row, "時刻"),
        place:       get(row, "場所"),
        fact:        get(row, "事実"),
        action:      get(row, "対応"),
        monster:     get(row, "敵属性"),
        skill:       get(row, "技名"),
        monsterName: get(row, "敵名"),
        intensity:   parseInt(get(row, "強度")) || 7,
        body:        get(row, "身体反応"),
        quote:       get(row, "捨て台詞"),
        fantasy:     get(row, "妄想"),
        trigger:     get(row, "引き金"),
        before:      get(row, "前の感情"),
        music:       get(row, "曲"),
        title:       get(row, "タイトル"),
        note:        get(row, "補足"),
        reacted:     !isWin,
        date:        dateMs
      };
    });

    restored.sort(function(a, b) { return b.date - a.date; });

    logs = restored;
    lsSet("af_logs", logs);

    wins = logs.filter(function(l) { return !l.reacted; }).map(function(l) {
      return { id: l.id, date: l.date, pts: WIN_BASE_PTS + calcBonus(l.intensity || 7), logId: l.id };
    });
    lsSet("af_wins", wins);

    renderLogs();
    updateHeader();
    renderHomeLoses();

    alert("✅ " + restored.length + "件を復元しました！");

  } catch (e) {
    alert("復元失敗: " + e.message);
    console.error("Restore error:", e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "☁️ スプシから復元"; }
  }
}

// キャッシュクリア＆強制リロード
function forceUpdate() {
  if ("caches" in window) {
    caches.keys().then(n => Promise.all(n.map(k => caches.delete(k)))).then(() => location.reload(true));
  } else {
    location.reload(true);
  }
}

// GAS URLを保存
function saveGasUrl() {
  const val = document.getElementById("gas-url-input").value.trim();
  GAS_BACKUP_URL = val;
  lsSet("af_gas_url", val);
  const st = document.getElementById("gas-url-status");
  if (st) st.textContent = val ? "✅ URL設定済み" : "未設定";
  alert(val ? "✅ GAS URLを保存しました" : "URLをクリアしました");
}

// ── STATE
const DEF_PRAISES = ["お前、今日も勝った。","感情より知性が勝った瞬間。","不動の心、また一段強くなった。","衝動をいなした。それがワタベの強さ。","6秒やり過ごした。十分すごい。","今日の判断、5年後の自分が誇る。","静かに強い。それが本物。","電車ごときに不動の心は揺るがない。","修羅場で動じなかった男。","今日の我慢、スペアリブ1本分の価値がある。","感情じゃなく実力で返す。プロだ。","今日の怒り、のちに名曲になる。","あの相手、モンスターカードにしてやれ。","雑魚に反応しなかった。それが余裕。","外部環境に左右されない心、今日も育った。","勝った！","お前の勝ちだ。完全に。","今日の辛抱が、明日の余裕を作る。","怒りは燃料。今日も正しく使った。","今日もデータが増えた。それが成長の証明書。"];
const DEF_LOSES = ["信頼の修復に3ヶ月かかる","自分のエネルギーを無駄消費する","相手じゃなく自分が一番損する","「感情的な人」と一生記憶される","後から後悔する言動が出る","職場での評価が静かに下がる","怒った側が損をする世界の法則","冷静な人との差がさらに開く"];
const DEF_IMGS = ["https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=600&fit=crop","https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=400&h=600&fit=crop","https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=600&fit=crop"];
const DEF_SHOP = [];
const BREATH = [
  {label:"鼻から吸う",  dur:2, scaleStart:1.0, scaleEnd:1.2,  hint:"👃 鼻からゆっくり吸う",     easing:"ease-in"},
  {label:"もう一口",   dur:1, scaleStart:1.2,  scaleEnd:1.45, hint:"👃 もう一口、追加で吸い込む",  easing:"ease-in"},
  {label:"ゆっくり吐く",dur:6, scaleStart:1.45, scaleEnd:0.78, hint:"👄 口から細く長く吐き出す…",  easing:"linear"},
];

let logs    = lsGet("af_logs", [], a => Array.isArray(a) ? a.map(l => ({...l, date: Number(l.date)})) : []);
let wins    = lsGet("af_wins", [], a => Array.isArray(a) ? a.map(w => ({...w, date: Number(w.date)})) : []);
let shop    = lsGet("af_shop", DEF_SHOP);
let shopPts = lsGet("af_shopPts", 0);
let praises = lsGet("af_praises", DEF_PRAISES);
let loses   = lsGet("af_loses", DEF_LOSES);
let currentWinId = null;
let imgs = (() => {
  const n = lsGet("af_imgs_count", 0);
  if (n === 0) return [...DEF_IMGS];
  const a = [];
  for (let i = 0; i < n; i++) { const v = lsGet("af_img_" + i, null); if (v) a.push(v); }
  return a.length ? a : [...DEF_IMGS];
})();

// ── CALC
const WIN_BASE_PTS = 150;
const calcBonus = i => Math.round(850 * Math.pow(Math.max(1, Math.min(10, i)) / 10, 1.3));
const calcPts = l => l.reacted ? 0 : WIN_BASE_PTS + calcBonus(l.intensity || 7);
const earned = () => wins.reduce((s, w) => s + w.pts, 0);
const avail = () => Math.max(0, earned() - shopPts);
const todayWins = () => {
  const now = new Date();
  const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const t = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate()).getTime();
  return wins.filter(w => {
    const d = new Date(w.date);
    const jd = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
    const dt = new Date(jd.getFullYear(), jd.getMonth(), jd.getDate()).getTime();
    return dt === t;
  }).length;
};
const totalWins = () => wins.length;
const ago = d => {
  const now = new Date();
  const jstNow = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const today = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate()).getTime();
  const target = new Date(d);
  const jstTarget = new Date(target.getTime() + (target.getTimezoneOffset() + 540) * 60000);
  const targetDay = new Date(jstTarget.getFullYear(), jstTarget.getMonth(), jstTarget.getDate()).getTime();
  const n = Math.floor((today - targetDay) / 86400000);
  if (n < 0) return "今日";
  return n === 0 ? "今日" : n === 1 ? "昨日" : n + "日前";
};
const rnd = a => a[Math.floor(Math.random() * a.length)];
const s3 = a => { const c = [...a], r = []; for (let i = 0; i < Math.min(3, c.length); i++) { const j = Math.floor(Math.random() * (c.length - i)); r.push(c.splice(j, 1)[0]); } return r; };

// ── SCREEN
let currentScreen = "home";
function goScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nb").forEach(b => b.classList.remove("act"));
  document.getElementById("scr-" + id).classList.add("active");
  const nb = document.getElementById("nav-" + id);
  if (nb) nb.classList.add("act");
  currentScreen = id;
  if (id === "shop") renderShop();
  if (id === "logs") renderLogs();
  if (id === "set") renderImgSlots();
  updateHeader();
}
function updateHeader() {
  const a = avail(), e = earned(), tw = todayWins(), aw = totalWins();
  document.getElementById("hdr-pts").textContent = "★ " + a.toLocaleString() + "P";
  document.getElementById("hdr-wins").textContent = "今日 " + tw + "勝";
  document.getElementById("stat-today").textContent = tw;
  document.getElementById("stat-total").textContent = aw;
  document.getElementById("stat-pts").textContent = e.toLocaleString();
}

// ── HOME
function renderHomeLoses() {
  document.getElementById("lose-list").innerHTML = s3(loses).map((t, i) =>
    '<div class="lose-item"><span class="lose-n">' + (i + 1) + '</span><span class="lose-t">' + t + '</span></div>'
  ).join("");
}

// ── EMERGENCY
let cntT = null, breathT = null, bPhIdx = 0, bTimer = 0, bCycle = 0;
function startEmergency() {
  renderHomeLoses();
  const winId = Date.now();
  currentWinId = winId;
  wins.push({id: winId, date: Date.now(), pts: WIN_BASE_PTS, logId: null});
  lsSet("af_wins", wins);
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("scr-emergency").classList.add("active");
  document.querySelectorAll(".nb").forEach(b => b.classList.remove("act"));
  showPhase("count"); startCountdown();
  updateHeader();
}
function showPhase(p) {
  ["count","breathe","reward"].forEach(id => {
    const el = document.getElementById("phase-" + id);
    if (!el) return;
    el.style.display = (id === p) ? "flex" : "none";
  });
  if (p === "reward") {
    const r = document.getElementById("phase-reward");
    r.style.flexDirection = "column"; r.style.flex = "1"; r.style.minHeight = "0"; r.style.overflow = "hidden";
  }
}
function startCountdown() {
  let n = 6;
  document.getElementById("cnt-num").textContent = n;
  document.getElementById("cnt-bar").style.width = "0%";
  clearInterval(cntT);
  cntT = setInterval(() => {
    n--;
    document.getElementById("cnt-num").textContent = n;
    document.getElementById("cnt-msg-n").textContent = n;
    document.getElementById("cnt-bar").style.width = ((6 - n) / 6 * 100) + "%";
    if (n <= 0) { clearInterval(cntT); startBreathe(); }
  }, 1000);
}
function startBreathe() { clearInterval(cntT); bPhIdx = 0; bCycle = 0; showPhase("breathe"); runBreath(); }
function runBreath() {
  const ph = BREATH[bPhIdx]; bTimer = ph.dur;
  const circle = document.getElementById("breath-circle");
  document.getElementById("breath-label").textContent = ph.label;
  document.getElementById("breath-timer").textContent = bTimer;
  document.getElementById("breath-hint").textContent = ph.hint;
  circle.style.transition = "none";
  circle.style.transform = "scale(" + ph.scaleStart + ")";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      circle.style.transition = "transform " + ph.dur + "s " + ph.easing;
      circle.style.transform = "scale(" + ph.scaleEnd + ")";
    });
  });
  clearInterval(breathT);
  breathT = setInterval(() => {
    bTimer--;
    document.getElementById("breath-timer").textContent = bTimer;
    if (bTimer <= 0) {
      clearInterval(breathT);
      bPhIdx++;
      if (bPhIdx >= BREATH.length) {
        bCycle++;
        const d = document.getElementById("dot" + (bCycle - 1)); if (d) d.classList.add("done");
        if (bCycle >= 3) { showReward(); return; }
        bPhIdx = 0;
      }
      runBreath();
    }
  }, 1000);
}
function showReward() {
  clearInterval(breathT);
  document.getElementById("praise-txt").textContent = rnd(praises);
  const pv2 = WIN_BASE_PTS + calcBonus(formState.intensity || 7);
  document.getElementById("praise-pts").textContent = "★ " + pv2.toLocaleString() + "P 獲得（記録でさらにボーナス）";
  const imgArr = imgs.length ? imgs : DEF_IMGS;
  const imgEl = document.getElementById("rew-img");
  const fbEl = document.getElementById("rew-fallback");
  imgEl.style.display = "block"; fbEl.style.display = "none";
  imgEl.src = rnd(imgArr);
  showPhase("reward");
}
function endEmergency() { clearInterval(cntT); clearInterval(breathT); goScreen("home"); }
document.getElementById("panic-btn").onclick = startEmergency;
document.getElementById("skip-to-breathe").onclick = () => { clearInterval(cntT); startBreathe(); };
document.getElementById("skip-to-reward").onclick = () => { clearInterval(breathT); showReward(); };
document.getElementById("btn-shuffle").onclick = () => {
  document.getElementById("praise-txt").textContent = rnd(praises);
  const imgEl = document.getElementById("rew-img"); const fbEl = document.getElementById("rew-fallback");
  imgEl.style.display = "block"; fbEl.style.display = "none";
  imgEl.src = rnd(imgs.length ? imgs : DEF_IMGS);
};
document.getElementById("btn-to-log").onclick = () => { endEmergency(); goScreen("form"); };
document.getElementById("btn-done").onclick = endEmergency;

// ══════════════════════════════════════════════════════
//  FORM
// ══════════════════════════════════════════════════════
let formState = {
  reacted: false, intensity: 7,
  time: [], action: [], monster: [], body: [], trigger: [], before: [], music: [],
};

function toggleCard(id) {
  const body = document.getElementById("body-" + id);
  const arrow = document.getElementById("arrow-" + id);
  const isOpen = body.classList.contains("open");
  if (isOpen) {
    body.style.height = body.scrollHeight + "px";
    requestAnimationFrame(() => { body.style.height = "0px"; });
    body.classList.remove("open");
    arrow.classList.remove("open");
  } else {
    body.classList.add("open");
    arrow.classList.add("open");
    body.style.height = body.scrollHeight + "px";
    body.addEventListener("transitionend", function h() {
      if (body.classList.contains("open")) body.style.height = "auto";
      body.removeEventListener("transitionend", h);
    });
  }
}

function makeChips(containerId, opts, stateKey, multi, colorClass) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = opts.map(o => {
    const sel = (formState[stateKey] || []).includes(o);
    const cc = sel ? (colorClass || "sel") : "";
    return '<span class="chip ' + cc + '" data-key="' + stateKey + '" data-val="' + o + '" onclick="toggleChip(this,\'' + stateKey + '\',' + multi + ',\'' + (colorClass || "sel") + '\')">' + o + '</span>';
  }).join("");
}

function toggleChip(el, key, multi, cls) {
  const val = el.dataset.val;
  if (!multi) {
    formState[key] = [val];
    document.querySelectorAll('[data-key="' + key + '"]').forEach(c => {
      c.className = "chip" + (c.dataset.val === val ? " " + cls : "");
    });
  } else {
    const arr = formState[key] || [];
    const idx = arr.indexOf(val);
    if (idx >= 0) { arr.splice(idx, 1); el.className = "chip"; }
    else { arr.push(val); el.className = "chip " + cls; }
    formState[key] = arr;
  }
  const freeWrap = document.getElementById("free-" + key + "-wrap");
  if (freeWrap) {
    const hasOther = (formState[key] || []).includes("その他");
    freeWrap.className = "free-input-wrap" + (hasOther ? " show" : "");
  }
  updateBadge(key);
  updatePtsPreview();
}

function updateBadge(key) {
  const cardMap = {time:"fact",action:"fact",monster:"enemy",skill:"enemy",body:"exp",fantasy:"exp",quote:"exp",trigger:"ana",before:"ana",music:"ana"};
  const cardId = cardMap[key];
  if (!cardId) return;
  const cardKeys = Object.entries(cardMap).filter(([k, v]) => v === cardId).map(([k]) => k);
  const filled = cardKeys.some(k => {
    const v = formState[k];
    if (Array.isArray(v)) return v.length > 0;
    return false;
  });
  const textIds = {fact:["f-place","f-fact"],enemy:["f-skill","f-monster-name"],exp:["f-body-free","f-fantasy","f-quote"],ana:["f-title","f-note"]};
  const tFilled = (textIds[cardId] || []).some(id => { const el = document.getElementById(id); return el && el.value.trim(); });
  const badge = document.getElementById("badge-" + cardId);
  if (badge) {
    badge.textContent = (filled || tFilled) ? "入力済み" : "未記入";
    badge.className = "sec-card-badge" + ((filled || tFilled) ? " filled" : "");
  }
}

function setupTextBadge(id, cardId) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", () => {
    const textIds = {fact:["f-place","f-fact"],enemy:["f-skill","f-monster-name"],exp:["f-body-free","f-fantasy","f-quote"],ana:["f-title","f-note"]};
    const tFilled = (textIds[cardId] || []).some(tid => { const te = document.getElementById(tid); return te && te.value.trim(); });
    const badge = document.getElementById("badge-" + cardId);
    if (badge) { badge.textContent = tFilled ? "入力済み" : "未記入"; badge.className = "sec-card-badge" + (tFilled ? " filled" : ""); }
    updatePtsPreview();
  });
}

function initFormChips() {
  const get = k => getQOpts(k);
  makeChips("chips-time",    get("time"),    "time",    false, "sel");
  makeChips("chips-action",  get("action"),  "action",  true,  "sel-grn");
  makeChips("chips-monster", get("monster"), "monster", true,  "sel-red");
  makeChips("chips-body",    get("body"),    "body",    true,  "sel-pur");
  makeChips("chips-trigger", get("trigger"), "trigger", false, "sel-gld");
  makeChips("chips-before",  get("before"),  "before",  true,  "sel");
  makeChips("chips-music",   get("music"),   "music",   false, "sel-gld");
  ["f-place","f-fact"].forEach(id => setupTextBadge(id, "fact"));
  ["f-skill","f-monster-name"].forEach(id => setupTextBadge(id, "enemy"));
  ["f-body-free","f-fantasy","f-quote"].forEach(id => setupTextBadge(id, "exp"));
  ["f-title"].forEach(id => setupTextBadge(id, "ana"));
}

function updateIntensity(v) {
  formState.intensity = +v;
  const col = +v >= 8 ? "var(--red)" : +v >= 5 ? "var(--gld)" : "var(--grn)";
  document.getElementById("intensity-val").textContent = v;
  document.getElementById("intensity-val").style.color = col;
  document.getElementById("intensity-slider").style.background =
    'linear-gradient(to right,var(--blu) ' + ((v - 1) / 9 * 100) + '%,var(--br) ' + ((v - 1) / 9 * 100) + '%)';
  updatePtsPreview();
}
function updatePtsPreview() {
  const i = formState.intensity || 7;
  const bonus = calcBonus(i);
  const total = WIN_BASE_PTS + bonus;
  const el = document.getElementById("pts-preview");
  el.textContent = "★ " + total.toLocaleString() + "P";
  el.style.color = "var(--gld)";
  document.getElementById("btn-save-log").textContent = "★ 記録して" + bonus.toLocaleString() + "P獲得";
}

function resetForm() {
  formState = {reacted: false, intensity: 7, time: [], action: [], monster: [], body: [], trigger: [], before: [], music: []};
  document.querySelectorAll(".chip").forEach(c => { c.className = "chip"; });
  document.querySelectorAll(".free-input-wrap").forEach(w => { w.className = "free-input-wrap"; });
  ["f-place","f-fact","f-skill","f-monster-name","f-fantasy","f-quote","f-title","f-note","f-action-free","f-monster-free","f-body-free","f-trigger-free","f-before-free"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.querySelectorAll(".sec-card-badge").forEach(b => { b.textContent = "未記入"; b.className = "sec-card-badge"; });
  document.getElementById("intensity-slider").value = 7;
  updateIntensity(7);
  updatePtsPreview();
}

// 保存（GAS自動送信付き）
document.getElementById("btn-save-log").onclick = () => {
  const f = v => document.getElementById(v) ? document.getElementById(v).value : "";
  const logId = Date.now();
  const log = {
    id: logId,
    time: formState.time[0] || "",
    place: f("f-place"), fact: f("f-fact"),
    action: [...formState.action, f("f-action-free")].filter(Boolean).join("/"),
    monster: [...formState.monster, f("f-monster-free")].filter(Boolean).join("/"),
    skill: f("f-skill"),
    monsterName: f("f-monster-name"),
    intensity: formState.intensity,
    body: [...formState.body, f("f-body-free")].filter(Boolean).join("/"),
    fantasy: f("f-fantasy"),
    trigger: formState.trigger[0] || "", before: formState.before.join("/"),
    quote: f("f-quote"),
    title: f("f-title"),
    music: formState.music[0] || "",
    note: f("f-note"),
    reacted: false,
    date: Date.now()
  };
  logs.unshift(log);
  lsSet("af_logs", logs);
  sendToGAS(log);

  const bonus = calcBonus(formState.intensity || 7);
  const earnedThis = WIN_BASE_PTS + bonus;

  if (currentWinId) {
    const w = wins.find(x => x.id === currentWinId);
    if (w) { w.pts = earnedThis; w.logId = logId; }
  } else {
    wins.push({id: Date.now(), date: Date.now(), pts: earnedThis, logId: logId});
  }
  lsSet("af_wins", wins);
  currentWinId = null;

  const totalP = wins.reduce((s, w) => s + w.pts, 0) - shopPts;

  document.getElementById("rec-pts").textContent = earnedThis.toLocaleString() + "P";
  document.getElementById("rec-pts-detail").textContent = "150P（勝利）+ " + bonus.toLocaleString() + "P（記録ボーナス）";
  document.getElementById("rec-total-wins").textContent = totalWins();
  document.getElementById("rec-avail-pts").textContent = Math.max(0, totalP).toLocaleString();
  const t = document.getElementById("f-title") ? document.getElementById("f-title").value : "";
  document.getElementById("rec-title-display").textContent = t ? "「" + t + "」" : "";

  resetForm();
  updateHeader();
  document.getElementById("record-overlay").style.display = "flex";
};

// ══════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════
function renderShop() {
  const a = avail(), e = earned(), tw = todayWins(), aw = totalWins();
  document.getElementById("shop-pts-num").textContent = a.toLocaleString();
  document.getElementById("shop-pts-sub").textContent = "獲得 " + e.toLocaleString() + "P − 消費 " + shopPts.toLocaleString() + "P";
  document.getElementById("shop-today").textContent = tw;
  document.getElementById("shop-total").textContent = aw;
  document.getElementById("shop-list").innerHTML = shop.map(item => {
    const pct = Math.min(100, Math.round(a / item.pts * 100));
    const can = a >= item.pts;
    const cnt = item.exchangeCount || 0;
    return '<div class="shop-item">' +
      '<div class="si-top">' +
        '<span class="si-name">' + item.name + '</span>' +
        '<div style="display:flex;align-items:center;gap:7px">' +
          (cnt > 0 ? '<span style="font-size:9px;color:var(--mu);background:var(--s2);border:1px solid var(--br);border-radius:10px;padding:1px 7px">' + cnt + '回交換済</span>' : '') +
          '<span class="si-pts">' + item.pts.toLocaleString() + 'P</span>' +
        '</div>' +
      '</div>' +
      '<div class="si-bar"><div class="si-fi" style="width:' + pct + '%"></div></div>' +
      '<div class="si-bot">' +
        '<span class="si-pct">' + (can ? "🎉 交換できる！" : a.toLocaleString() + " / " + item.pts.toLocaleString() + "P (" + pct + "%)") + '</span>' +
        '<div class="si-actions">' +
          '<button class="si-btn ex" ' + (can ? "" : "disabled") + ' onclick="exchangeItem(' + item.id + ')">交換</button>' +
          '<button class="si-btn" onclick="editItem(' + item.id + ')">編集</button>' +
          '<button class="si-btn" onclick="deleteShopItem(' + item.id + ')">削除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}
function addShopItem() {
  const name = document.getElementById("new-item-name").value.trim();
  const pts = parseInt(document.getElementById("new-item-pts").value);
  if (!name || isNaN(pts) || pts <= 0) return;
  shop.push({id: Date.now(), name, pts}); lsSet("af_shop", shop);
  document.getElementById("new-item-name").value = ""; document.getElementById("new-item-pts").value = "";
  renderShop();
}
function deleteShopItem(id) { shop = shop.filter(i => i.id !== id); lsSet("af_shop", shop); renderShop(); }
function editItem(id) {
  const item = shop.find(i => i.id === id); if (!item) return;
  const name = prompt("名前を変更:", item.name); if (name === null) return;
  const pts = parseInt(prompt("ポイント数を変更:", item.pts)); if (isNaN(pts) || pts <= 0) return;
  item.name = name.trim() || item.name; item.pts = pts; lsSet("af_shop", shop); renderShop();
}
function exchangeItem(id) {
  const item = shop.find(i => i.id === id); if (!item || avail() < item.pts) return;
  shopPts += item.pts; lsSet("af_shopPts", shopPts);
  item.exchangeCount = (item.exchangeCount || 0) + 1; lsSet("af_shop", shop);
  document.getElementById("congrats-name").textContent = item.name + "と交換しました";
  document.getElementById("congrats-pts").textContent = "-" + item.pts.toLocaleString() + "P · 残り " + avail().toLocaleString() + "P";
  document.getElementById("congrats-overlay").style.display = "flex";
  renderShop(); updateHeader();
}

// ══════════════════════════════════════════════════════
//  LOGS
// ══════════════════════════════════════════════════════
function deleteLog(id) {
  if (!confirm("この記録を削除しますか？")) return;
  const log = logs.find(l => l.id === id);
  if (log && !log.reacted) {
    wins = wins.filter(w => w.logId !== id);
    lsSet("af_wins", wins);
  }
  logs = logs.filter(l => l.id !== id);
  lsSet("af_logs", logs);
  renderLogs();
  updateHeader();
}
function renderLogs() {
  document.getElementById("log-list").innerHTML = logs.map(l => {
    const p = calcPts(l);
    const col = l.intensity >= 8 ? "rgba(220,85,85,.15)" : l.intensity >= 5 ? "rgba(200,152,46,.12)" : "rgba(72,180,114,.1)";
    const tc = l.intensity >= 8 ? "#e09090" : l.intensity >= 5 ? "var(--gld)" : "var(--grn)";
    return '<div class="log-item">' +
      '<div class="ib" style="background:' + col + ';color:' + tc + '">' + (l.intensity || "?") + '</div>' +
      '<div class="ldet">' +
        '<div class="lt">' + (l.title || l.fact || "記録") + '</div>' +
        '<div class="lm">' + ago(l.date) + (l.time ? " · " + l.time : "") + (l.place ? " · " + l.place : "") + '</div>' +
        (l.quote ? '<div class="lm" style="color:rgba(230,220,200,.45)">「' + l.quote.slice(0, 22) + '…」</div>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div>' + (l.monster ? '<span class="ltag">🎴' + l.monster.split("/")[0] + '</span>' : '') + (p > 0 ? '<span class="ltag" style="color:var(--gld)">★' + p + 'P</span>' : '') + '</div>' +
          '<button onclick="deleteLog(' + l.id + ')" style="background:none;border:none;color:var(--dim);font-size:11px;padding:4px">削除</button>' +
        '</div>' +
      '</div>' +
      '<span class="rtag" style="background:' + (l.reacted ? "var(--rlo)" : "rgba(72,180,114,.07)") + ';color:' + (l.reacted ? "#e08080" : "var(--grn)") + '">' + (l.reacted ? "次は勝つ" : "✓勝利") + '</span>' +
    '</div>';
  }).join("") || '<div style="text-align:center;color:var(--mu);padding:24px;font-size:13px">まだ記録がありません</div>';
}

// ══════════════════════════════════════════════════════
//  SETTINGS — 画像管理
// ══════════════════════════════════════════════════════
function saveImgsIndividually() {
  for (let i = 0; i < 5; i++) {
    if (imgs[i]) lsSet("af_img_" + i, imgs[i]);
    else { try { localStorage.removeItem("af_img_" + i); } catch {} }
  }
  lsSet("af_imgs_count", imgs.length);
}
function renderImgSlots() {
  const cnt = imgs.length;
  const rem = document.getElementById("img-slots-remaining");
  const addBtn = document.getElementById("btn-add-img");
  const cntEl = document.getElementById("imgs-count");
  if (rem) rem.textContent = 5 - cnt;
  if (addBtn) addBtn.style.display = cnt >= 5 ? "none" : "block";
  if (cntEl) cntEl.textContent = cnt + "枚";
  const slots = document.getElementById("img-slots");
  const gasInput = document.getElementById("gas-url-input");
  if (gasInput) {
    gasInput.value = GAS_BACKUP_URL;
    const st = document.getElementById("gas-url-status");
    if (st) st.textContent = GAS_BACKUP_URL ? "✅ URL設定済み" : "未設定";
  }
  if (!slots) return;
  slots.innerHTML = imgs.map((url, i) => {
    const isBase = url.startsWith("data:");
    return '<div class="img-slot">' +
      '<img class="img-thumb" src="' + url + '" onerror="this.style.opacity=\'.25\'">' +
      '<div class="img-info"><div class="img-name">写真 ' + (i + 1) + '</div><div class="img-type">' + (isBase ? "端末から読込" : "URL") + '</div></div>' +
      '<label class="img-chg">変更<input type="file" accept="image/*" style="display:none" onchange="replaceImg(' + i + ',this)"></label>' +
      '<button class="img-del" onclick="removeImg(' + i + ')">✕</button>' +
    '</div>';
  }).join("");
}
function compressAndPush(file, callback) {
  const img2 = new Image(), url = URL.createObjectURL(file);
  img2.onload = () => {
    const M = 800, c = document.createElement("canvas");
    let w = img2.width, h = img2.height;
    if (w > M || h > M) { if (w > h) { h = Math.round(h * M / w); w = M; } else { w = Math.round(w * M / h); h = M; } }
    c.width = w; c.height = h; c.getContext("2d").drawImage(img2, 0, 0, w, h);
    URL.revokeObjectURL(url);
    callback(c.toDataURL("image/jpeg", .72));
  };
  img2.src = url;
}
function addImgSlot() {
  if (imgs.length >= 5) return;
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = e => { const f = e.target.files[0]; if (!f) return;
    compressAndPush(f, data => { imgs.push(data); saveImgsIndividually(); renderImgSlots(); });
  }; inp.click();
}
function replaceImg(i, input) {
  const f = input.files[0]; if (!f) return;
  compressAndPush(f, data => { imgs[i] = data; saveImgsIndividually(); renderImgSlots(); });
}
function removeImg(i) { imgs.splice(i, 1); saveImgsIndividually(); renderImgSlots(); }

// ══════════════════════════════════════════════════════
//  設問カスタマイズ
// ══════════════════════════════════════════════════════
let currentQKey = null;

function getQOpts(key) { return lsGet("af_q_" + key, O[key] || []); }
function setQOpts(key, arr) { lsSet("af_q_" + key, arr); O[key] = [...arr]; }

function openQEditor(key, title) {
  currentQKey = key;
  document.getElementById("q-editor-area").style.display = "block";
  document.getElementById("q-editor-title").textContent = title + " の選択肢";
  renderQEditorList(key);
}
function renderQEditorList(key) {
  const opts = getQOpts(key);
  document.getElementById("q-editor-list").innerHTML = opts.map((opt, i) =>
    '<div style="display:flex;align-items:center;gap:6px;background:var(--s2);border:1px solid var(--br);border-radius:6px;padding:6px 9px">' +
      '<span style="flex:1;font-size:11px">' + opt + '</span>' +
      '<button style="background:none;border:none;color:var(--dim);font-size:13px;cursor:pointer" onclick="removeQOption(' + i + ')">✕</button>' +
    '</div>'
  ).join("");
}
function addQOption() {
  if (!currentQKey) return;
  const inp = document.getElementById("q-new-opt");
  const val = inp.value.trim();
  if (!val) return;
  const opts = getQOpts(currentQKey);
  const last = opts[opts.length - 1];
  if (last === "その他" || last === "なし") {
    opts.splice(opts.length - 1, 0, val);
  } else {
    opts.push(val);
  }
  setQOpts(currentQKey, opts);
  inp.value = "";
  renderQEditorList(currentQKey);
  initFormChips();
}
function removeQOption(i) {
  if (!currentQKey) return;
  const opts = getQOpts(currentQKey);
  if (opts.length <= 1) { alert("最低1つ必要です"); return; }
  opts.splice(i, 1);
  setQOpts(currentQKey, opts);
  renderQEditorList(currentQKey);
  initFormChips();
}

function restoreCustomOpts() {
  const keys = ["time","action","monster","body","trigger","before","need","habit","ending","music","after","next"];
  keys.forEach(k => {
    const saved = lsGet("af_q_" + k, null);
    if (saved && Array.isArray(saved) && saved.length > 0) O[k] = [...saved];
  });
}

// ══════════════════════════════════════════════════════
//  SPREADSHEET — 起動時に固定スプシから自動取得
// ══════════════════════════════════════════════════════
async function loadFromSheet() {
  const base = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:csv&sheet=";
  const parse = txt => txt.split("\n").map(l => l.replace(/^"|"$/g, "").trim()).filter(Boolean);
  const info = document.getElementById("sync-info-box");
  try {
    const [pr, lo] = await Promise.all([
      fetch(base + encodeURIComponent("褒め言葉")).then(r => r.ok ? r.text() : null).catch(() => null),
      fetch(base + encodeURIComponent("失うもの")).then(r => r.ok ? r.text() : null).catch(() => null),
    ]);
    let ok = false;
    if (pr) { const p = parse(pr); if (p.length > 0) { praises = p; lsSet("af_praises", praises); ok = true; } }
    if (lo) { const l = parse(lo); if (l.length > 0) { loses = l; lsSet("af_loses", loses); ok = true; } }
    const dot = document.getElementById("sync-dot");
    if (ok) {
      renderHomeLoses();
      if (info) info.innerHTML = '<span style="color:var(--grn)">✓ 同期完了 — 褒め言葉 ' + praises.length + '件・失うもの ' + loses.length + '件</span>';
      if (dot) dot.style.background = "var(--grn)";
    } else {
      if (info) info.innerHTML = '<span style="color:var(--ora)">⚠ 未取得 — オフラインまたはスプシの公開設定を確認</span>';
      if (dot) dot.style.background = "var(--ora)";
    }
  } catch (e) {
    const info2 = document.getElementById("sync-info-box");
    if (info2) info2.innerHTML = '<span style="color:var(--ora)">⚠ 取得失敗（ネットワークエラー）</span>';
    const dot2 = document.getElementById("sync-dot");
    if (dot2) dot2.style.background = "var(--ora)";
  }
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
restoreCustomOpts();

if (wins.length === 0 && logs.length > 0) {
  wins = logs.filter(l => !l.reacted).map(l => ({
    id: l.id, date: l.date,
    pts: WIN_BASE_PTS + calcBonus(l.intensity || 7),
    logId: l.id
  }));
  lsSet("af_wins", wins);
}

initFormChips();
renderHomeLoses();
updateHeader();
renderImgSlots();
updatePtsPreview();
loadFromSheet();
