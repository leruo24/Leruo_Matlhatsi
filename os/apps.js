/* Extra LeruOS apps: XP-style sounds, My Computer, My Documents, Recycle Bin, Paint, Solitaire,
 * a music player and a command prompt. Registered into os.js through window.LeruApps(api).
 * All sounds and music are synthesised here (original, no recordings). */
(function () {
  "use strict";

  /* ======================= sounds ======================= */
  const SFX = (() => {
    let ctx = null, master = null, muted = false;
    try { muted = localStorage.getItem("lm-sound") === "off"; } catch {}
    const get = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    };
    const tone = (f, t0, dur, { type = "sine", gain = 0.06, attack = 0.02, out } = {}) => {
      const c = get(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(out || master); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    const pad = (freqs, t0, dur, gain) => freqs.forEach((f, i) => { tone(f, t0 + i * 0.09, dur, { type: "triangle", gain, attack: 0.25 }); tone(f * 2.004, t0 + i * 0.09, dur * 0.8, { gain: gain * 0.35, attack: 0.3 }); });
    return {
      get ctx() { return get(); },
      get master() { get(); return master; },
      setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); },
      // warm swelling chord, then a rising sparkle: an original take on the XP "welcome" feel
      startup() { const c = get(); if (!c) return; const t = c.currentTime + 0.05; pad([155.6, 233.1, 311.1, 392.0], t, 3.2, 0.03); [622.3, 784, 932.3, 1244.5].forEach((f, i) => tone(f, t + 0.9 + i * 0.16, 1.6, { gain: 0.025, attack: 0.01 })); },
      logoff() { const c = get(); if (!c) return; const t = c.currentTime + 0.02; [784, 622.3, 466.2, 311.1].forEach((f, i) => tone(f, t + i * 0.14, 1.0, { type: "triangle", gain: 0.035 })); },
      error() { const c = get(); if (!c) return; const t = c.currentTime; tone(659.3, t, 0.35, { type: "triangle", gain: 0.06, attack: 0.005 }); tone(523.3, t + 0.12, 0.5, { type: "triangle", gain: 0.05, attack: 0.005 }); },
      notify() { const c = get(); if (!c) return; const t = c.currentTime; tone(880, t, 0.25, { gain: 0.04, attack: 0.005 }); tone(1318.5, t + 0.09, 0.35, { gain: 0.035, attack: 0.005 }); },
      open() { const c = get(); if (!c) return; tone(1200, c.currentTime, 0.06, { gain: 0.02, attack: 0.002 }); },
      crumple() {
        const c = get(); if (!c) return; const t = c.currentTime;
        for (let i = 0; i < 9; i++) {
          const n = c.createBufferSource(), len = c.sampleRate * 0.05, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
          for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
          n.buffer = b; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2000 + Math.random() * 3000; f.Q.value = 0.8;
          const g = c.createGain(); g.gain.value = 0.12; n.connect(f).connect(g).connect(master); n.start(t + i * 0.035 + Math.random() * 0.02);
        }
      },
    };
  })();
  window.LeruSFX = SFX;
  window.addEventListener("message", (e) => { const m = e.data; if (m && m.type === "host" && m.action === "mute") SFX.setMuted(!m.on); });

  window.LeruApps = function (api) {
    const { openWindow, ICONS, APPS, P, esc, $ } = api;
    const coarse = matchMedia("(pointer: coarse)").matches;

    /* ======================= icons ======================= */
    Object.assign(ICONS, {
      mycomputer: `<svg viewBox="0 0 32 32"><rect x="4" y="3" width="24" height="17" rx="1.5" fill="#cfd8e6" stroke="#38465c"/><rect x="6.5" y="5.5" width="19" height="12" fill="#2f6fd6"/><path d="M6.5 15l5-4 4 3 4-5 6 6v2.5h-19z" fill="#5fbf4a"/><rect x="12" y="20" width="8" height="3" fill="#a9b4c4" stroke="#38465c"/><rect x="7" y="23" width="18" height="5" rx="1" fill="#dfe4ec" stroke="#38465c"/><rect x="20" y="25" width="3" height="1.4" fill="#4caf50"/></svg>`,
      mydocs: `<svg viewBox="0 0 32 32"><path d="M2 8h10l3 3h15v17H2z" fill="#e8b93a" stroke="#6b4e0e"/><rect x="9" y="5" width="14" height="17" fill="#fff" stroke="#777" transform="rotate(6 16 13)"/><path d="M2 13h28v15H2z" fill="#f6d36b" stroke="#6b4e0e"/></svg>`,
      recycle: `<svg viewBox="0 0 32 32"><path d="M8 9h16l-2 19H10z" fill="#d9e6f2" stroke="#3d5a73"/><rect x="6" y="6" width="20" height="3" rx="1" fill="#b9cde0" stroke="#3d5a73"/><path d="M13 13l-1 12M16 13v12M19 13l1 12" stroke="#7d98b0"/><path d="M12 17l2-3 2 3M20 20l-2 3-2-3" fill="none" stroke="#2f8f4e" stroke-width="1.6"/></svg>`,
      paint: `<svg viewBox="0 0 32 32"><path d="M5 22c0-9 6-16 14-16 6 0 9 3 9 7 0 3-3 3-5 3s-3 2-1 4-1 5-6 5c-7 0-11-1-11-3z" fill="#f4f1ea" stroke="#5a5242"/><circle cx="11" cy="15" r="2" fill="#e53935"/><circle cx="15" cy="11" r="2" fill="#fbc02d"/><circle cx="20" cy="10" r="2" fill="#43a047"/><circle cx="11" cy="21" r="2" fill="#1e88e5"/><path d="M27 3l-9 13 2 1z" fill="#8d6e63" stroke="#4e342e"/></svg>`,
      cards: `<svg viewBox="0 0 32 32"><rect x="5" y="5" width="15" height="21" rx="2" fill="#1f5fb8" stroke="#123" transform="rotate(-12 12 15)"/><rect x="12" y="6" width="15" height="21" rx="2" fill="#fff" stroke="#333"/><text x="19.5" y="21" font-size="11" font-family="Georgia" fill="#c62828" text-anchor="middle">♥</text><text x="15" y="12" font-size="5" font-family="Arial" fill="#c62828">A</text></svg>`,
      music: `<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="3" fill="#2d3748" stroke="#111"/><rect x="6" y="8" width="20" height="8" fill="#0b1a12"/><path d="M8 15v-3M11 15v-6M14 15v-4M17 15v-5M20 15v-2M23 15v-4" stroke="#7ee08a" stroke-width="1.6"/><circle cx="11" cy="22" r="2.4" fill="#9aa5b8"/><circle cx="21" cy="22" r="2.4" fill="#9aa5b8"/></svg>`,
      terminal: `<svg viewBox="0 0 32 32"><rect x="2" y="5" width="28" height="22" rx="1.5" fill="#000" stroke="#555"/><rect x="2" y="5" width="28" height="4" fill="#2f5fc4"/><path d="M6 14l4 3-4 3" fill="none" stroke="#c0c0c0" stroke-width="1.6"/><path d="M12 21h8" stroke="#c0c0c0" stroke-width="1.6"/></svg>`,
      drive: `<svg viewBox="0 0 32 32"><rect x="3" y="11" width="26" height="12" rx="2" fill="#dfe4ec" stroke="#38465c"/><rect x="5" y="19" width="22" height="2" fill="#a9b4c4"/><rect x="22" y="14" width="4" height="2" fill="#4caf50"/></svg>`,
      folder: `<svg viewBox="0 0 32 32"><path d="M2 8h10l3 3h15v17H2z" fill="#e8b93a" stroke="#6b4e0e"/><path d="M2 13h28v15H2z" fill="#f6d36b" stroke="#6b4e0e"/></svg>`,
      file: `<svg viewBox="0 0 32 32"><path d="M8 3h11l6 6v20H8z" fill="#fff" stroke="#555"/><path d="M19 3v6h6" fill="#ddd" stroke="#555"/><path d="M11 14h11M11 17h11M11 20h8" stroke="#aaa"/></svg>`,
    });

    /* ===== a small XP explorer window (for My Computer / My Documents / Recycle Bin) ===== */
    function explorer(id, title, icon, items, { side = [], bin = false } = {}) {
      SFX.open();
      openWindow(id, {
        title, icon, width: 620, height: 420, menubar: true,
        status: `${items.length} object${items.length === 1 ? "" : "s"}`,
        render: (body) => {
          body.innerHTML = `<div class="gal xp-ex"><aside class="gal-side">${side.map((b) => `<div class="gs-box"><div class="gs-h">${esc(b.h)}</div>${b.items.map((x, i) => `<button data-s="${esc(b.h)}|${i}">${ICONS[x.icon] || ""} ${esc(x.label)}</button>`).join("")}</div>`).join("")}</aside>
            <section class="gal-main"><div class="ex-grid">${items.map((it, i) => `<button class="ex-item" data-i="${i}">${ICONS[it.icon] || ICONS.file}<span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>`).join("")}</div></section></div>`;
          body.querySelectorAll("[data-i]").forEach((b) => {
            const it = items[+b.dataset.i];
            const go = () => (it.open ? it.open() : SFX.error());
            b.addEventListener("click", () => { body.querySelectorAll(".ex-item").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); if (coarse) go(); });
            b.addEventListener("dblclick", go);
          });
          body.querySelectorAll("[data-s]").forEach((b) => {
            const [h, i] = b.dataset.s.split("|");
            b.addEventListener("click", () => side.find((x) => x.h === h).items[+i].open());
          });
        },
      });
    }
    const say = (title, msg, icon = "help") => {
      SFX.error();
      openWindow("msg" + Date.now(), {
        title, icon, width: 360, height: 170,
        render: (body, el) => {
          body.innerHTML = `<div class="msgbox">${ICONS[icon]}<p>${esc(msg)}</p><button class="xbtn">OK</button></div>`;
          $(".xbtn", body).addEventListener("click", () => $(".close", el).click());
        },
      });
    };

    const myDocs = () => explorer("mydocs", "My Documents", "mydocs", [
      { icon: "folder", label: "Projects", open: APPS.projects },
      { icon: "resume", label: "Resume.pdf", open: APPS.resume },
      { icon: "readme", label: "Read Me.txt", open: APPS.readme },
      { icon: "music", label: "My Music", open: openMusic },
    ], { side: [{ h: "File and Folder Tasks", items: [{ icon: "folder", label: "Open Portfolio", open: APPS.portfolio }, { icon: "contact", label: "E-mail me", open: APPS.contact }] }, { h: "Other Places", items: [{ icon: "mycomputer", label: "My Computer", open: myComputer }, { icon: "recycle", label: "Recycle Bin", open: recycle }] }] });

    const myComputer = () => explorer("mycomputer", "My Computer", "mycomputer", [
      { icon: "drive", label: "Local Disk (C:)", sub: "Projects & experience", open: APPS.portfolio },
      { icon: "mydocs", label: "My Documents", open: myDocs },
      { icon: "drive", label: "Games (D:)", sub: "Overland Run, Solitaire…", open: () => explorer("games", "Games (D:)", "drive", [
        { icon: "game", label: "Overland Run", open: APPS.game }, { icon: "cards", label: "Solitaire", open: openSolitaire }, { icon: "mines", label: "Minesweeper", open: APPS.mines },
      ]) },
      { icon: "showcase", label: "LinkedIn", sub: "Network drive", open: () => window.open(P.contact.linkedin, "_blank", "noopener") },
      { icon: "showcase", label: "GitHub", sub: "Network drive", open: () => window.open(P.contact.github, "_blank", "noopener") },
    ], { side: [{ h: "System Tasks", items: [{ icon: "help", label: "View system information", open: () => say("System Properties", `LeruOS XP · Portfolio Edition\nRegistered to: ${P.name}\nProcessor: curiosity @ 100%\nMemory: always learning`, "mycomputer") }, { icon: "help", label: "How this works", open: APPS.help }] }, { h: "Other Places", items: [{ icon: "mydocs", label: "My Documents", open: myDocs }, { icon: "recycle", label: "Recycle Bin", open: recycle }] }] });

    const BIN = [
      { icon: "file", label: "cv_final_FINAL_v3.docx", note: "Replaced by the real CV. It had Comic Sans in it." },
      { icon: "file", label: "bug_free_code.js", note: "This file never existed." },
      { icon: "file", label: "excuses_for_late_assignment.txt", note: "Deleted. Deadlines are met now." },
      { icon: "file", label: "plan_B.txt", note: "Didn't need it. Plan A is going fine." },
    ];
    function recycle() {
      explorer("recycle", "Recycle Bin", "recycle", BIN.map((b) => ({ ...b, open: () => say(b.label, b.note, "recycle") })), {
        side: [{ h: "Recycle Bin Tasks", items: [{ icon: "recycle", label: "Empty the Recycle Bin", open: () => { SFX.crumple(); say("Recycle Bin", "Nice try. Some things are worth keeping for the laughs.", "recycle"); } }] }],
      });
    }

    /* ======================= Paint ======================= */
    function openPaint() {
      SFX.open();
      openWindow("paint", {
        title: "untitled — Paint", icon: "paint", width: 860, height: 600, menubar: true,
        render: (body) => {
          const COLORS = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
            "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"];
          const UI = window.UI_ICONS || {};
          const TOOLS = [["pencil", "Pencil"], ["brush", "Brush"], ["spray", "Airbrush"], ["eraser", "Eraser"], ["fill", "Fill"], ["line", "Line"], ["rect", "Rectangle"], ["ellipse", "Ellipse"]];
          body.innerHTML = `<div class="paint">
              <div class="pt-tools">${TOOLS.map(([k, n]) => `<button data-t="${k}" title="${n}" aria-label="${n}" class="${k === "brush" ? "on" : ""}">${UI[k] || n[0]}</button>`).join("")}
                <div class="pt-sizes">${[2, 5, 10, 18].map((s) => `<button data-s="${s}" class="${s === 5 ? "on" : ""}"><i style="width:${Math.min(16, s)}px;height:${Math.min(16, s)}px"></i></button>`).join("")}</div></div>
              <div class="pt-canvaswrap"><canvas class="pt-canvas"></canvas></div>
              <div class="pt-bottom"><div class="pt-cur"><i class="c1"></i><i class="c2"></i></div><div class="pt-pal">${COLORS.map((c) => `<button style="background:${c}" data-c="${c}"></button>`).join("")}</div>
                <div class="pt-act"><button class="xbtn" data-a="clear">Clear</button><button class="xbtn" data-a="save">Save as PNG</button></div></div></div>`;
          const cv = $(".pt-canvas", body), wrap = $(".pt-canvaswrap", body), g = cv.getContext("2d");
          cv.width = 760; cv.height = 440; g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
          let tool = "brush", size = 5, c1 = "#000000", c2 = "#ffffff", drawing = false, start = null, snap = null, last = null, sprayT = null;
          const paintCols = () => { $(".c1", body).style.background = c1; $(".c2", body).style.background = c2; };
          paintCols();
          const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
          const colOf = (e) => (e.button === 2 ? c2 : c1);
          function flood(x, y, hex) {
            x |= 0; y |= 0;
            const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
            const i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
            const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            if (tr === r && tg === gg && tb === b) return;
            const same = (i) => Math.abs(d[i] - tr) < 24 && Math.abs(d[i + 1] - tg) < 24 && Math.abs(d[i + 2] - tb) < 24;
            const st = [[x, y]];
            while (st.length) {
              const [px, py] = st.pop(); let lx = px;
              while (lx >= 0 && same((py * W + lx) * 4)) lx--;
              lx++; let up = false, dn = false;
              for (let cx = lx; cx < W && same((py * W + cx) * 4); cx++) {
                const i = (py * W + cx) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
                if (py > 0) { const u = same(((py - 1) * W + cx) * 4); if (u && !up) st.push([cx, py - 1]); up = u; }
                if (py < H - 1) { const v = same(((py + 1) * W + cx) * 4); if (v && !dn) st.push([cx, py + 1]); dn = v; }
              }
            }
            g.putImageData(img, 0, 0);
          }
          cv.addEventListener("contextmenu", (e) => e.preventDefault());
          cv.addEventListener("pointerdown", (e) => {
            cv.setPointerCapture(e.pointerId); drawing = true; const [x, y] = pos(e); start = last = [x, y]; const col = colOf(e);
            g.strokeStyle = g.fillStyle = tool === "eraser" ? c2 : col; g.lineCap = g.lineJoin = "round";
            g.lineWidth = tool === "pencil" ? 1 : tool === "eraser" ? size * 2.2 : size;
            if (tool === "fill") { flood(x, y, col); drawing = false; return; }
            if (["line", "rect", "ellipse"].includes(tool)) snap = g.getImageData(0, 0, cv.width, cv.height);
            if (tool === "spray") sprayT = setInterval(() => { for (let k = 0; k < size * 3; k++) { const a = Math.random() * 6.283, rr = Math.random() * size * 2.4; g.fillRect(last[0] + Math.cos(a) * rr, last[1] + Math.sin(a) * rr, 1, 1); } }, 16);
            if (["pencil", "brush", "eraser"].includes(tool)) { g.beginPath(); g.arc(x, y, g.lineWidth / 2, 0, 7); g.fill(); }
          });
          cv.addEventListener("pointermove", (e) => {
            if (!drawing) return; const [x, y] = pos(e);
            if (["pencil", "brush", "eraser"].includes(tool)) { g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(x, y); g.stroke(); }
            else if (snap) {
              g.putImageData(snap, 0, 0); g.beginPath();
              if (tool === "line") { g.moveTo(start[0], start[1]); g.lineTo(x, y); }
              if (tool === "rect") g.rect(start[0], start[1], x - start[0], y - start[1]);
              if (tool === "ellipse") g.ellipse((start[0] + x) / 2, (start[1] + y) / 2, Math.abs(x - start[0]) / 2, Math.abs(y - start[1]) / 2, 0, 0, 7);
              g.stroke();
            }
            last = [x, y];
          });
          const end = () => { drawing = false; snap = null; clearInterval(sprayT); };
          cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
          body.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { tool = b.dataset.t; body.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("on", x === b)); }));
          body.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { size = +b.dataset.s; body.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b)); }));
          body.querySelectorAll("[data-c]").forEach((b) => { b.addEventListener("click", () => { c1 = b.dataset.c; paintCols(); }); b.addEventListener("contextmenu", (e) => { e.preventDefault(); c2 = b.dataset.c; paintCols(); }); });
          $('[data-a="clear"]', body).addEventListener("click", () => { g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); });
          $('[data-a="save"]', body).addEventListener("click", () => { const a = document.createElement("a"); a.download = "my-masterpiece.png"; a.href = cv.toDataURL("image/png"); a.click(); });
          wrap.scrollTop = 0;
        },
      });
    }

    /* ======================= Solitaire (Klondike, draw one) ======================= */
    function openSolitaire() {
      SFX.open();
      openWindow("solitaire", {
        title: "Solitaire", icon: "cards", width: 760, height: 560, menubar: true,
        render: (body) => {
          body.innerHTML = `<div class="sol"><div class="sol-bar"><button class="xbtn" data-a="new">New game</button><span class="sol-score">Score: 0</span><span class="sol-moves">Moves: 0</span></div><div class="sol-table"></div></div>`;
          const table = $(".sol-table", body);
          const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
          let S, sel = null, score = 0, moves = 0;
          const red = (c) => c.s === 1 || c.s === 2;
          function deal() {
            const deck = [];
            for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r, up: false });
            for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
            S = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []] };
            for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) { const c = deck.pop(); c.up = j === i; S.tab[i].push(c); }
            S.stock = deck; sel = null; score = 0; moves = 0; draw();
          }
          const canFound = (c, f) => (f.length ? f[f.length - 1].s === c.s && f[f.length - 1].r === c.r - 1 : c.r === 0);
          const canTab = (c, t) => (t.length ? t[t.length - 1].up && red(t[t.length - 1]) !== red(c) && t[t.length - 1].r === c.r + 1 : c.r === 12);
          function take(src) { // src: {pile, i}
            if (src.pile === "waste") return [S.waste.pop()];
            if (src.pile.startsWith("f")) return [S.found[+src.pile[1]].pop()];
            const t = S.tab[+src.pile[1]]; return t.splice(src.i);
          }
          function cardsAt(src) {
            if (src.pile === "waste") return S.waste.length ? [S.waste[S.waste.length - 1]] : [];
            if (src.pile.startsWith("f")) { const f = S.found[+src.pile[1]]; return f.length ? [f[f.length - 1]] : []; }
            return S.tab[+src.pile[1]].slice(src.i);
          }
          function flipTops() { S.tab.forEach((t) => { if (t.length && !t[t.length - 1].up) { t[t.length - 1].up = true; score += 5; } }); }
          function tryMove(src, dst) {
            const cs = cardsAt(src); if (!cs.length) return false;
            if (dst.startsWith("f")) { const f = S.found[+dst[1]]; if (cs.length !== 1 || !canFound(cs[0], f)) return false; take(src); f.push(cs[0]); score += 10; }
            else { const t = S.tab[+dst[1]]; if (!canTab(cs[0], t)) return false; take(src); t.push(...cs); if (src.pile === "waste") score += 5; }
            moves++; flipTops(); return true;
          }
          function autoFound(src) { for (let k = 0; k < 4; k++) if (tryMove(src, "f" + k)) return true; return false; }
          function click(pile, i) {
            if (pile === "stock") {
              if (S.stock.length) { const c = S.stock.pop(); c.up = true; S.waste.push(c); }
              else { S.stock = S.waste.reverse().map((c) => ({ ...c, up: false })); S.waste = []; score = Math.max(0, score - 20); }
              sel = null; moves++; return draw();
            }
            if (sel) {
              const dst = pile.startsWith("f") || pile.startsWith("t") ? pile : null;
              const ok = dst && !(sel.pile === pile) && tryMove(sel, dst);
              if (!ok && dst && sel.pile !== pile) SFX.error();
              sel = null; draw(); return;
            }
            const src = { pile, i };
            const cs = cardsAt(src);
            if (!cs.length || !cs[0].up) return;
            sel = src; draw();
          }
          function cardHTML(c, extra = "") {
            if (!c.up) return `<div class="card back" ${extra}></div>`;
            return `<div class="card ${red(c) ? "red" : ""}" ${extra}><b>${RANKS[c.r]}<i>${SUITS[c.s]}</i></b><span>${SUITS[c.s]}</span><b class="br">${RANKS[c.r]}<i>${SUITS[c.s]}</i></b></div>`;
          }
          function draw() {
            const W = table.clientWidth || 700, cw = Math.min(86, (W - 8 * 10) / 7), ch = cw * 1.4;
            table.style.setProperty("--cw", cw + "px"); table.style.setProperty("--ch", ch + "px");
            const col = (i) => 10 + i * (cw + 10);
            let h = `<div class="slot" style="left:${col(0)}px;top:10px" data-p="stock">${S.stock.length ? `<div class="card back"></div>` : `<div class="recyc">↻</div>`}</div>`;
            h += `<div class="slot" style="left:${col(1)}px;top:10px" data-p="waste">${S.waste.length ? cardHTML(S.waste[S.waste.length - 1], sel && sel.pile === "waste" ? 'data-sel="1"' : "") : ""}</div>`;
            for (let k = 0; k < 4; k++) { const f = S.found[k]; h += `<div class="slot found" style="left:${col(3 + k)}px;top:10px" data-p="f${k}">${f.length ? cardHTML(f[f.length - 1]) : `<span class="fs">${SUITS[k]}</span>`}</div>`; }
            for (let t = 0; t < 7; t++) {
              h += `<div class="slot" style="left:${col(t)}px;top:${ch + 26}px" data-p="t${t}"></div>`;
              let y = ch + 26;
              S.tab[t].forEach((c, i) => {
                const isSel = sel && sel.pile === "t" + t && i >= sel.i;
                h += `<div class="pos" style="left:${col(t)}px;top:${y}px;z-index:${i + 2}" data-p="t${t}" data-i="${i}">${cardHTML(c, isSel ? 'data-sel="1"' : "")}</div>`;
                y += c.up ? ch * 0.26 : ch * 0.12;
              });
            }
            table.innerHTML = h;
            $(".sol-score", body).textContent = "Score: " + score; $(".sol-moves", body).textContent = "Moves: " + moves;
            if (S.found.every((f) => f.length === 13)) { SFX.startup(); table.insertAdjacentHTML("beforeend", `<div class="sol-win">You win!<br><button class="xbtn">Deal again</button></div>`); $(".sol-win .xbtn", table).onclick = deal; }
          }
          table.addEventListener("click", (e) => {
            const el = e.target.closest("[data-p]"); if (!el) { sel = null; return draw(); }
            click(el.dataset.p, el.dataset.i != null ? +el.dataset.i : el.dataset.p === "waste" ? 0 : undefined);
          });
          table.addEventListener("dblclick", (e) => {
            const el = e.target.closest("[data-p]"); if (!el) return;
            const p = el.dataset.p; sel = null;
            if (p === "waste" || (p.startsWith("t") && el.dataset.i != null && +el.dataset.i === S.tab[+p[1]].length - 1)) { if (autoFound({ pile: p, i: el.dataset.i != null ? +el.dataset.i : 0 })) draw(); }
          });
          $('[data-a="new"]', body).addEventListener("click", deal);
          new ResizeObserver(() => S && draw()).observe(table);
          deal();
        },
      });
    }

    /* ======================= Music player (three original, generated tracks) ======================= */
    let music = null;
    function openMusic() {
      SFX.open();
      const TRACKS = [
        { name: "Golden Hour", bpm: 78, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], bass: [45, 41, 43, 40], feel: "lofi" },
        { name: "Dust Road", bpm: 104, prog: [[50, 54, 57, 61], [55, 59, 62, 66], [52, 55, 59, 62], [57, 61, 64, 67]], bass: [38, 43, 40, 45], feel: "drive" },
        { name: "Pond at Dusk", bpm: 64, prog: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], bass: [36, 33, 29, 31], feel: "ambient" },
      ];
      const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
      openWindow("music", {
        title: "LeruAmp", icon: "music", width: 380, height: 330,
        render: (body, el) => {
          body.innerHTML = `<div class="amp"><div class="amp-screen"><div class="amp-title">—</div><div class="amp-time">0:00</div><canvas class="amp-vis" width="320" height="60"></canvas></div>
            <div class="amp-ctrl"><button data-a="prev">⏮</button><button data-a="play">▶</button><button data-a="next">⏭</button><input type="range" min="0" max="100" value="70" aria-label="Volume"></div>
            <ol class="amp-list">${TRACKS.map((t, i) => `<li data-i="${i}">${esc(t.name)} <small>${t.bpm} bpm · original</small></li>`).join("")}</ol></div>`;
          const ctx = SFX.ctx; if (!ctx) return;
          if (!music) {
            const out = ctx.createGain(); out.gain.value = 0.7;
            const an = ctx.createAnalyser(); an.fftSize = 128;
            const comp = ctx.createDynamicsCompressor(); out.connect(comp).connect(an).connect(SFX.master);
            const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
            music = { out, an, noise, playing: false, track: 0, step: 0, next: 0, timer: null, start: 0 };
          }
          const M = music;
          const note = (f, t, dur, type, gain, cutoff = 2400) => {
            const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
            o.type = type; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = cutoff;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(lp).connect(g).connect(M.out); o.start(t); o.stop(t + dur + 0.05);
          };
          const hit = (t, kind) => {
            if (kind === "kick") { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g).connect(M.out); o.start(t); o.stop(t + 0.32); return; }
            const n = ctx.createBufferSource(); n.buffer = M.noise; const f = ctx.createBiquadFilter(); const g = ctx.createGain();
            f.type = kind === "hat" ? "highpass" : "bandpass"; f.frequency.value = kind === "hat" ? 7000 : 1800; f.Q.value = 0.8;
            g.gain.setValueAtTime(kind === "hat" ? 0.05 : 0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "hat" ? 0.05 : 0.18));
            n.connect(f).connect(g).connect(M.out); n.start(t, Math.random() * 0.5, 0.25);
          };
          function schedule() {
            const T = TRACKS[M.track], q = 60 / T.bpm / 2; // eighth notes
            while (M.next < ctx.currentTime + 0.25) {
              const s = M.step, bar = Math.floor(s / 8) % 4, b8 = s % 8, t = M.next;
              const ch = T.prog[bar];
              if (b8 === 0) ch.forEach((m) => note(hz(m), t, q * 8, T.feel === "drive" ? "sawtooth" : "triangle", T.feel === "ambient" ? 0.035 : 0.025, T.feel === "drive" ? 1500 : 1100));
              if (T.feel !== "ambient" && (b8 === 0 || b8 === 3 || b8 === 5)) note(hz(T.bass[bar]), t, q * 1.8, "sine", 0.12, 600);
              if (T.feel === "ambient" && b8 === 0) note(hz(T.bass[bar]), t, q * 8, "sine", 0.08, 500);
              // a little melody from the chord tones
              if ((T.feel === "lofi" && (b8 === 2 || b8 === 6)) || (T.feel === "drive" && b8 % 2 === 1) || (T.feel === "ambient" && b8 === 4)) note(hz(ch[(s * 7 + bar) % 4] + 12), t, q * (T.feel === "ambient" ? 6 : 1.6), "sine", 0.04, 3000);
              if (T.feel !== "ambient") { if (b8 % 4 === 0) hit(t, "kick"); if (b8 === 4) hit(t, "snare"); hit(t, "hat"); }
              M.step++; M.next += T.feel === "lofi" && b8 % 2 === 0 ? q * 1.12 : T.feel === "lofi" ? q * 0.88 : q; // lofi swing
            }
          }
          const ui = () => {
            $(".amp-title", body).textContent = `${M.track + 1}. ${TRACKS[M.track].name}`;
            $('[data-a="play"]', body).textContent = M.playing ? "⏸" : "▶";
            body.querySelectorAll(".amp-list li").forEach((li, i) => li.classList.toggle("on", i === M.track));
          };
          const play = () => { if (M.playing) return; M.playing = true; M.next = ctx.currentTime + 0.05; M.step = 0; M.start = ctx.currentTime; M.timer = setInterval(schedule, 60); ui(); };
          const stop = () => { M.playing = false; clearInterval(M.timer); ui(); };
          const go = (i) => { stop(); M.track = (i + TRACKS.length) % TRACKS.length; play(); };
          $('[data-a="play"]', body).onclick = () => (M.playing ? stop() : play());
          $('[data-a="next"]', body).onclick = () => go(M.track + 1);
          $('[data-a="prev"]', body).onclick = () => go(M.track - 1);
          $("input", body).oninput = (e) => (M.out.gain.value = e.target.value / 100);
          body.querySelectorAll(".amp-list li").forEach((li) => (li.ondblclick = li.onclick = () => go(+li.dataset.i)));
          const vis = $(".amp-vis", body), vg = vis.getContext("2d"), data = new Uint8Array(M.an.frequencyBinCount);
          (function loop() {
            if (!vis.isConnected) return;
            requestAnimationFrame(loop);
            M.an.getByteFrequencyData(data);
            vg.fillStyle = "#04140c"; vg.fillRect(0, 0, 320, 60);
            for (let i = 0; i < 32; i++) { const v = data[i] / 255, hgt = v * 56; vg.fillStyle = v > 0.7 ? "#e8e45a" : "#55d66b"; vg.fillRect(i * 10, 60 - hgt, 8, hgt); }
            const s = M.playing ? Math.floor(ctx.currentTime - M.start) : 0;
            $(".amp-time", body).textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
          })();
          // closing the window stops the music
          $(".close", el).addEventListener("click", stop);
          ui();
        },
      });
    }

    /* ======================= Command Prompt ======================= */
    function openTerminal() {
      SFX.open();
      openWindow("terminal", {
        title: "C:\\WINDOWS\\system32\\cmd.exe", icon: "terminal", width: 640, height: 400,
        render: (body) => {
          body.innerHTML = `<div class="term" tabindex="0"><div class="term-out"></div><div class="term-line"><span class="term-ps">C:\\Users\\${esc(P.shortName)}&gt;</span><input class="term-in" spellcheck="false" autocomplete="off" aria-label="Command"></div></div>`;
          const out = $(".term-out", body), inp = $(".term-in", body), term = $(".term", body);
          const hist = []; let hi = 0;
          const print = (s = "", cls = "") => { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = s; out.appendChild(d); term.scrollTop = term.scrollHeight; };
          const CMDS = {
            help: () => ["Commands:", "  whoami      who's using this computer", "  about       a short bio", "  skills      what I work with", "  projects    things I've built", "  experience  where I've worked", "  contact     how to reach me", "  open <app>  portfolio, resume, paint, solitaire, music, game, mines", "  neofetch    system info", "  dogs        meet the crew", "  date, ls, cat readme.txt, echo <text>, color <0-9>, matrix, clear, exit"].forEach((l) => print(l)),
            whoami: () => print(`${P.name.toLowerCase().replace(" ", "\\")} — ${P.title}`),
            about: () => [].concat(P.about && P.about.paragraphs ? P.about.paragraphs : [P.tagline]).forEach((l) => print(String(l))),
            skills: () => (P.skills || []).forEach((g) => print(`${g.group.padEnd(14)} ${g.items.join(", ")}`)),
            projects: () => (P.projects || []).forEach((p) => print(`${(p.year || "").padEnd(6)}${p.name} — ${p.subtitle || ""}`)),
            experience: () => (P.experience || []).forEach((x) => print(`• ${x.role}, ${x.org}`)),
            contact: () => { print(`email     ${P.contact.email}`); print(`linkedin  ${P.contact.linkedin}`); print(`github    ${P.contact.github}`); },
            neofetch: () => ["        _.._        " + P.name, "      .' .-'`       ------------------", "     /  /           OS: LeruOS XP (Portfolio Edition)", "     |  |           Host: the workshop, golden hour", "     \\  '.___.;     Shell: curiosity", "      '._  _.'      Uptime: always learning", "         ``         Pets: 3 dogs", "                    Vehicle: Land Cruiser"].forEach((l) => print(l, "term-acc")),
            dogs: () => { print("  /^ ^\\     /^ ^\\     /^ ^\\"); print(" / 0 0 \\   / 0 0 \\   / 0 0 \\"); print(" V\\ Y /V   V\\ Y /V   V\\ Y /V"); print("   / - \\     / - \\     / - \\"); print("Three good dogs. They supervise every build."); },
            date: () => print(new Date().toString()),
            ls: () => print("Desktop  Documents  Projects  Resume.pdf  readme.txt  dogs.jpg"),
            dir: () => CMDS.ls(),
            cat: (a) => (a[0] && a[0].toLowerCase() === "readme.txt" ? print("Hi! Type 'help' to see what I can do. — Leruo") : print(`The system cannot find the file specified.`)),
            type: (a) => CMDS.cat(a),
            echo: (a) => print(a.join(" ")),
            color: (a) => { const c = ["#c0c0c0", "#3b78ff", "#16c60c", "#61d6d6", "#e74856", "#b4009e", "#f9f1a5", "#f2f2f2", "#ffb000", "#9be37d"][+a[0]] || "#c0c0c0"; term.style.color = c; },
            clear: () => (out.innerHTML = ""),
            cls: () => CMDS.clear(),
            open: (a) => { const k = (a[0] || "").toLowerCase(); const map = { portfolio: APPS.portfolio, resume: APPS.resume, cv: APPS.resume, paint: openPaint, solitaire: openSolitaire, music: openMusic, game: APPS.game, mines: APPS.mines, help: APPS.help }; if (map[k]) { print(`Opening ${k}…`); map[k](); } else print(`'${k}' is not recognised. Try: portfolio, resume, paint, solitaire, music, game, mines`); },
            sudo: () => print("Nice try. This incident will be reported to the dogs."),
            matrix: () => { let n = 0; const id = setInterval(() => { print(Array.from({ length: 64 }, () => (Math.random() < 0.5 ? "0" : "1")).join(""), "term-acc"); if (++n > 18) clearInterval(id); }, 60); },
            exit: () => $(".close", body.closest(".win")).click(),
            coffee: () => print("Brewing… done. Productivity +10."),
          };
          print("LeruOS XP [Version 5.1.2600]");
          print("(C) Leruo Matlhatsi. All rights reserved.");
          print("Type 'help' to get started.");
          print();
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              const line = inp.value.trim(); inp.value = "";
              print(`C:\\Users\\${P.shortName}>${line}`);
              if (line) { hist.push(line); hi = hist.length; const [c, ...a] = line.split(/\s+/); (CMDS[c.toLowerCase()] || (() => { print(`'${c}' is not recognized as an internal or external command,`); print("operable program or batch file. Type 'help'."); }))(a); }
              print();
            } else if (e.key === "ArrowUp") { if (hi > 0) inp.value = hist[--hi]; e.preventDefault(); }
            else if (e.key === "ArrowDown") { inp.value = hi < hist.length - 1 ? hist[++hi] : ((hi = hist.length), ""); e.preventDefault(); }
            else if (e.key === "Tab") { e.preventDefault(); const m = Object.keys(CMDS).filter((k) => k.startsWith(inp.value)); if (m.length === 1) inp.value = m[0] + " "; else if (m.length) print(m.join("  ")); }
          });
          term.addEventListener("click", () => inp.focus());
          setTimeout(() => inp.focus(), 50);
        },
      });
    }

    Object.assign(APPS, { mycomputer: myComputer, mydocs: myDocs, recycle, paint: openPaint, solitaire: openSolitaire, music: openMusic, terminal: openTerminal });
    return SFX;
  };
})();
