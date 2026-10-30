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
  // One finger (or the mouse) drags the divider. On the page, a pinch is left
  // to the browser (it zooms the whole page) and a double tap/click opens the
  // full-screen view. In the full-screen view, pinch, double tap, the scroll
  // wheel and the -/Fit/+ buttons zoom both images together; while zoomed,
  // dragging the handle still slides and dragging elsewhere pans.
  // The visually hidden range input keeps it keyboard-accessible.
  function initCompare(c) {
    var r = c.querySelector('.compare__range');
    var layers = c.querySelectorAll('.compare__layer');
    var handle = c.querySelector('.compare__handle');
    var modal = c.classList.contains('compare--modal');
    var s = 1, tx = 0, ty = 0, MAX = 5;
    var pts = new Map(), mode = null, pinch = null, startPos = 0, moved = false;
    // Second finger down: this is a pinch, not a slide -- undo any slide it started.
    var startPinch = function () {
      if (mode !== 'pinch') { set(startPos); c.classList.remove('is-dragging'); }
      mode = 'pinch'; moved = true;
    };
    var lastTap = 0, tapTimer = null, downX = 0, downY = 0, lastX = 0, lastY = 0;

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
    var apply = function () {
      var w = c.clientWidth, h = c.clientHeight;
      var mx = (w * s - w) / 2, my = (h * s - h) / 2;
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
      var t = s > 1 ? 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')' : '';
      layers.forEach(function (l) { l.style.transform = t; });
      c.classList.toggle('is-zoomed', s > 1);
    };
    // Zoom to ns keeping the picture point under (cx, cy) in place.
    var zoomAt = function (ns, cx, cy) {
      ns = Math.min(MAX, Math.max(1, ns));
      if (ns < 1.02) ns = 1;
      var box = c.getBoundingClientRect();
      var px = cx - box.left - box.width / 2, py = cy - box.top - box.height / 2;
      tx = px - (px - tx) * ns / s;
      ty = py - (py - ty) * ns / s;
      s = ns; apply();
    };
    var onHandle = function (e) {
      return Math.abs(e.clientX - handle.getBoundingClientRect().left) < 30;
    };

    c.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('.compare__expand, .compare__zoom')) return;
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) {
        moved = false; downX = lastX = e.clientX; downY = lastY = e.clientY;
        startPos = parseFloat(r.value);
        // Grabbing the handle slides at once. Elsewhere the divider waits: a drag
        // slides, a single tap jumps there (after the double-tap window), and a
        // double tap only zooms.
        if (onHandle(e)) { mode = 'slide'; c.classList.add('is-dragging'); }
        else if (s > 1) { mode = 'pan'; c.classList.add('is-panning'); }
        else mode = 'pending';
      } else if (pts.size === 2) {
        startPinch();                       // the zoom itself is driven by the touch events below
      }
    });
    c.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
      if (mode === 'pending' && moved) { mode = 'slide'; c.classList.add('is-dragging'); }
      if (mode === 'pan') {
        tx += e.clientX - lastX; ty += e.clientY - lastY; apply();
      } else if (mode === 'slide') {
        fromEvent(e);
      }
      lastX = e.clientX; lastY = e.clientY;
    });
    var end = function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size) {                       // one finger left after a pinch: keep panning with it
        if (mode === 'pinch') { var q = pts.values().next().value; lastX = q[0]; lastY = q[1]; mode = s > 1 ? 'pan' : null; }
        return;
      }
      c.classList.remove('is-dragging', 'is-panning');
      var was = mode; mode = null;
      if (moved || e.type === 'pointercancel' || was === 'pinch') return;
      var now = Date.now(), x = e.clientX, y = e.clientY;
      clearTimeout(tapTimer);
      if (now - lastTap < 350) {            // double tap / double click: zoom (or open full screen)
        lastTap = 0;
        var ex = c.querySelector('.compare__expand');
        if (!modal) { if (ex) ex.click(); }
        else if (s > 1) { s = 1; tx = ty = 0; apply(); } else zoomAt(2.5, x, y);
      } else {
        lastTap = now;
        if (was === 'pending' || was === 'pan')
          tapTimer = setTimeout(function () { fromEvent({ clientX: x }); }, 350);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', function (e) {
      if (!modal) return;                   // on the page, wheel and pinch belong to the page
      e.preventDefault();
      zoomAt(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
    }, { passive: false });
    c.querySelectorAll('.compare__zoom [data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = c.getBoundingClientRect(), z = b.dataset.zoom;
        if (z === 'fit') { s = 1; tx = ty = 0; apply(); }
        else zoomAt(s * (z === 'in' ? 1.6 : 1 / 1.6), box.left + box.width / 2, box.top + box.height / 2);
      });
    });
    // Pinch comes from touch events: iOS Safari may cancel pointer events for a
    // two-finger gesture it treats as a scroll. preventDefault while two fingers
    // are down keeps the browser from scrolling or zooming the page instead.
    var pinchInfo = function (e) {
      var a = e.touches[0], b = e.touches[1];
      return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
               mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    };
    if (modal) c.addEventListener('touchstart', function (e) {
      if (e.touches.length < 2) return;
      e.preventDefault();
      startPinch();
      pinch = pinchInfo(e); pinch.s = s;
    }, { passive: false });
    if (modal) c.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length < 2) return;
      e.preventDefault();
      var q = pinchInfo(e);
      tx += q.mx - pinch.mx; ty += q.my - pinch.my;   // two-finger pan
      pinch.mx = q.mx; pinch.my = q.my;
      zoomAt(pinch.s * q.d / pinch.d, q.mx, q.my);
    }, { passive: false });
    var touchEnd = function (e) { if (e.touches.length < 2) pinch = null; };
    c.addEventListener('touchend', touchEnd);
    c.addEventListener('touchcancel', touchEnd);
    if (modal) ['gesturestart', 'gesturechange'].forEach(function (t) { c.addEventListener(t, function (e) { e.preventDefault(); }); });
    window.addEventListener('resize', apply);
    r.addEventListener('input', function () { set(parseFloat(r.value)); });
    set(parseFloat(r.value));
    apply();
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
  // Pinch / scroll-wheel / double-tap to zoom, drag to pan, +/−/Fit buttons.
  var lb = document.querySelector('.lightbox');
  if (lb) {
    var stage = lb.querySelector('.lightbox__stage');
    var img = lb.querySelector('img');
    var s = 1, tx = 0, ty = 0, maxS = 4;
    var pts = new Map(), pinch = null, moved = false, lastTap = 0, lastX = 0, lastY = 0, downX = 0, downY = 0;

    var apply = function () {
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      lb.classList.toggle('is-zoomed', s > 1.01);
    };
    var clamp = function () {
      var mx = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
      var my = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    };
    // Zoom to scale ns keeping the image point under (cx, cy) in place.
    var zoomAt = function (ns, cx, cy) {
      ns = Math.min(maxS, Math.max(1, ns));
      var r = stage.getBoundingClientRect();
      var px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
      tx = px - (px - tx) * ns / s;
      ty = py - (py - ty) * ns / s;
      s = ns; clamp(); apply();
    };
    var fit = function () { s = 1; tx = 0; ty = 0; apply(); };
    var center = function () { var r = stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    var setMax = function () {
      // Allow zooming to about 2x the image's real pixels, at least 4x.
      maxS = img.offsetWidth ? Math.min(12, Math.max(4, 2 * img.naturalWidth / img.offsetWidth)) : 4;
    };

    var open = function (a) {
      fit();
      img.onload = setMax;
      img.src = a.href; img.alt = a.querySelector('img').alt;
      lb.hidden = false;
      document.documentElement.style.overflow = 'hidden';
    };
    var close = function () {
      lb.hidden = true; img.removeAttribute('src'); pts.clear(); pinch = null;
      document.documentElement.style.overflow = '';
    };
    document.querySelectorAll('.gallery__item, [data-lightbox]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(a); });
    });

    stage.addEventListener('pointerdown', function (e) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { moved = false; lastX = downX = e.clientX; lastY = downY = e.clientY; }
      if (pts.size === 2) {
        var p = Array.from(pts.values());
        pinch = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), s: s,
                  mx: (p[0][0] + p[1][0]) / 2, my: (p[0][1] + p[1][1]) / 2 };
        moved = true;
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size >= 2) {
        var p = Array.from(pts.values());
        var mx = (p[0][0] + p[1][0]) / 2, my = (p[0][1] + p[1][1]) / 2;
        tx += mx - pinch.mx; ty += my - pinch.my;    // two-finger pan
        pinch.mx = mx; pinch.my = my;
        zoomAt(pinch.s * Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) / pinch.d, mx, my);
      } else if (pts.size === 1) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        moved = moved || Math.hypot(e.clientX - downX, e.clientY - downY) > 6;
        if (s > 1) { tx += dx; ty += dy; clamp(); apply(); lb.classList.add('is-dragging'); }
      }
    });
    var up = function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      lb.classList.remove('is-dragging');
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { var p = pts.values().next().value; lastX = p[0]; lastY = p[1]; }
      if (pts.size || moved || e.type === 'pointercancel') return;
      var now = Date.now();
      if (now - lastTap < 320) {                    // double tap / double click
        lastTap = 0;
        if (s > 1.01) fit(); else zoomAt(Math.min(maxS, 2.5), e.clientX, e.clientY);
      } else {
        lastTap = now;
        if (e.target !== img && s <= 1.01) close();  // tap outside the picture
      }
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels step larger.
      zoomAt(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
    }, { passive: false });
    // Safari's own pinch gesture events: keep it from zooming the page underneath.
    ['gesturestart', 'gesturechange'].forEach(function (t) { lb.addEventListener(t, function (e) { e.preventDefault(); }); });

    lb.querySelector('.lightbox__close').addEventListener('click', close);
    lb.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = center(), z = b.dataset.zoom;
        if (z === 'fit') fit(); else zoomAt(s * (z === 'in' ? 1.6 : 1 / 1.6), c[0], c[1]);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      var c = center();
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomAt(s * 1.6, c[0], c[1]);
      else if (e.key === '-') zoomAt(s / 1.6, c[0], c[1]);
      else if (e.key === '0') fit();
    });
    window.addEventListener('resize', function () { if (!lb.hidden) { setMax(); clamp(); apply(); } });
  }
})();
