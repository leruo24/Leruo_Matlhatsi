/* LeruOS: a small Windows XP-style desktop that renders the portfolio from content.js */
(function () {
  "use strict";
  const P = window.PORTFOLIO;
  const UI = window.UI_ICONS || {};
  const params = new URLSearchParams(location.search);
  const embedded = params.has("embedded") || window.top !== window.self;
  if (embedded) document.body.classList.add("embedded");
  if (embedded && params.get("crt") !== "0") document.body.classList.add("crt");
  if (!embedded && params.get("from") === "room") document.getElementById("back-to-room").hidden = false;

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Highlight TODO placeholders so they're impossible to miss
  const txt = (s) => {
    const e = esc(s);
    return /TODO/.test(s) ? `<span class="todo" title="Edit os/content.js">${e}</span>` : e;
  };
  const isTodo = (s) => !s || /TODO/.test(s);
  const toHost = (action) => embedded && window.parent.postMessage({ type: "os", action }, "*");

  document.title = `${P.name} · Personal Portfolio`;
  if ($("#ti-vol")) $("#ti-vol").innerHTML = UI.volume || "";
  if ($("#ti-net")) $("#ti-net").innerHTML = UI.network || "";

  /* ---------------- icons (inline SVG) ---------------- */
  const ICONS = {
    showcase: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#3aa0d8" stroke="#0d3550" stroke-width="1.5"/><path d="M6 13c4 1 5-3 9-2s2 5 6 5 4-4 6-3M8 22c3-2 6 0 8-1s3-4 7-3" fill="none" stroke="#8fe07a" stroke-width="2.4"/><path d="M16 3c-3 4-4 9-4 13s1 9 4 13M16 3c3 4 4 9 4 13s-1 9-4 13" fill="none" stroke="#0d3550" stroke-width=".8"/></svg>`,
    about: `<svg viewBox="0 0 32 32"><rect x="3" y="4" width="26" height="19" fill="#d8cfba" stroke="#3a372f"/><rect x="6" y="7" width="20" height="13" fill="#1f5c43"/><path d="M14 10c-2 2-3 4-2 6 .5 1 1 2 2 2.5 1-.5 1.5-1.5 2-2.5 1-2 0-4-2-6z" fill="#9be37d"/><rect x="10" y="24" width="12" height="3" fill="#bdb39d" stroke="#3a372f"/><rect x="6" y="27" width="20" height="2" fill="#bdb39d" stroke="#3a372f"/></svg>`,
    projects: `<svg viewBox="0 0 32 32"><path d="M2 8h10l3 3h15v17H2z" fill="#e8b93a" stroke="#6b4e0e"/><path d="M2 13h28v15H2z" fill="#f6d36b" stroke="#6b4e0e"/></svg>`,
    experience: `<svg viewBox="0 0 32 32"><rect x="3" y="10" width="26" height="17" rx="2" fill="#8a5a3b" stroke="#3a2414"/><path d="M11 10V7h10v3" fill="none" stroke="#3a2414" stroke-width="2"/><rect x="3" y="16" width="26" height="2" fill="#5c3a22"/><rect x="14" y="15" width="4" height="4" fill="#e8b93a" stroke="#3a2414"/></svg>`,
    resume: `<svg viewBox="0 0 32 32"><path d="M7 2h13l6 6v22H7z" fill="#fff" stroke="#333"/><path d="M20 2v6h6" fill="#ddd" stroke="#333"/><path d="M10 12h12M10 15h12M10 18h9" stroke="#888"/><rect x="9" y="21" width="15" height="7" fill="#c62828"/><text x="16.5" y="26.6" font-size="5.5" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">PDF</text></svg>`,
    contact: `<svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="18" fill="#fff" stroke="#333"/><path d="M3 7l13 10L29 7" fill="none" stroke="#333"/><path d="M3 25l10-9M29 25l-10-9" stroke="#999"/><circle cx="25" cy="8" r="4" fill="#2f8f4e"/></svg>`,
    mines: `<svg viewBox="0 0 32 32"><g stroke="#000" stroke-width="2"><path d="M16 4v24M4 16h24M7.5 7.5l17 17M24.5 7.5l-17 17"/></g><circle cx="16" cy="16" r="8" fill="#111"/><circle cx="13" cy="13" r="2.2" fill="#fff"/></svg>`,
    readme: `<svg viewBox="0 0 32 32"><path d="M7 2h18v28H7z" fill="#fff" stroke="#333"/><rect x="7" y="2" width="18" height="4" fill="#2f8f4e"/><path d="M10 10h12M10 13h12M10 16h12M10 19h8M10 22h10" stroke="#555"/></svg>`,
    game: `<svg viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="3" fill="#f0a64a"/><path d="M0 24c6-5 10 1 16-3s10-2 16 1v10H0z" fill="#7a5a32"/><rect x="7" y="13" width="15" height="6" fill="#c9b48f" stroke="#3a2a1a"/><rect x="11" y="9" width="8" height="5" fill="#c9b48f" stroke="#3a2a1a"/><rect x="10" y="7" width="10" height="2" fill="#3e4a3f"/><circle cx="10" cy="20" r="2.6" fill="#222"/><circle cx="19" cy="20" r="2.6" fill="#222"/></svg>`,
    help: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#2f6fd6" stroke="#0e3a8c"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#7fb1ff" stroke-width="1"/><text x="16" y="22" font-size="17" font-family="Georgia" font-weight="bold" fill="#fff" text-anchor="middle">?</text></svg>`,
    power: `<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" fill="#d8cfba" stroke="#333"/><circle cx="16" cy="16" r="7" fill="none" stroke="#c62828" stroke-width="2.5"/><path d="M16 7v8" stroke="#c62828" stroke-width="2.5"/></svg>`,
  };

  /* ---------------- window manager ---------------- */
  const winLayer = $("#windows");
  const tasks = $("#tasks");
  const open = new Map(); // id -> {el, task}
  let z = 10;
  let cascade = 0;

  function focusWin(id) {
    open.forEach((w, key) => {
      w.el.classList.toggle("focused", key === id);
      w.task.classList.toggle("active", key === id && !w.el.classList.contains("min"));
    });
    const w = open.get(id);
    if (w) w.el.style.zIndex = ++z;
  }

  function openWindow(id, { title, icon, width = 520, height = 400, x, y, render, menubar = false, toolbar = false, status = null, maximized = false }) {
    if (open.has(id)) {
      const w = open.get(id);
      w.el.classList.remove("min");
      focusWin(id);
      return w;
    }
    const desk = $("#desktop").getBoundingClientRect();
    width = Math.min(width, desk.width - 20);
    height = Math.min(height, desk.height - 20);
    if (x == null) x = Math.max(10, Math.min(110 + cascade * 28, desk.width - width - 10));
    if (y == null) y = Math.max(10, Math.min(24 + cascade * 26, desk.height - height - 10));
    cascade = (cascade + 1) % 6;

    const el = document.createElement("section");
    el.className = "win raised";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", title);
    Object.assign(el.style, { left: x + "px", top: y + "px", width: width + "px", height: height + "px" });
    el.innerHTML = `
      <div class="titlebar">${ICONS[icon] || ""}<span class="t">${esc(title)}</span>
        <div class="tbtns">
          <button class="tb minb" aria-label="Minimise"></button>
          <button class="tb maxb" aria-label="Maximise"></button>
          <button class="tb close" aria-label="Close"></button>
        </div>
      </div>
      ${menubar ? `<div class="menubar"><span>File</span><span>Edit</span><span>View</span>${toolbar ? "<span>Favorites</span><span>Tools</span>" : ""}<span class="m-help" title="How this website works">Help</span></div>` : ""}
      ${toolbar ? `<div class="toolbar"><button class="nav" data-nav="back"><i>◀</i><span>Back</span></button><button class="nav" data-nav="home"><i>⌂</i><span>Home</span></button><div class="addr"><label>Address</label><div class="addr-text"></div><button class="go">Go</button></div></div>` : ""}
      <div class="win-body"></div>
      ${status ? `<div class="statusbar"><span class="sunken">${esc(status)}</span></div>` : ""}`;
    if (maximized) el.classList.add("max");
    winLayer.appendChild(el);
    render($(".win-body", el), el);
    const mh = $(".m-help", el);
    if (mh) mh.addEventListener("click", () => openHelp());

    const task = document.createElement("button");
    task.innerHTML = `${ICONS[icon] || ""}<span>${esc(title)}</span>`;
    task.addEventListener("click", () => {
      const isTop = el.classList.contains("focused") && !el.classList.contains("min");
      if (isTop) {
        el.classList.add("min");
        task.classList.remove("active");
      } else {
        el.classList.remove("min");
        focusWin(id);
      }
    });
    tasks.appendChild(task);

    open.set(id, { el, task });
    el.addEventListener("pointerdown", () => focusWin(id));
    $(".close", el).addEventListener("click", () => closeWin(id));
    $(".minb", el).addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.add("min");
      task.classList.remove("active");
    });
    $(".maxb", el).addEventListener("click", () => el.classList.toggle("max"));
    $(".titlebar", el).addEventListener("dblclick", () => el.classList.toggle("max"));
    makeDraggable(el, $(".titlebar", el));
    focusWin(id);
    return open.get(id);
  }

  function closeWin(id) {
    const w = open.get(id);
    if (!w) return;
    w.el.remove();
    w.task.remove();
    open.delete(id);
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || el.classList.contains("max")) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      ox = el.offsetLeft;
      oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const desk = $("#desktop");
      const nx = Math.max(-el.offsetWidth + 80, Math.min(desk.clientWidth - 80, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(desk.clientHeight - 30, oy + e.clientY - sy));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    });
    handle.addEventListener("pointerup", () => (dragging = false));
  }

  /* ---------------- Showcase (the main "website" window) ---------------- */
  let showcaseNav = null;
  function openShowcase(page = "home") {
    const desk = $("#desktop").getBoundingClientRect();
    const w = openWindow("showcase", {
      title: `${P.name} - Personal Portfolio`,
      icon: "showcase",
      width: Math.min(980, desk.width - 120),
      height: desk.height - 40,
      x: Math.max(100, (desk.width - Math.min(980, desk.width - 120)) / 2 + 40),
      y: 14,
      menubar: true,
      toolbar: true,
      status: "Done",
      render: (body) => {
        body.innerHTML = `
          <div class="showcase">
            <nav class="sc-nav" aria-label="Portfolio">
              <div class="me">${esc(P.name)}</div>
              <div class="role">${esc(P.title)}</div>
              ${["home", "about", "experience", "projects", "contact"]
                .map((p) => `<button data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`)
                .join("")}
              <button data-p="resume">Resume</button>
              <div class="spacer"></div>
              <div class="mini">${esc(P.location)}</div>
            </nav>
            <article class="sc-page" tabindex="0"></article>
          </div>`;
        const nav = $(".sc-nav", body);
        const pageEl = $(".sc-page", body);
        const hist = [];
        const addr = $(".addr-text", body.closest(".win"));
        showcaseNav = (p, arg, fromHistory) => {
          if (p === "resume") return openResume();
          if (!fromHistory) hist.push([p, arg]);
          addr.textContent = `http://leruo.matlhatsi/${p}${arg ? "/" + arg : ""}`;
          nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.p === p));
          pageEl.innerHTML = PAGES[p](arg);
          pageEl.scrollTop = 0;
          pageEl.querySelectorAll("[data-go]").forEach((b) =>
            b.addEventListener("click", () => showcaseNav(b.dataset.go, b.dataset.arg))
          );
          pageEl.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => APPS[b.dataset.open]()));
        };
        nav.addEventListener("click", (e) => {
          const b = e.target.closest("button[data-p]");
          if (b) showcaseNav(b.dataset.p);
        });
        const win = body.closest(".win");
        $('[data-nav="back"]', win).addEventListener("click", () => { if (hist.length > 1) { hist.pop(); const [p, a] = hist[hist.length - 1]; showcaseNav(p, a, true); } });
        $('[data-nav="home"]', win).addEventListener("click", () => showcaseNav("home"));
      },
    });
    showcaseNav && showcaseNav(page);
    return w;
  }

  const tags = (arr) => `<div class="tags">${arr.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;

  const PAGES = {
    home: () => `
      <div class="home-hero">
        ${P.photos ? `<img class="hero-photo" src="${esc(P.photos.headshot)}" alt="Photo of ${esc(P.name)}" />` : ""}
        <div class="kicker">Hello, I'm</div>
        <h1>${esc(P.name)}</h1>
        <p class="lead"><b>${esc(P.title)}.</b> ${esc(P.tagline)}</p>
        <div class="home-links">
          <button class="pill solid" data-go="projects">See my projects</button>
          <button class="pill" data-go="about">About me</button>
          <button class="pill" data-open="resume">Resume</button>
          <button class="pill" data-go="contact">Get in touch</button>
        </div>
      </div>`,

    about: () => `
      <h2>About me</h2>
      <div class="about-top">
        ${P.photos ? `<img class="about-photo" src="${esc(P.photos.standing)}" alt="${esc(P.name)}" />` : ""}
        <div>${P.about.map((p) => `<p>${txt(p)}</p>`).join("")}</div>
      </div>
      ${
        P.interests
          ? `<h3>When I'm not coding</h3><div class="interests">${P.interests
              .map((i) => `<div class="interest"><span class="i-ico">${UI[i.icon] || esc(i.icon)}</span><b>${esc(i.title)}</b><small>${esc(i.text)}</small></div>`)
              .join("")}</div>`
          : ""
      }
      ${P.photos ? `<div class="gallery"><img src="${esc(P.photos.outdoors)}" alt="${esc(P.name)} outdoors" /><img src="${esc(P.photos.headshot)}" alt="${esc(P.name)}" /></div>` : ""}
      <h3>What I work with</h3>
      <div class="skills">
        ${P.skills.map((s) => `<div class="skill-card"><b>${esc(s.group)}</b>${tags(s.items)}</div>`).join("")}
      </div>`,

    experience: () => {
      const block = (e) => `
        <div class="exp-item">
          <h3 style="margin-top:0">${txt(e.role || e.degree)}</h3>
          <div class="meta"><b>${txt(e.org)}</b>${e.dates ? " · " + txt(e.dates) : ""}</div>
          ${e.points && e.points.length ? `<ul>${e.points.map((p) => `<li>${txt(p)}</li>`).join("")}</ul>` : ""}
        </div>`;
      return `
        <h2>Experience</h2>
        ${P.experience.map(block).join("")}
        <h2 style="margin-top:34px">Education</h2>
        ${P.education.map(block).join("")}
        ${P.awards && P.awards.length ? `<h2 style="margin-top:34px">Awards</h2><ul>${P.awards.map((a) => `<li class="award">${UI.trophy || ""}<span>${esc(a)}</span></li>`).join("")}</ul>` : ""}`;
    },

    projects: (id) => {
      if (id) {
        const p = P.projects.find((x) => x.id === id);
        if (p)
          return `
          <button class="back-link" data-go="projects">← All projects</button>
          <h2 style="margin-bottom:4px">${esc(p.name)}</h2>
          <div class="meta">${esc(p.subtitle)} · ${esc(p.year)}</div>
          ${tags(p.tags)}
          <p class="lead" style="margin-top:16px">${txt(p.summary)}</p>
          ${p.role ? `<p><b>My role:</b> ${txt(p.role)}</p>` : ""}
          ${p.points.length ? `<h3>What I did</h3><ul>${p.points.map((x) => `<li>${txt(x)}</li>`).join("")}</ul>` : ""}
          ${
            p.links && p.links.length
              ? `<div class="home-links">${p.links
                  .map((l) => `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
                  .join("")}</div>`
              : ""
          }`;
      }
      return `
        <h2>Projects</h2>
        <div class="proj-list">
          ${P.projects
            .map(
              (p) => `
            <button class="proj-card" data-go="projects" data-arg="${esc(p.id)}">
              <div class="pc-head"><span class="pc-name">${esc(p.name)}</span><span class="pc-year">${esc(p.year)}</span></div>
              <div class="pc-sub">${esc(p.subtitle)}</div>
              <p>${esc(p.summary)}</p>
              ${tags(p.tags.slice(0, 6))}
            </button>`
            )
            .join("")}
        </div>`;
    },

    contact: () => {
      const c = P.contact;
      const item = (href, label, value, ext) =>
        `<a href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ""}><span class="c-ico">${UI[label] || ""}</span><span><b>${txt(value)}</b></span></a>`;
      return `
        <h2>Get in touch</h2>
        <p>I'm open to graduate roles and internships in software development, agritech and information systems, in Johannesburg, Cape Town or remote.</p>
        <div class="contact-grid">
          ${item("mailto:" + c.email, "mail", c.email)}
          ${item(c.linkedin, "linkedin", "LinkedIn" + (isTodo(c.linkedin) ? " (TODO: add your URL)" : ""), true)}
          ${item(c.github, "github", c.github.replace(/^https?:\/\//, ""), true)}
        </div>
        <div class="home-links"><button class="pill solid" data-open="contact">Write me a message</button></div>`;
    },
  };

  /* ---------------- Help and Support ---------------- */
  function openHelp() {
    const Hp = P.help || { steps: [] };
    openWindow("help", {
      title: "Help and Support Center",
      icon: "help",
      width: 640,
      height: 560,
      render: (body) => {
        body.innerHTML = `
          <div class="help">
            <div class="help-head">${ICONS.help}<div><b>Help and Support Center</b><span>How ${esc(P.shortName)}'s website works</span></div></div>
            <div class="help-body">
              <h3>${esc(Hp.title || "Welcome")}</h3>
              <ol>${Hp.steps.map((x) => `<li><b>${esc(x[0])}</b> ${esc(x[1])}</li>`).join("")}</ol>
              ${Hp.tips ? `<h4>Tips</h4><ul>${Hp.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
              <h4>On this computer</h4>
              <div class="help-links">
                <button data-a="portfolio">${ICONS.showcase}<span><b>Portfolio</b>Projects, experience, contact</span></button>
                <button data-a="resume">${ICONS.resume}<span><b>Resume</b>My CV</span></button>
                <button data-a="game">${ICONS.game}<span><b>Overland Run</b>A 4x4 game</span></button>
              </div>
            </div>
          </div>`;
        body.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => APPS[b.dataset.a]()));
      },
    });
  }

  /* ---------------- other apps ---------------- */
  function openResume() {
    openWindow("resume", {
      title: "Resume", icon: "resume", width: 720, height: 640,
      render: async (body) => {
        const unavailable = () => {
          body.innerHTML = `<div class="empty-state"><b>A downloadable CV is not available yet.</b><span>You can explore my projects and experience in Portfolio, or ask me for a copy.</span><button class="btn95" data-cv="portfolio">View portfolio</button><button class="btn95" data-cv="contact">Ask for a copy</button></div>`;
          body.querySelectorAll("[data-cv]").forEach(b => b.onclick = () => APPS[b.dataset.cv]());
        };
        if (!P.resumeUrl) return unavailable();
        body.innerHTML = `<div class="empty-state">Loading…</div>`;
        try {
          const response = await fetch(P.resumeUrl, {method:"HEAD"});
          if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF unavailable");
          if (!body.isConnected) return;
          body.innerHTML = `<a class="btn95" href="${esc(P.resumeUrl)}" download>Download CV</a><iframe class="pdf-frame" src="${esc(P.resumeUrl)}" title="Resume"></iframe>`;
        } catch { if (body.isConnected) unavailable(); }
      },
    });
  }

  function openContact() {
    openWindow("contact", {
      title: "New Message",
      icon: "contact",
      width: 460,
      height: 420,
      render: (body) => {
        body.innerHTML = `
          <form class="form95">
            <label>To:<input value="${esc(P.contact.email)}" readonly /></label>
            <label>Your name:<input name="name" required /></label>
            <label>Subject:<input name="subject" value="Hi ${esc(P.shortName)}!" /></label>
            <label>Message:<textarea name="msg" required></textarea></label>
            <div class="row"><button type="submit" class="btn95"><b>Send</b></button></div>
            <small>This opens your email app with the message ready to send.</small>
          </form>`;
        $("form", body).addEventListener("submit", (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          const bodyText = `${f.get("msg")}\n\n${f.get("name")}`;
          window.open(
            `mailto:${P.contact.email}?subject=${encodeURIComponent(f.get("subject"))}&body=${encodeURIComponent(bodyText)}`,
            "_blank"
          );
        });
      },
    });
  }

  function openReadme() {
    openWindow("readme", {
      title: "Read Me.txt - Notepad",
      icon: "readme",
      width: 500,
      height: 380,
      menubar: true,
      render: (body) => {
        body.innerHTML = `<textarea class="notepad" readonly spellcheck="false"></textarea>`;
        $("textarea", body).value = [
          `Welcome to LeruOS XP!`,
          ``,
          `You're using ${P.name}'s computer. Have a look around:`,
          `  • Portfolio: projects, experience and contact`,
          `  • Resume: my CV`,
          `  • Overland Run: a 4x4 game. Jump rocks, collect water`,
          `  • Minesweeper: because every OS needs one`,
          ``,
          embedded ? `Press Esc or use 'Back to the workshop' to step out.` : `Go back to the main page for the workshop.`,
          ``,
          `Credits`,
          `  The workshop scene is brought to life with WebGL (Three.js, MIT):`,
          `  depth parallax, flowing water, moving leaves and clouds, light and dust,`,
          `  plus live 3D objects rendered with a camera matched to the photo.`,
          `  Field recordings: CC0 clips from freesound.org (via the ESC-50 dataset).`,
          `  Concept inspired by Henry Heffernan's portfolio (henryheffernan.com).`,
          `  Designed and built by ${P.name}, ${new Date().getFullYear()}.`,
        ].join("\n");
      },
    });
  }

  /* ---------------- Minesweeper ---------------- */
  function openMines() {
    openWindow("mines", {
      title: "Minesweeper",
      icon: "mines",
      width: 270,
      height: 360,
      render: (body, win) => {
        win.style.width = "auto";
        win.style.height = "auto";
        body.style.overflow = "visible";
        body.classList.remove("sunken");
        body.innerHTML = `
          <div class="mines">
            <div class="mines-top sunken"><span class="lcd" id="m-left">010</span><button class="btn95 smiley" id="m-face">${UI.face}</button><span class="lcd" id="m-time">000</span></div>
            <div class="mines-grid sunken"></div>
          </div>`;
        const N = 9, MINES = 10;
        const grid = $(".mines-grid", body);
        const face = $("#m-face", body);
        const left = $("#m-left", body);
        const timeEl = $("#m-time", body);
        let cells, started, over, timer, flags, opened;
        const pad = (n) => String(Math.max(0, Math.min(999, n))).padStart(3, "0");
        const nb = (i) => {
          const r = Math.floor(i / N), c = i % N, out = [];
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr, cc = c + dc;
              if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
            }
          return out;
        };
        function reset() {
          clearInterval(timer);
          cells = Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, n: 0 }));
          started = over = false;
          flags = opened = 0;
          face.innerHTML = UI.face;
          left.textContent = pad(MINES);
          timeEl.textContent = "000";
          grid.innerHTML = "";
          cells.forEach((_, i) => {
            const b = document.createElement("button");
            b.className = "cell btn95";
            b.addEventListener("click", () => reveal(i));
            b.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              flag(i);
            });
            grid.appendChild(b);
          });
        }
        function plant(safe) {
          const banned = new Set([safe, ...nb(safe)]);
          let placed = 0;
          while (placed < MINES) {
            const i = Math.floor(Math.random() * N * N);
            if (!cells[i].mine && !banned.has(i)) {
              cells[i].mine = true;
              placed++;
            }
          }
          cells.forEach((c, i) => (c.n = nb(i).filter((j) => cells[j].mine).length));
          let t = 0;
          timer = setInterval(() => (timeEl.textContent = pad(++t)), 1000);
        }
        function draw(i) {
          const c = cells[i], b = grid.children[i];
          b.className = "cell " + (c.open ? "open" : "btn95");
          if (c.open && c.mine) b.innerHTML = UI.mine; else if (!c.open && c.flag) b.innerHTML = UI.flag; else b.textContent = c.open ? c.n || "" : "";
          if (c.open && c.n && !c.mine) b.classList.add("n" + c.n);
        }
        function reveal(i) {
          if (over || cells[i].flag || cells[i].open) return;
          if (!started) {
            started = true;
            plant(i);
          }
          const c = cells[i];
          if (c.mine) {
            over = true;
            clearInterval(timer);
            face.innerHTML = UI.faceLost;
            embedded && window.parent.postMessage({ type: "os", action: "sfx", name: "boom" }, "*");
            cells.forEach((x, j) => {
              if (x.mine) {
                x.open = true;
                draw(j);
              }
            });
            grid.children[i].classList.add("boom");
            return;
          }
          const stack = [i];
          while (stack.length) {
            const j = stack.pop();
            const x = cells[j];
            if (x.open || x.flag) continue;
            x.open = true;
            opened++;
            draw(j);
            if (x.n === 0) stack.push(...nb(j));
          }
          if (opened === N * N - MINES) {
            over = true;
            clearInterval(timer);
            face.innerHTML = UI.faceWon;
          }
        }
        function flag(i) {
          if (over || cells[i].open) return;
          cells[i].flag = !cells[i].flag;
          flags += cells[i].flag ? 1 : -1;
          left.textContent = pad(MINES - flags);
          draw(i);
        }
        face.addEventListener("click", reset);
        reset();
      },
    });
  }


  /* ---------------- Overland Run (4x4 endless runner) ---------------- */
  function openOverland() {
    openWindow("game", {
      title: "Overland Run",
      icon: "game",
      width: 700,
      height: 430,
      status: "Space / ↑ / click to jump · collect water drops",
      render: (body, win) => {
        body.style.background = "#000";
        body.innerHTML = `<canvas width="680" height="340" style="width:100%;height:100%;display:block;cursor:pointer" tabindex="0"></canvas>`;
        const cv = $("canvas", body);
        const g = cv.getContext("2d");
        const W = 680, H = 340, GROUND = 270;
        let best = 0;
        try { best = +localStorage.getItem("lm-overland-best") || 0; } catch {}
        let st;
        const reset = () => {
          st = { y: 0, vy: 0, speed: 260, dist: 0, drops: 0, obs: [], items: [], t: 0, next: 1.2, nextItem: 0.6, over: false, started: false, wheel: 0 };
        };
        reset();
        const jump = () => {
          if (st.over) { reset(); st.started = true; return; }
          st.started = true;
          if (st.y <= 0.01) { st.vy = 640; window.parent !== window && window.parent.postMessage({ type: "os", action: "sfx", name: "jump" }, "*"); }
        };
        cv.addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
        const onKey = (e) => {
          if (!open.has("game") || !win.classList.contains("focused")) return;
          if (e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); jump(); }
        };
        document.addEventListener("keydown", onKey);
        const hills = (off, amp, base, col, freq) => {
          g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
          for (let x = 0; x <= W; x += 8) g.lineTo(x, base - Math.sin((x + off) * freq) * amp - Math.sin((x + off) * freq * 2.7) * amp * 0.3);
          g.lineTo(W, H); g.fill();
        };
        const acacia = (x, y, s) => {
          g.fillStyle = "#3a2a1e"; g.fillRect(x - 2 * s, y - 34 * s, 4 * s, 34 * s);
          g.beginPath(); g.ellipse(x, y - 36 * s, 26 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
        };
        // a water drop drawn as a path (was an emoji)
        const drop = (x, y, k) => {
          g.save(); g.translate(x, y); g.scale(k, k);
          g.beginPath(); g.moveTo(0, -13); g.bezierCurveTo(5, -5, 9, 0, 9, 4); g.arc(0, 4, 9, 0, Math.PI); g.bezierCurveTo(-9, 0, -5, -5, 0, -13); g.closePath();
          g.fillStyle = "#3aa7f0"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = "#0d5c9a"; g.stroke();
          g.beginPath(); g.ellipse(-3, 3, 2, 3.5, -0.4, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.7)"; g.fill();
          g.restore();
        };
        const truck = (x, y) => {
          const bob = st.y > 0 ? 0 : Math.sin(st.t * 30) * 1.2;
          y += bob;
          g.fillStyle = "#3e4a3f"; g.fillRect(x + 6, y - 58, 44, 9); // rooftop tent
          g.fillStyle = "#222"; g.fillRect(x + 2, y - 49, 56, 3);
          g.fillStyle = "#c9b38a"; g.fillRect(x, y - 46, 62, 22); g.fillRect(x - 6, y - 30, 88, 18);
          g.fillStyle = "#6f8796"; g.fillRect(x + 6, y - 42, 18, 12); g.fillRect(x + 28, y - 42, 18, 12); g.fillRect(x + 50, y - 42, 9, 12);
          g.fillStyle = "#f26b1d"; g.fillRect(x + 18, y - 52, 30, 3);
          g.fillStyle = "#1d1d1d"; g.fillRect(x + 78, y - 26, 6, 14); g.fillRect(x + 56, y - 60, 3, 16); // bullbar + snorkel
          g.fillStyle = "#222"; g.beginPath(); g.arc(x - 8, y - 22, 9, 0, Math.PI * 2); g.fill(); // spare
          for (const wx of [x + 12, x + 64]) {
            g.fillStyle = "#151515"; g.beginPath(); g.arc(wx, y - 9, 11, 0, Math.PI * 2); g.fill();
            g.strokeStyle = "#888"; g.lineWidth = 2; g.beginPath();
            g.moveTo(wx + Math.cos(st.wheel) * 7, y - 9 + Math.sin(st.wheel) * 7); g.lineTo(wx - Math.cos(st.wheel) * 7, y - 9 - Math.sin(st.wheel) * 7); g.stroke();
          }
        };
        let last = performance.now(), raf;
        const loop = (now) => {
          if (!cv.isConnected) { document.removeEventListener("keydown", onKey); return; }
          raf = requestAnimationFrame(loop);
          const dt = Math.min(0.033, (now - last) / 1000);
          last = now;
          if (win.classList.contains("min")) return;
          if (st.started && !st.over) {
            st.t += dt;
            st.speed += dt * 6;
            st.dist += st.speed * dt;
            st.wheel += st.speed * dt / 11;
            st.vy -= 1700 * dt;
            st.y = Math.max(0, st.y + st.vy * dt);
            if (st.y === 0) st.vy = 0;
            st.next -= dt; st.nextItem -= dt;
            if (st.next <= 0) {
              const kind = Math.random() < 0.6 ? "rock" : Math.random() < 0.5 ? "log" : "mud";
              st.obs.push({ x: W + 20, kind, w: kind === "log" ? 46 : kind === "mud" ? 60 : 30, h: kind === "rock" ? 26 + Math.random() * 14 : kind === "log" ? 18 : 6 });
              st.next = 0.9 + Math.random() * 1.1 - Math.min(0.4, st.t / 120);
            }
            if (st.nextItem <= 0) { st.items.push({ x: W + 20, y: GROUND - 60 - Math.random() * 70 }); st.nextItem = 1.4 + Math.random() * 1.6; }
            for (const o of st.obs) o.x -= st.speed * dt;
            for (const it of st.items) it.x -= st.speed * dt;
            st.obs = st.obs.filter((o) => o.x > -80);
            st.items = st.items.filter((it) => it.x > -30 && !it.got);
            const tx = 110, ty = GROUND - st.y;
            for (const o of st.obs) {
              if (o.kind === "mud") continue;
              if (tx + 74 > o.x + 4 && tx - 4 < o.x + o.w - 4 && ty > GROUND - o.h + 2) {
                st.over = true;
                window.parent !== window && window.parent.postMessage({ type: "os", action: "sfx", name: "crash" }, "*");
                const score = Math.floor(st.dist / 10) + st.drops * 50;
                if (score > best) { best = score; try { localStorage.setItem("lm-overland-best", String(best)); } catch {} }
              }
            }
            for (const it of st.items) if (Math.abs(it.x - (tx + 35)) < 34 && Math.abs(it.y - (ty - 30)) < 34) { it.got = true; st.drops++; }
          }
          // sky
          const sky = g.createLinearGradient(0, 0, 0, GROUND);
          sky.addColorStop(0, "#4d79b8"); sky.addColorStop(0.7, "#f4b77a"); sky.addColorStop(1, "#f7cf96");
          g.fillStyle = sky; g.fillRect(0, 0, W, H);
          g.fillStyle = "#fff0c8"; g.beginPath(); g.arc(520, 150, 30, 0, Math.PI * 2); g.fill();
          const d = st.dist;
          hills(d * 0.1, 26, 205, "#9c8fb0", 0.006);
          hills(d * 0.25, 18, 232, "#7d9157", 0.01);
          for (let i = 0; i < 4; i++) acacia(((i * 230 - d * 0.45) % (W + 200) + W + 200) % (W + 200) - 100, 250, 1);
          // ground
          g.fillStyle = "#b08a5e"; g.fillRect(0, GROUND, W, H - GROUND);
          g.fillStyle = "#8f6c45";
          for (let x = -((d * 1) % 40); x < W; x += 40) g.fillRect(x, GROUND + 14, 18, 3);
          g.fillStyle = "#6d8a3c"; g.fillRect(0, GROUND - 2, W, 3);
          // obstacles + drops
          for (const o of st.obs) {
            if (o.kind === "rock") { g.fillStyle = "#7d7a72"; g.beginPath(); g.moveTo(o.x, GROUND); g.lineTo(o.x + 6, GROUND - o.h); g.lineTo(o.x + o.w - 8, GROUND - o.h + 4); g.lineTo(o.x + o.w, GROUND); g.fill(); }
            else if (o.kind === "log") { g.fillStyle = "#6b4526"; g.fillRect(o.x, GROUND - o.h, o.w, o.h); g.fillStyle = "#c19a6b"; g.beginPath(); g.ellipse(o.x + o.w, GROUND - o.h / 2, 5, o.h / 2, 0, 0, Math.PI * 2); g.fill(); }
            else { g.fillStyle = "#5b4128"; g.beginPath(); g.ellipse(o.x + o.w / 2, GROUND + 2, o.w / 2, 6, 0, 0, Math.PI * 2); g.fill(); }
          }
          for (const it of st.items) drop(it.x, it.y, 1);
          truck(110, GROUND - st.y);
          // HUD
          g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(10, 10, 220, 30);
          g.fillStyle = "#fff"; g.font = "bold 15px Tahoma, sans-serif";
          g.fillText(`${Math.floor(d / 10)} m        ${st.drops}   best ${best}`, 18, 30); drop(86, 25, 0.55);
          if (!st.started || st.over) {
            g.fillStyle = "rgba(10,25,18,.72)"; g.fillRect(W / 2 - 190, 90, 380, 110);
            g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "bold 24px Georgia, serif";
            g.fillText(st.over ? "Stuck!" : "Overland Run", W / 2, 128);
            g.font = "15px Tahoma, sans-serif";
            g.fillText(st.over ? `Score ${Math.floor(st.dist / 10) + st.drops * 50} · click or press Space to go again` : "Click or press Space to start · jump the rocks and logs", W / 2, 160);
            g.fillText("Mud is fine, it's a 4x4.", W / 2, 184);
            g.textAlign = "left";
          }
        };
        raf = requestAnimationFrame(loop);
        setTimeout(() => cv.focus(), 50);
      },
    });
  }

  function shutDown() {
    if (embedded) {
      toHost("shutdown");
      return;
    }
    location.href = "../index.html";
  }

  const APPS = {
    help: openHelp,
    portfolio: () => openShowcase("home"),
    about: () => openShowcase("about"),
    projects: () => openShowcase("projects"),
    experience: () => openShowcase("experience"),
    contactPage: () => openShowcase("contact"),
    resume: openResume,
    contact: openContact,
    mines: openMines,
    game: openOverland,
    readme: openReadme,
  };
  const SFX = window.LeruApps ? window.LeruApps({ openWindow, ICONS, APPS, P, esc, $ }) : { startup() {}, logoff() {}, notify() {}, error() {}, open() {} };

  /* ---------------- desktop icons ---------------- */
  const DESKTOP = [
    ["mycomputer", "mycomputer", "My Computer"],
    ["mydocs", "mydocs", "My Documents"],
    ["recycle", "recycle", "Recycle Bin"],
    ["portfolio", "showcase", "Portfolio"],
    ["resume", "resume", "Resume"],
    ["contact", "contact", "Contact"],
    ["game", "game", "Overland Run"],
    ["solitaire", "cards", "Solitaire"],
    ["paint", "paint", "Paint"],
    ["music", "music", "LeruAmp"],
    ["terminal", "terminal", "Command Prompt"],
    ["mines", "mines", "Minesweeper"],
    ["help", "help", "How this works"],
  ].filter(([a]) => APPS[a]);
  const iconList = $("#icons");
  const coarse = matchMedia("(pointer: coarse)").matches;
  DESKTOP.forEach(([app, icon, label]) => {
    const li = document.createElement("li");
    li.innerHTML = `<button class="icon">${ICONS[icon]}<span>${esc(label)}</span></button>`;
    const b = li.firstChild;
    // Single click selects, double click opens (single tap on touch screens)
    b.addEventListener("click", () => {
      iconList.querySelectorAll(".icon").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      if (coarse) APPS[app]();
    });
    b.addEventListener("dblclick", () => APPS[app]());
    b.addEventListener("keydown", (e) => e.key === "Enter" && APPS[app]());
    iconList.appendChild(li);
  });

  /* ---------------- start menu ---------------- */
  const startBtn = $("#start-btn");
  const startMenu = $("#start-menu");
  $("#sm-name").textContent = P.name;
  $("#sm-avatar").src = P.photos ? P.photos.headshot : "";
  const LEFT = [
    ["portfolio", "showcase", "Portfolio", "Projects & experience"],
    ["resume", "resume", "Resume", "My CV (PDF)"],
    null,
    ["game", "game", "Overland Run", "4x4 game"],
    ["solitaire", "cards", "Solitaire", "Klondike"],
    ["paint", "paint", "Paint", "Draw something"],
    ["music", "music", "LeruAmp", "Original tunes"],
    ["terminal", "terminal", "Command Prompt", "Type 'help'"],
    ["mines", "mines", "Minesweeper", "Classic"],
    ["readme", "readme", "Notepad", "Read Me.txt"],
  ].filter((x) => !x || APPS[x[0]]);
  const RIGHT = [
    ["mydocs", "mydocs", "My Documents"],
    ["mycomputer", "mycomputer", "My Computer"],
    null,
    ["about", "about", "About Me"],
    ["projects", "projects", "My Projects"],
    ["experience", "experience", "Experience"],
    null,
    ["contact", "contact", "Contact Me"],
    ["contactPage", "contact", "Links"],
    null,
    ["help", "help", "Help and Support"],
  ];
  $("#start-items").innerHTML = LEFT.map((s) =>
    s ? `<li><button data-app="${s[0]}">${ICONS[s[1]]}<span><b>${esc(s[2])}</b><small>${esc(s[3])}</small></span></button></li>` : `<li class="sep"></li>`
  ).join("");
  $("#start-right").innerHTML = RIGHT.map((s) =>
    s ? `<li><button data-app="${s[0]}">${ICONS[s[1]]}<span>${esc(s[2])}</span></button></li>` : `<li class="sep"></li>`
  ).join("");
  const toggleStart = (show) => {
    startMenu.hidden = !show;
    startBtn.classList.toggle("active", show);
    startBtn.setAttribute("aria-expanded", String(show));
  };
  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStart(startMenu.hidden);
  });
  startMenu.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-app]");
    if (!b) return;
    toggleStart(false);
    APPS[b.dataset.app]();
  });
  $("#sm-off").addEventListener("click", () => { toggleStart(false); shutDown(); });
  $("#sm-logoff").addEventListener("click", () => { toggleStart(false); SFX.logoff(); showWelcome(); });
  document.addEventListener("pointerdown", (e) => {
    if (!startMenu.hidden && !e.target.closest("#start-menu, #start-btn")) toggleStart(false);
    if (!e.target.closest(".icon")) iconList.querySelectorAll(".icon").forEach((x) => x.classList.remove("sel"));
  });

  /* ---------------- clock ---------------- */
  const clock = $("#clock");
  const tick = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  tick();
  setInterval(tick, 10000);

  /* ---------------- talk to the 3D room ---------------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!startMenu.hidden) return toggleStart(false);
      toHost("zoom-out");
    } else toHost("key");
  });
  document.addEventListener("pointerdown", () => toHost("click"));

  const splash = $("#splash");
  const welcome = $("#welcome");
  const balloon = $("#balloon");
  $("#wl-name").textContent = P.name;
  $("#wl-role").textContent = P.title;
  $("#wl-avatar").src = P.photos ? P.photos.headshot : "";
  const wlMid = $(".wl-mid").innerHTML;
  let loggedIn = false, booted = false;

  function openPage(page, arg) {
    if (page === "game") return openOverland();
    if (page === "help") return openHelp();
    if (page === "resume") return openResume();
    openShowcase(page || "home");
    if (arg && showcaseNav) showcaseNav(page, arg);
  }
  function showWelcome() {
    loggedIn = false;
    welcome.classList.remove("out");
    $(".wl-mid").innerHTML = wlMid;
    $("#wl-name").textContent = P.name;
    $("#wl-role").textContent = P.title;
    $("#wl-avatar").src = P.photos ? P.photos.headshot : "";
    $("#wl-user").addEventListener("click", () => logIn());
    welcome.hidden = false;
    setTimeout(() => $("#wl-user") && $("#wl-user").focus(), 50);
  }
  function showBalloon() {
    setTimeout(() => SFX.notify(), 900);
    balloon.hidden = false; balloon.classList.remove("out");
    clearTimeout(showBalloon.t);
    showBalloon.t = setTimeout(() => { balloon.classList.add("out"); setTimeout(() => (balloon.hidden = true), 400); }, 7000);
  }
  $("button", balloon).addEventListener("click", () => (balloon.hidden = true));
  // log on: "Welcome" for a moment, then the desktop
  function logIn(page, arg, instant) {
    if (loggedIn) { if (page) openPage(page, arg); return; }
    loggedIn = true;
    const finish = () => {
      welcome.classList.add("out");
      setTimeout(() => (welcome.hidden = true), 500);
      SFX.startup();
      if (page) openPage(page, arg);
      showBalloon();
    };
    if (instant) { welcome.hidden = true; finish(); return; }
    $(".wl-mid").innerHTML = `<div class="wl-hello">welcome</div>`;
    setTimeout(finish, 1100);
  }
  $("#wl-off").addEventListener("click", () => shutDown());

  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.type !== "host") return;
    if (m.action === "open") {
      // a specific page was asked for (e.g. the CV button): skip straight to the desktop
      booted = true;
      splash.classList.add("done");
      logIn(m.page, m.arg, true);
    }
  });

  /* ---------------- boot ----------------
     Straight to the desktop: no boot screen and no log-on screen first. (Log Off from the
     start menu still shows the log-on screen.) */
  splash.hidden = true;
  splash.classList.add("done");
  booted = true;
  logIn(params.get("page") || undefined, params.get("arg") || undefined, true);
})();
