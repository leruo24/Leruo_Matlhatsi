/* Small inline SVG glyphs used inside LeruOS windows (contact links, interests, Paint tools,
   Minesweeper, the tray). Drawn for this site; no emoji, no third-party logos. */
window.UI_ICONS = (function () {
  const s = (body, vb = "0 0 24 24") => `<svg class="ui-ico" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  return {
    /* contact */
    mail: s(`<rect x="2.5" y="5" width="19" height="14" rx="2" fill="#eef3ff" stroke="#2b5bd7" stroke-width="1.6"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="#2b5bd7" stroke-width="1.6" stroke-linejoin="round"/>`),
    linkedin: s(`<rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="#e8f1fb" stroke="#1f5fa8" stroke-width="1.6"/><circle cx="8.5" cy="10" r="2.4" fill="#1f5fa8"/><path d="M4.8 17c.6-2.4 2-3.6 3.7-3.6s3.1 1.2 3.7 3.6" fill="#1f5fa8"/><path d="M14 9h5M14 12.5h5M14 16h3.5" stroke="#1f5fa8" stroke-width="1.6" stroke-linecap="round"/>`),
    github: s(`<rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="#f1f1f4" stroke="#24292f" stroke-width="1.6"/><path d="M9.5 9l-3 3 3 3M14.5 9l3 3-3 3M13 8l-2 8" fill="none" stroke="#24292f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    trophy: s(`<path d="M7 4h10v4a5 5 0 01-10 0z" fill="#f2c230" stroke="#9a6d00" stroke-width="1.3"/><path d="M7 6H4.5a3 3 0 003 4M17 6h2.5a3 3 0 01-3 4" fill="none" stroke="#9a6d00" stroke-width="1.3"/><path d="M12 13v3.5M8.5 20h7l-1-3.5h-5z" fill="#d9a520" stroke="#9a6d00" stroke-width="1.3" stroke-linejoin="round"/>`),

    /* interests */
    offroad: s(`<path d="M3 15.5V11l2.5-1 2-4h7l2.5 4h2.5l1.5 1.5v4z" fill="#c9b48f" stroke="#3a2a1a" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 7h5l1.6 3H8z" fill="#9fc7e8" stroke="#3a2a1a" stroke-width="1"/><rect x="7.5" y="4.3" width="7.5" height="1.6" rx=".5" fill="#3e4a3f"/><circle cx="7" cy="16.5" r="2.6" fill="#222"/><circle cx="17" cy="16.5" r="2.6" fill="#222"/><circle cx="7" cy="16.5" r="1" fill="#999"/><circle cx="17" cy="16.5" r="1" fill="#999"/>`),
    car: s(`<path d="M2 15.5l1-2.5 5-3.5h6l4.5 3 3 .8.5 2.2z" fill="#e2552b" stroke="#5a1d0b" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 10.3h4.6l3 2.2H7z" fill="#9fc7e8" stroke="#5a1d0b" stroke-width=".9"/><circle cx="6.5" cy="16" r="2.3" fill="#222"/><circle cx="17.5" cy="16" r="2.3" fill="#222"/><circle cx="6.5" cy="16" r=".9" fill="#bbb"/><circle cx="17.5" cy="16" r=".9" fill="#bbb"/>`),
    sprout: s(`<path d="M12 21v-9" stroke="#3d7a2a" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13c-1-4-4-5.5-7.5-5 0 3.5 2.5 6 7.5 5z" fill="#6cc04a" stroke="#3d7a2a" stroke-width="1.2"/><path d="M12 11c.5-4 3.5-6.5 7.5-6.5.3 4-2.5 7-7.5 6.5z" fill="#8bd65f" stroke="#3d7a2a" stroke-width="1.2"/><path d="M5 21h14" stroke="#7a5a32" stroke-width="1.8" stroke-linecap="round"/>`),
    paw: s(`<ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" fill="#8a5a3b"/><ellipse cx="6" cy="10.5" rx="1.9" ry="2.4" fill="#8a5a3b"/><ellipse cx="9.6" cy="6.8" rx="1.9" ry="2.5" fill="#8a5a3b"/><ellipse cx="14.4" cy="6.8" rx="1.9" ry="2.5" fill="#8a5a3b"/><ellipse cx="18" cy="10.5" rx="1.9" ry="2.4" fill="#8a5a3b"/>`),
    chart: s(`<path d="M4 20V4M4 20h16" stroke="#333" stroke-width="1.6" stroke-linecap="round"/><rect x="6.5" y="13" width="3" height="5" fill="#5b8def"/><rect x="11" y="10" width="3" height="8" fill="#3a6fd8"/><rect x="15.5" y="6.5" width="3" height="11.5" fill="#2f8f4e"/><path d="M6 11l4.5-3.5 3 2 5-5" fill="none" stroke="#e2552b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    chip: s(`<rect x="6" y="6" width="12" height="12" rx="1.5" fill="#2d3a33" stroke="#111" stroke-width="1.2"/><rect x="9" y="9" width="6" height="6" rx=".8" fill="#5e7468"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" stroke="#c9a640" stroke-width="1.5" stroke-linecap="round"/>`),

    /* Paint tools */
    pencil: s(`<path d="M4 20l1-4.5L15.5 5l3.5 3.5L8.5 19z" fill="#f2c230" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 20l1-4.5 3.5 3.5z" fill="#f4d9b0" stroke="#333" stroke-width="1"/><path d="M15.5 5l1.5-1.5 3.5 3.5L19 8.5z" fill="#e57373" stroke="#333" stroke-width="1"/>`),
    brush: s(`<path d="M13 11l6.5-7 1 1-6.5 7.5z" fill="#8a5a3b" stroke="#333" stroke-width="1"/><path d="M12 11.5l2 2-2.5 2.2-2-2z" fill="#aaa" stroke="#333" stroke-width="1"/><path d="M9.5 13.7l2 2C10 19 7 20.5 3.5 20c1.5-1.5 1-5 6-6.3z" fill="#2b5bd7" stroke="#333" stroke-width="1"/>`),
    spray: s(`<rect x="7" y="9" width="7" height="12" rx="1.5" fill="#d0d4da" stroke="#333" stroke-width="1.2"/><rect x="8.5" y="6" width="4" height="3" fill="#e2552b" stroke="#333" stroke-width="1"/><g fill="#2b5bd7"><circle cx="16.5" cy="5" r=".9"/><circle cx="19" cy="7" r=".9"/><circle cx="18" cy="3.5" r=".9"/><circle cx="20.5" cy="4.5" r=".9"/><circle cx="17" cy="8.5" r=".9"/></g>`),
    eraser: s(`<path d="M3.5 15.5l9-9 7 7-6 6H8z" fill="#f4a3b5" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/><path d="M3.5 15.5l4.5-4.5 7 7-1.5 1.5H8z" fill="#fff" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 19.5h12" stroke="#333" stroke-width="1.2" stroke-linecap="round"/>`),
    fill: s(`<path d="M5 11l6-6 7 7-6 6z" fill="#e8e8e8" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 11h13l-6 6z" fill="#2b5bd7" opacity=".85"/><path d="M19.5 14.5c1 1.6 1.5 2.6 1.5 3.3a1.5 1.5 0 01-3 0c0-.7.5-1.7 1.5-3.3z" fill="#2b5bd7"/>`),
    line: s(`<path d="M5 19L19 5" stroke="#222" stroke-width="2" stroke-linecap="round"/>`),
    rect: s(`<rect x="4.5" y="6.5" width="15" height="11" fill="none" stroke="#222" stroke-width="1.8"/>`),
    ellipse: s(`<ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="#222" stroke-width="1.8"/>`),

    /* Minesweeper */
    mine: s(`<g stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></g><circle cx="12" cy="12" r="6" fill="#111"/><circle cx="10" cy="10" r="1.7" fill="#fff"/>`),
    flag: s(`<path d="M8 4v14" stroke="#000" stroke-width="1.8"/><path d="M8 4l8 3.5L8 11z" fill="#e01b1b"/><path d="M5 19h8M4 21h10" stroke="#000" stroke-width="1.8"/>`),
    face: s(`<circle cx="12" cy="12" r="9" fill="#ffd93b" stroke="#000" stroke-width="1.3"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M8 14c2.2 2.4 5.8 2.4 8 0" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>`),
    faceLost: s(`<circle cx="12" cy="12" r="9" fill="#ffd93b" stroke="#000" stroke-width="1.3"/><path d="M7.5 8.5l3 3M10.5 8.5l-3 3M13.5 8.5l3 3M16.5 8.5l-3 3" stroke="#000" stroke-width="1.3" stroke-linecap="round"/><path d="M8.5 16.5c2-1.8 5-1.8 7 0" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>`),
    faceWon: s(`<circle cx="12" cy="12" r="9" fill="#ffd93b" stroke="#000" stroke-width="1.3"/><path d="M5.5 9.5h13" stroke="#000" stroke-width="1.2"/><rect x="6.5" y="9" width="4.5" height="3" rx="1" fill="#000"/><rect x="13" y="9" width="4.5" height="3" rx="1" fill="#000"/><path d="M8 14.5c2.2 2.4 5.8 2.4 8 0" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>`),

    /* taskbar tray */
    volume: s(`<path d="M3 9.5h4l5-4v13l-5-4H3z" fill="#fff"/><path d="M15 9a4 4 0 010 6M17.5 6.5a7.5 7.5 0 010 11" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`),
    network: s(`<rect x="2.5" y="4" width="9" height="7" rx="1" fill="#cfe0ff" stroke="#fff" stroke-width="1.3"/><rect x="12.5" y="12" width="9" height="7" rx="1" fill="#cfe0ff" stroke="#fff" stroke-width="1.3"/><path d="M7 11v4.5h5.5M17 12V8.5h-5.5" fill="none" stroke="#fff" stroke-width="1.3"/>`),
  };
})();
