(() => {
  const root = document.documentElement;

  /* Light / dark switch (remembered) */
  let saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
  root.setAttribute('data-bs-theme', saved || 'dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-bs-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  /* Keep the sticky sub-nav exactly under the main nav, on every screen size */
  const nav = document.getElementById('mainNav');
  const setNavH = () => root.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  setNavH();
  if ('ResizeObserver' in window) new ResizeObserver(setNavH).observe(nav);
  addEventListener('resize', setNavH);

  /* Image fallbacks: missing logo -> wordmark, missing DAW logo -> initial badge */
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.classList.contains('logo-img')) {
      img.outerHTML = '<span class="wordmark"><i class="bi bi-soundwave"></i>Gainsunc</span>';
      setNavH();
    } else if (img.dataset.initial) {
      img.outerHTML = `<span class="ini">${img.dataset.initial}</span>`;
    } else if (img.closest('.photo')) {
      img.remove();
    }
  }, true);

  /* DAW marquee: one small continuous line, duplicated for a seamless loop.
     Put logos in images/daws/ using the file names below. */
  const daws = [
    ['FL Studio', '.flp', 'fl-studio'], ['Ableton Live', '.als', 'ableton'], ['Logic Pro', '.logicx', 'logic'],
    ['Cubase', '.cpr', 'cubase'], ['Studio One', '.song', 'studio-one'], ['Pro Tools', '.ptx', 'pro-tools'],
    ['Reaper', '.rpp', 'reaper'], ['Reason', '.reason', 'reason'], ['Bitwig', '.bwproject', 'bitwig'], ['And more', '.zip, .rar', 'more']
  ];
  const html = daws.map(([n, ext, f]) =>
    `<div class="daw"><img src="images/daws/${f}.png" alt="${n} logo" data-initial="${n[0]}"><b>${n}</b><small>${ext}</small></div>`).join('');
  document.getElementById('track').innerHTML = html + html;

  /* Scroll reveal from the sides + counters */
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    en.target.querySelectorAll('[data-count]').forEach(count);
    io.unobserve(en.target);
  }), { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

  function count(el) {
    const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
    const fmt = v => (Number.isInteger(target) ? Math.round(v).toLocaleString() : v.toFixed(1)) + suffix;
    const t0 = performance.now();
    const tick = t => {
      const p = Math.min((t - t0) / 1500, 1);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3))) + (target === 50000 ? '+' : '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* Pricing: monthly / yearly switch */
  const bill = document.getElementById('bill');
  if (bill) bill.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const yearly = btn.dataset.p === 'y';
    bill.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.price').forEach(p => {
      p.querySelector('b').textContent = yearly ? p.dataset.y : p.dataset.m;
      p.querySelector('small').textContent = yearly ? '/year' : '/month';
    });
  });

  /* Sub-nav: scroll tabs highlight the section you are in */
  const tabs = [...document.querySelectorAll('.subnav .tab[data-spy]')];
  const spy = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.spy === en.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  tabs.forEach(t => { const s = document.getElementById(t.dataset.spy); if (s) spy.observe(s); });
  tabs.forEach(t => t.addEventListener('click', () => tabs.forEach(x => x.classList.toggle('active', x === t))));

  /* Close the mobile menu after choosing a link */
  document.querySelectorAll('#navMenu a[href^="#"]:not(.dropdown-toggle)').forEach(a =>
    a.addEventListener('click', () => bootstrap.Collapse.getInstance(document.getElementById('navMenu'))?.hide()));

  document.getElementById('yr').textContent = new Date().getFullYear();
})();

/* ===== Ambient modes: generated calm music + midnight / daylight look ===== */
(() => {
  const root = document.documentElement, dock = document.getElementById('moodCard');
  const btns = [...dock.querySelectorAll('.seg-btn')], vol = document.getElementById('moodVol');
  const SETS = {
    midnight: { chords: [[45,52,57,60,64],[41,48,53,57,60],[48,55,59,64],[43,50,55,59,62]], arp: [64,67,71,74,76], cutoff: 900, wave: 'sine' },
    daylight: { chords: [[48,55,60,64,67],[43,50,55,59,62],[45,52,57,60,64],[41,48,53,57,60]], arp: [72,76,79,83,84], cutoff: 2600, wave: 'triangle' }
  };
  let ctx, master, lp, timer, step = 0, mood = null, playing = false;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12), level = () => parseFloat(vol.value) * 0.9;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    const dl = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = .45; fb.gain.value = .4; wet.gain.value = .5;
    lp.connect(master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master); master.connect(ctx.destination);
  }
  function note(m, t, dur, v, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + .1);
  }
  function chord() {
    const s = SETS[mood], c = s.chords[step % s.chords.length], t = ctx.currentTime + .05;
    c.forEach(m => note(m, t, 7, .05, s.wave));
    for (let i = 0; i < 4; i++) note(s.arp[(step + i * 2) % s.arp.length], t + 1 + i * 1.4, 2.6, .035, 'sine');
    step++;
  }
  function play(m) {
    if (!ctx) init();
    ctx.resume(); mood = m; step = 0; lp.frequency.value = SETS[m].cutoff;
    clearInterval(timer); chord(); timer = setInterval(chord, 6000);
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 2);
    playing = true;
  }
  function pause() {
    if (!ctx) return;
    clearInterval(timer); master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1); playing = false;
  }
  function paint() {
    btns.forEach(b => b.setAttribute('aria-pressed', playing && b.dataset.mood === mood));
    dock.classList.toggle('playing', playing);
  }
  btns.forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.mood;
    if (playing && mood === m) { pause(); paint(); return; }
    root.dataset.mood = m;                                   // colour + light for the whole page
    root.setAttribute('data-bs-theme', m === 'midnight' ? 'dark' : 'light');
    play(m); paint();
  }));
  vol.addEventListener('input', () => { if (playing) master.gain.linearRampToValueAtTime(level(), ctx.currentTime + .2); });
  // manual light/dark switch hands control back to the normal theme
  document.getElementById('themeToggle').addEventListener('click', () => { delete root.dataset.mood; pause(); paint(); });
  document.getElementById('moodMin').addEventListener('click', () => dock.classList.toggle('min'));
  if (innerWidth < 576) dock.classList.add('min');
})();

/* ===== Vault card: waveform + preview animation ===== */
(() => {
  const wave = document.getElementById('wave'), btn = document.getElementById('vaultPlay');
  if (!wave || !btn) return;
  const hs = [18,30,42,26,44,34,20,38,46,28,16,36,44,30,22,40,34,18,42,26,38,24];
  wave.innerHTML = hs.map((h, i) => `<i style="--h:${h}px;--dl:${(i % 7) * .09}s"></i>`).join('');
  btn.addEventListener('click', () => {
    const player = btn.closest('.player'), on = player.classList.toggle('on');
    btn.innerHTML = `<i class="bi bi-${on ? 'pause' : 'play'}-fill"></i>`;
  });
})();