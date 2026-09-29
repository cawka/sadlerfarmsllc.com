// Sadler Farms — HLS video, sound/quality controls, reveal-on-scroll, lightbox.
(function () {
  'use strict';

  var canMSE = window.Hls && window.Hls.isSupported();

  // Attach an HLS stream to a <video>. Uses hls.js where available (adaptive
  // quality with a manual override); falls back to native HLS (iOS Safari).
  function attach(video, opts) {
    if (video._attached) return video._hls;
    video._attached = true;
    var src = video.dataset.src;
    if (canMSE) {
      // Keep only a short buffer ahead of playback so the page doesn't prefetch
    // whole videos on a fast connection.
    var hls = new Hls(Object.assign({
      capLevelToPlayerSize: true, startLevel: -1,
      maxBufferLength: 10, maxMaxBufferLength: 20, backBufferLength: 10
    }, opts || {}));
      hls.loadSource(src);
      hls.attachMedia(video);
      video._hls = hls;
      return hls;
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src;
    return null;
  }

  function tryPlay(video) {
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked; poster stays */ });
  }

  // ---------------------------------------------------------- background loops
  // Silent loops only stream while on screen.
  var loops = [].slice.call(document.querySelectorAll('video.js-hls:not(.hero__video)'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduceMotion) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { attach(v); tryPlay(v); } else if (!v.paused) { v.pause(); }
      });
    }, { rootMargin: '200px 0px' });
    loops.forEach(function (v) { vio.observe(v); });
  }

  // ---------------------------------------------------------- hero film
  var film = document.querySelector('.hero__video');
  var bar = document.querySelector('.player-bar');
  if (film && bar) {
    var hls = attach(film, { capLevelToPlayerSize: false });
    if (!reduceMotion) tryPlay(film);

    var soundBtn = bar.querySelector('.js-sound');
    var quality = bar.querySelector('.js-quality');
    var fsBtn = bar.querySelector('.js-fullscreen');
    var hero = document.querySelector('.hero');

    function syncSound() {
      var on = !film.muted;
      soundBtn.setAttribute('aria-pressed', on);
      hero.classList.toggle('is-sound-on', on);
    }

    // Browsers only allow audio after a user gesture, so the film autoplays
    // muted and this button (plus "Watch the film") turns sound on.
    soundBtn.addEventListener('click', function () {
      film.muted = !film.muted;
      if (!film.muted && film.paused) tryPlay(film);
      syncSound();
    });

    // "Watch the film" plays in place: the hero clears its text, the film
    // restarts with sound, and Close (or the end of the film) restores it.
    var progress = hero.querySelector('.hero__progress span');
    function watch() {
      hero.classList.add('is-watching');
      hero.scrollIntoView({ behavior: 'smooth' });
      film.currentTime = 0;
      film.muted = false;
      film.loop = false;
      tryPlay(film);
      syncSound();
    }
    function stopWatching() {
      hero.classList.remove('is-watching');
      film.loop = true;
      film.muted = true;
      syncSound();
      tryPlay(film);
    }
    document.querySelectorAll('.js-watch').forEach(function (b) { b.addEventListener('click', watch); });
    hero.querySelector('.js-close-film').addEventListener('click', stopWatching);
    film.addEventListener('ended', stopWatching);
    film.addEventListener('timeupdate', function () {
      if (film.duration) progress.style.transform = 'scaleX(' + (film.currentTime / film.duration) + ')';
    });
    // Tapping the film while watching toggles pause.
    film.addEventListener('click', function () {
      if (!hero.classList.contains('is-watching')) return;
      if (film.paused) tryPlay(film); else film.pause();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hero.classList.contains('is-watching') && !document.fullscreenElement) stopWatching();
    });

    function requestFs() {
      var el = film;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
      else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen(); // iOS
    }
    fsBtn.addEventListener('click', requestFs);
    document.addEventListener('fullscreenchange', function () {
      film.controls = document.fullscreenElement === film;
    });

    // Quality menu: "Auto" + one entry per rendition.
    if (hls) {
      hls.on(Hls.Events.MANIFEST_PARSED, function (_, data) {
        data.levels
          .map(function (l, i) { return { h: l.height, i: i }; })
          .sort(function (a, b) { return b.h - a.h; })
          .forEach(function (l) {
            var o = document.createElement('option');
            o.value = l.i; o.textContent = l.h + 'p';
            quality.appendChild(o);
          });
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, function (_, data) {
        if (hls.autoLevelEnabled) {
          quality.options[0].textContent = 'Auto (' + hls.levels[data.level].height + 'p)';
        }
      });
      quality.addEventListener('change', function () {
        var lvl = parseInt(quality.value, 10);
        hls.currentLevel = lvl; // -1 = auto
        if (lvl === -1) hls.nextLevel = -1;
        else quality.options[0].textContent = 'Auto';
      });
    } else {
      quality.parentNode.hidden = true; // native HLS picks quality itself
    }
    syncSound();
  }

  // ---------------------------------------------------------- soundtracks
  // The film carries several alternate audio renditions (same narration, different
  // music). A hidden picker switches between them: tap the logo mark 5 times, or
  // open the page with ?soundtrack=<id>. The footer music credit follows along.
  (function () {
    var data = document.getElementById('soundtracks');
    var picker = document.querySelector('.soundtrack-picker');
    if (!data || !picker || !film) return;
    var tracks = JSON.parse(data.textContent);
    var list = picker.querySelector('.soundtrack-picker__list');
    var credit = document.querySelector('.site-footer__credit');
    var current = 0;

    function apply(i) {
      current = i;
      var hls = film._hls;
      if (hls && hls.audioTracks && hls.audioTracks.length > i) hls.audioTrack = i;
      else if (film.audioTracks && film.audioTracks.length > i) {  // native HLS (Safari)
        for (var k = 0; k < film.audioTracks.length; k++) film.audioTracks[k].enabled = (k === i);
      }
      if (credit) credit.innerHTML = tracks[i].credit;
      list.querySelectorAll('button').forEach(function (b, k) { b.setAttribute('aria-pressed', k === i); });
    }
    tracks.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.label;
      b.addEventListener('click', function () {
        apply(i);
        try { localStorage.setItem('sf-soundtrack', t.id); } catch (e) {}
      });
      list.appendChild(b);
    });

    var wanted = new URLSearchParams(location.search).get('soundtrack');
    if (!wanted) { try { wanted = localStorage.getItem('sf-soundtrack'); } catch (e) {} }
    var start = Math.max(0, tracks.findIndex(function (t) { return t.id === wanted; }));
    apply(start);
    if (film._hls) {
      film._hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function () { apply(current); });
    } else {
      film.addEventListener('loadedmetadata', function () { apply(current); });
    }

    var mark = document.querySelector('.nav__mark');
    var taps = 0, timer = null;
    if (mark) mark.addEventListener('click', function (e) {
      e.preventDefault();
      taps++;
      clearTimeout(timer);
      timer = setTimeout(function () { taps = 0; }, 1500);
      if (taps >= 5) { taps = 0; picker.hidden = !picker.hidden; }
    });
  })();

  // ---------------------------------------------------------- mobile menu
  var nav = document.querySelector('.nav');
  var toggle = nav && nav.querySelector('.nav__toggle');
  if (toggle) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open);
    };
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!nav.classList.contains('is-open')); });
    nav.querySelectorAll('.nav__links a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  // ---------------------------------------------------------- before / after
  // Pointer events drive dragging (tap or drag anywhere, mouse or touch);
  // the visually hidden range input keeps it keyboard-accessible.
  function initCompare(c) {
    var r = c.querySelector('.compare__range');
    var set = function (pct) {
      pct = Math.max(0, Math.min(100, pct));
      r.value = pct;
      c.style.setProperty('--pos', pct + '%');
      // Hide a side's label when that side is too narrow to hold it.
      c.classList.toggle('hide-before', pct < 20);
      c.classList.toggle('hide-after', pct > 80);
    };
    var fromEvent = function (e) {
      var box = c.getBoundingClientRect();
      set((e.clientX - box.left) / box.width * 100);
    };
    var dragging = false;
    c.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('.compare__expand')) return;
      dragging = true;
      c.setPointerCapture(e.pointerId);
      c.classList.add('is-dragging');
      fromEvent(e);
    });
    c.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    var end = function () { dragging = false; c.classList.remove('is-dragging'); };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    r.addEventListener('input', function () { set(parseFloat(r.value)); });
    set(parseFloat(r.value));
  }
  document.querySelectorAll('.compare').forEach(initCompare);

  // Expand: open a card's slider large in an overlay, with the bigger images.
  var modal = document.querySelector('.compare-modal');
  if (modal) {
    var body = modal.querySelector('.compare-modal__body');
    var lastFocus = null;
    var closeModal = function () {
      modal.hidden = true;
      body.innerHTML = '';
      document.documentElement.classList.remove('no-scroll');
      if (lastFocus) lastFocus.focus();
    };
    document.querySelectorAll('.compare__expand').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.closest('.compare');
        var big = src.cloneNode(true);
        big.className = 'compare compare--modal';
        big.removeAttribute('data-before-large');
        big.removeAttribute('data-after-large');
        var imgs = big.querySelectorAll('.compare__img');
        imgs[0].src = src.dataset.beforeLarge;
        imgs[1].src = src.dataset.afterLarge;
        imgs.forEach(function (i) { i.loading = 'eager'; });
        var ex = big.querySelector('.compare__expand');
        if (ex) ex.remove();
        big.querySelector('.compare__range').value = 50;
        body.appendChild(big);
        initCompare(big);
        lastFocus = btn;
        modal.hidden = false;
        document.documentElement.classList.add('no-scroll');
        modal.querySelector('.compare-modal__close').focus();
      });
    });
    modal.querySelector('.compare-modal__close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  }

  // ---------------------------------------------------------- reveal on scroll
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------------------------------------------------------- lightbox
  var lb = document.querySelector('.lightbox');
  if (lb) {
    var img = lb.querySelector('img');
    var close = function () { lb.hidden = true; img.removeAttribute('src'); };
    document.querySelectorAll('.gallery__item').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        img.src = a.href; img.alt = a.querySelector('img').alt;
        lb.hidden = false;
      });
    });
    lb.addEventListener('click', function (e) { if (e.target !== img) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
})();
