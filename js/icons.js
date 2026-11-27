// 手描き風のアイコン（絵文字の代わり）。ICON('trophy', 28) のように使う
(function () {
  const K = '#15121f'; // 線の色
  const S = `stroke="${K}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const P = {
    trophy: `<path d="M15 8h18v9c0 7-4 12-9 12s-9-5-9-12z" fill="#ffd23b" ${S}/><path d="M15 12H9c0 6 3 9 7 9M33 12h6c0 6-3 9-7 9" fill="none" ${S}/><path d="M21 29h6v6h-6z" fill="#f59e0b" ${S}/><path d="M14 41h20l-2-6H16z" fill="#a16207" ${S}/><path d="M19 12l2 5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
    heart: `<path d="M24 40C12 32 6 25 6 17c0-5 4-9 9-9 4 0 7 2 9 6 2-4 5-6 9-6 5 0 9 4 9 9 0 8-6 15-18 23z" fill="#ff4d6d" ${S}/><path d="M13 15c1-2 3-3 5-3" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>`,
    clock: `<circle cx="24" cy="26" r="15" fill="#fff8ec" ${S}/><path d="M24 17v9l6 4" fill="none" ${S}/><path d="M19 6h10M24 6v5M36 11l3-3" fill="none" ${S}/><circle cx="24" cy="26" r="2" fill="${K}"/>`,
    skull: `<path d="M24 6C14 6 8 13 8 21c0 5 2 8 5 10v6h22v-6c3-2 5-5 5-10 0-8-6-15-16-15z" fill="#f5f1ea" ${S}/><circle cx="17" cy="22" r="4.5" fill="${K}"/><circle cx="31" cy="22" r="4.5" fill="${K}"/><path d="M24 26l-2 5h4z" fill="${K}"/><path d="M19 37v4M24 37v4M29 37v4" ${S}/>`,
    wind: `<path d="M6 18h22c4 0 6-3 6-6s-3-5-6-4" fill="none" ${S}/><path d="M6 26h30c4 0 6 3 6 6s-3 5-6 4" fill="none" ${S}/><path d="M10 34h12" fill="none" ${S}/><path d="M6 18h22M6 26h30" stroke="#7dd3fc" stroke-width="1.6" fill="none" opacity=".9"/>`,
    dizzy: `<circle cx="24" cy="24" r="17" fill="#ffd23b" ${S}/><path d="M15 19c2-3 6-1 5 1s-4 2-4 0M28 19c2-3 6-1 5 1s-4 2-4 0" fill="none" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/><path d="M17 31c4-3 10-3 14 0" fill="none" ${S}/><path d="M36 8l2-3M40 13l3-1M32 6l0-3" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/>`,
    bolt: `<path d="M27 4L10 27h11l-4 17 19-25H25z" fill="#ffd23b" ${S}/><path d="M24 10l-6 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`,
    sparkle: `<path d="M22 6c1 9 4 12 13 13-9 1-12 4-13 13-1-9-4-12-13-13 9-1 12-4 13-13z" fill="#c084fc" ${S}/><path d="M37 29c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6z" fill="#fde047" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`,
    swirl: `<path d="M24 24c0-2 3-3 4-1 2 3-1 7-5 7-5 0-8-5-7-9 1-6 8-9 13-7 7 3 9 11 6 17-3 7-12 10-19 7" fill="none" ${S}/><path d="M24 24c0-2 3-3 4-1 2 3-1 7-5 7-5 0-8-5-7-9 1-6 8-9 13-7 7 3 9 11 6 17-3 7-12 10-19 7" fill="none" stroke="#38bdf8" stroke-width="1.4" stroke-linecap="round"/>`,
    flame: `<path d="M24 44c-9 0-14-6-14-13 0-8 7-11 7-19 4 3 6 6 6 9 2-2 3-6 2-12 8 5 13 13 13 21 0 8-5 14-14 14z" fill="#ff7a2f" ${S}/><path d="M24 44c-4 0-7-3-7-7 0-4 4-6 5-10 4 3 9 6 9 10 0 4-3 7-7 7z" fill="#ffd23b" stroke="${K}" stroke-width="2.4" stroke-linejoin="round"/>`,
    dice: `<path d="M8 15l16-8 16 8v18l-16 9-16-9z" fill="#fff8ec" ${S}/><path d="M8 15l16 9 16-9M24 24v18" fill="none" ${S}/><circle cx="24" cy="15" r="2.4" fill="#ff4d6d"/><circle cx="15" cy="25" r="2.2" fill="${K}"/><circle cx="17" cy="33" r="2.2" fill="${K}"/><circle cx="31" cy="27" r="2.2" fill="${K}"/><circle cx="33" cy="34" r="2.2" fill="${K}"/>`,
    gear: `<path d="M21 5h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="#a5b4fc" ${S}/><circle cx="24" cy="24" r="6" fill="#fff8ec" ${S}/>`,
    gift: `<path d="M8 19h32v8H8z" fill="#ff4d8d" ${S}/><path d="M11 27h26v14H11z" fill="#ff7aa8" ${S}/><path d="M24 19v22" ${S}/><path d="M24 19c-3-6-11-9-11-3 0 3 6 3 11 3zM24 19c3-6 11-9 11-3 0 3-6 3-11 3z" fill="#ffd23b" ${S}/>`,
    scroll: `<path d="M12 8h22c3 0 5 2 5 5v22c0 3-2 5-5 5H14c-3 0-5-2-5-5V13" fill="#fff8ec" ${S}/><path d="M12 8c-3 0-5 2-5 5h10c0-3-2-5-5-5z" fill="#e8d3a8" ${S}/><path d="M16 18h16M16 24h16M16 30h10" stroke="#7c5cff" stroke-width="3" stroke-linecap="round"/>`,
    phone: `<rect x="13" y="5" width="22" height="38" rx="5" fill="#2a2140" ${S}/><rect x="16" y="10" width="16" height="26" rx="2" fill="#7dd3fc"/><circle cx="24" cy="39.5" r="1.8" fill="#fff"/><path d="M19 15l5 4-5 4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    plus: `<circle cx="24" cy="24" r="17" fill="#3ee089" ${S}/><path d="M24 15v18M15 24h18" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>`,
    trash: `<path d="M12 14h24l-2 27H14z" fill="#e5e7eb" ${S}/><path d="M8 14h32M19 14V9h10v5" fill="none" ${S}/><path d="M19 20v15M24 20v15M29 20v15" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>`,
    pencil: `<path d="M10 38l2-9 20-20 7 7-20 20z" fill="#ffd23b" ${S}/><path d="M28 13l7 7" ${S}/><path d="M10 38l2-9 7 7z" fill="#f5f1ea" ${S}/>`,
    star: `<path d="M24 5l5.6 12 13 1.6-9.6 9 2.6 13L24 34l-11.6 6.6 2.6-13-9.6-9 13-1.6z" fill="#ffd23b" ${S}/>`,
    check: `<circle cx="24" cy="24" r="17" fill="#3ee089" ${S}/><path d="M15 25l6 6 12-13" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    reset: `<path d="M12 22a12 12 0 1 1 4 11" fill="none" ${S}/><path d="M6 16l6 7 7-5" fill="none" ${S}/>`,
    play: `<circle cx="24" cy="24" r="17" fill="#ff4d8d" ${S}/><path d="M20 16l12 8-12 8z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`,
    sword: `<path d="M34 6l8 0 0 8-20 20-8-8z" fill="#e5e7eb" ${S}/><path d="M12 24l12 12M10 32l6 6M8 40l4-4" ${S}/><path d="M12 24l12 12" stroke="#a16207" stroke-width="6" stroke-linecap="round" opacity="0"/>`,
  };
  window.ICON = (name, size = 26, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${P[name] || P.star}</svg>`;
})();
