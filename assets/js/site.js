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

    document.querySelectorAll('.js-watch').forEach(function (b) {
      b.addEventListener('click', function () {
        film.currentTime = 0;
        film.muted = false;
        film.loop = false;
        tryPlay(film);
        syncSound();
        requestFs();
      });
    });
    film.addEventListener('ended', function () { film.loop = true; film.muted = true; syncSound(); tryPlay(film); });

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
