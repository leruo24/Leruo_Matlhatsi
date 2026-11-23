/* Leruo's old Android tablet: lock screen, home screen of apps, system bar. All content comes from
   window.PORTFOLIO (../os/content.js); nothing here is made up, and empty sections are left out. */
(() => {
  const P = window.PORTFOLIO || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const embedded = window.top !== window.self;
  const toHost = (action) => embedded && window.parent.postMessage({ type: 'tablet', action }, '*');

  // ---- clock
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function tick() {
    const d = new Date(), t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
    for (const id of ['lock-time', 'widget-time', 'bar-time']) $('#' + id).textContent = t;
    $('#lock-date').textContent = date; $('#widget-date').textContent = date;
  }
  tick(); setInterval(tick, 10000);
  $('#lock-owner').textContent = P.name ? `${P.name}'s tablet` : '';
  $('#widget-name').textContent = [P.title, P.location].filter(Boolean).join(' · ');

  // ---- icons (simple outline glyphs, no logos)
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const G = {
    about: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    projects: svg('<path d="M3 7h7l2 2h9v10H3z"/>'),
    work: svg('<rect x="3" y="7" width="18" height="13" rx="1"/><path d="M9 7V4h6v3M3 12h18"/>'),
    skills: svg('<path d="M14 6l4 4-9 9H5v-4z"/><path d="M12 8l4 4"/>'),
    study: svg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'),
    likes: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
    contact: svg('<rect x="3" y="6" width="18" height="13" rx="1"/><path d="M3 7l9 6 9-6"/>'),
    cv: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  };

  // ---- apps, built only from what the content file has
  const apps = [];
  const add = (id, name, color, glyph, render) => apps.push({ id, name, color, glyph, render });
  if (P.about?.length || P.tagline) add('about', 'About me', '#0099cc', G.about, () => `
    <div class="person">${P.photos?.headshot ? `<img src="${esc(P.photos.headshot)}" alt="${esc(P.name)}">` : ''}
      <div><p class="lead">${esc(P.name)}</p><p>${esc(P.title)}</p><p>${esc(P.location)}</p></div></div>
    ${P.tagline ? `<h2>In short</h2><p class="lead">${esc(P.tagline)}</p>` : ''}
    ${(P.about || []).length ? `<h2>About</h2>${P.about.map((t) => `<p>${esc(t)}</p>`).join('')}` : ''}`);
  if (P.projects?.length) add('projects', 'Projects', '#669900', G.projects, () => `
    <h2>Projects</h2><div class="list">${P.projects.map((p, i) => `<button class="row" data-project="${i}"><strong>${esc(p.name)}</strong><span>${esc([p.subtitle, p.year].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>`);
  if (P.experience?.length) add('work', 'Experience', '#ff8800', G.work, () => `
    <h2>Experience</h2>${P.experience.map((e) => `<div class="card"><h3>${esc(e.role)}</h3><p class="meta">${esc([e.org, e.dates].filter(Boolean).join(' · '))}</p>${e.points?.length ? `<ul class="points">${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`).join('')}`);
  if (P.skills?.length) add('skills', 'Skills', '#aa66cc', G.skills, () => P.skills.map((g) => `<h2>${esc(g.group)}</h2><div class="chips">${g.items.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>`).join(''));
  if (P.education?.length || P.awards?.length) add('study', 'Education', '#cc0000', G.study, () => `
    ${(P.education || []).map((e) => `<h2>Education</h2><div class="card"><h3>${esc(e.degree)}</h3><p class="meta">${esc([e.org, e.dates].filter(Boolean).join(' · '))}</p>${e.points?.length ? `<ul class="points">${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`).join('')}
    ${P.awards?.length ? `<h2>Awards</h2><ul class="points">${P.awards.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`);
  if (P.interests?.length) add('likes', 'Interests', '#33b5e5', G.likes, () => `<h2>Interests</h2>${P.interests.map((x) => `<div class="card"><h3>${esc(x.icon || '')} ${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('')}`);
  if (P.contact) add('contact', 'Contact', '#0d8a6a', G.contact, () => {
    const c = P.contact, links = [];
    if (c.email) links.push(`<a class="row" href="mailto:${esc(c.email)}"><strong>Email</strong><span>${esc(c.email)}</span></a>`);
    if (c.linkedin) links.push(`<a class="row" href="${esc(c.linkedin)}" target="_blank" rel="noopener"><strong>LinkedIn</strong><span>Opens in a new tab</span></a>`);
    if (c.github) links.push(`<a class="row" href="${esc(c.github)}" target="_blank" rel="noopener"><strong>GitHub</strong><span>${esc(c.github.replace('https://', ''))}</span></a>`);
    return `<h2>Get in touch</h2><div class="list">${links.join('')}</div>`;
  });
  if (P.resumeUrl) add('cv', 'CV', '#555', G.cv, () => `<h2>CV</h2><p><a class="link-btn" href="${esc(P.resumeUrl)}" target="_blank" rel="noopener">Open my CV (PDF)</a></p>`);

  const grid = $('#apps');
  grid.innerHTML = apps.map((a) => `<button data-app="${a.id}"><span class="app-icon" style="background:${a.color}">${a.glyph}</span>${esc(a.name)}</button>`).join('');

  // ---- navigation: a tiny back stack like the real thing
  const stack = []; const recent = [];
  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }
  function openApp(id, detail) {
    const a = apps.find((x) => x.id === id); if (!a) return;
    $('#app-title').textContent = detail != null ? P.projects[detail].name : a.name;
    $('#app-icon').style.background = a.color; $('#app-icon').innerHTML = a.glyph;
    $('#app-body').innerHTML = detail != null ? projectPage(P.projects[detail]) : a.render();
    $('#app-body').scrollTop = 0;
    stack.push({ id, detail }); show('app');
    const r = recent.findIndex((x) => x === id); if (r >= 0) recent.splice(r, 1); recent.unshift(id);
  }
  function projectPage(p) {
    return `<p class="meta" style="color:var(--muted)">${esc([p.subtitle, p.year].filter(Boolean).join(' · '))}</p>
      ${p.tags?.length ? `<div class="chips">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${p.summary ? `<h2>Summary</h2><p>${esc(p.summary)}</p>` : ''}
      ${p.role ? `<h2>My role</h2><p>${esc(p.role)}</p>` : ''}
      ${p.points?.length ? `<h2>What I did</h2><ul class="points">${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${p.links?.length ? `<h2>Links</h2>${p.links.map((l) => `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}` : ''}`;
  }
  function home() { stack.length = 0; show('home'); }
  function back() {
    if ($('#lock').classList.contains('active')) return toHost('exit');
    if ($('#recents').classList.contains('active') || $('#home').classList.contains('active') && !stack.length) { if ($('#recents').classList.contains('active')) return home(); return toHost('exit'); }
    stack.pop();
    const prev = stack.pop();
    if (prev) openApp(prev.id, prev.detail); else home();
  }
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b) openApp(b.dataset.app); });
  $('#app-body').addEventListener('click', (e) => { const b = e.target.closest('[data-project]'); if (b) openApp('projects', Number(b.dataset.project)); });
  $('#up').onclick = back; $('#back').onclick = back; $('#homekey').onclick = () => { if (!$('#lock').classList.contains('active')) home(); };
  $('#recent').onclick = () => {
    if ($('#lock').classList.contains('active')) return;
    $('#recent-list').innerHTML = recent.length ? recent.map((id) => { const a = apps.find((x) => x.id === id); return `<button data-recent="${id}"><span class="app-icon small" style="background:${a.color}">${a.glyph}</span>${esc(a.name)}</button>`; }).join('') : '<p>No recent apps.</p>';
    show('recents');
  };
  $('#recent-list').addEventListener('click', (e) => { const b = e.target.closest('[data-recent]'); if (b) openApp(b.dataset.recent); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); back(); } });

  // ---- unlock: tap the ring, or drag it outward
  const ring = $('#unlock'); let start = null;
  const unlock = () => { ring.classList.remove('dragging'); home(); };
  ring.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; ring.classList.add('dragging'); ring.setPointerCapture(e.pointerId); });
  ring.addEventListener('pointermove', (e) => { if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 70) { start = null; unlock(); } });
  ring.addEventListener('pointerup', () => { if (start) { start = null; unlock(); } });
  ring.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlock(); } });
  const page = new URLSearchParams(location.search).get('app');
  if (page) { home(); openApp(page); }
})();
