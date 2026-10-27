/* ==========================================================================
   TRANSPORTES VALDEZ | Interacciones y animaciones
   Sin dependencias. Un solo bucle rAF coordina: scroll con inercia, escenas
   ligadas al scroll (zoom, apilado, flota horizontal, ruta), marquee y canvas.
   Respeta prefers-reduced-motion. Lecturas de layout agrupadas antes de escribir.
   ========================================================================== */
(() => {
    'use strict';

    const html = document.documentElement;
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const deskMQ = matchMedia('(min-width: 1024px)');

    /* Número de WhatsApp (formato internacional sin +). Único punto a editar. */
    const WA_NUMBER = '5215578033175';
    const waUrl = text => `https://wa.me/${WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

    /* ---------- Enlaces de WhatsApp con mensaje prellenado ---------- */
    $$('[data-wa]').forEach(a => { a.href = waUrl(a.dataset.wa); });
    const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ---------- Bloqueo de scroll (menú, lightbox) ---------- */
    const lockers = new Set();
    const isLocked = () => html.classList.contains('loading') || lockers.size > 0;
    const lockScroll = k => { lockers.add(k); html.classList.add('is-locked'); };
    const unlockScroll = k => { lockers.delete(k); if (!lockers.size) html.classList.remove('is-locked'); };

    /* ==========================================================================
       SCROLL CON INERCIA (solo puntero fino y sin reduced-motion)
       ========================================================================== */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const S = { y: 0, target: 0, vel: 0, max: 0, smooth: finePointer && !reduced, lastNative: 0 };

    const measureMax = () => { S.max = Math.max(0, html.scrollHeight - innerHeight); };

    if (S.smooth) {
        addEventListener('wheel', e => {
            if (e.ctrlKey || isLocked()) return;
            if (e.target.closest && e.target.closest('textarea, [data-native-scroll]')) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            let d = e.deltaY;
            if (e.deltaMode === 1) d *= 34; else if (e.deltaMode === 2) d *= innerHeight;
            S.target = clamp(S.target + d, 0, S.max);
        }, { passive: false });
    }

    function stepScroll(dt) {
        const native = scrollY;
        if (S.smooth && !isLocked()) {
            if (Math.abs(native - S.lastNative) > .5) {
                S.y = S.target = native;                       // cambio externo: barra, teclado, ancla
            } else {
                S.y = lerp(S.y, S.target, 1 - Math.pow(1 - .085, dt / 16.667));
                if (Math.abs(S.target - S.y) < .15) S.y = S.target;
                if (Math.abs(S.y - native) > .01) scrollTo(0, S.y);
            }
            S.lastNative = scrollY;
        } else {
            S.y = S.target = S.lastNative = native;
        }
    }

    function scrollToY(y) {
        y = clamp(y, 0, S.max);
        if (S.smooth) S.target = y;
        else scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    }

    document.addEventListener('click', e => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const t = document.getElementById(id.slice(1));
        if (!t) return;
        e.preventDefault();
        if (menuOpen) setMenu(false);
        scrollToY(id === '#inicio' ? 0 : t.getBoundingClientRect().top + S.y);
        history.replaceState(null, '', id);
    });

    /* ==========================================================================
       ESCENAS LIGADAS AL SCROLL
       ========================================================================== */
    const scenes = [];
    function scene(el, update) {
        if (!el) return null;
        const s = { el, update, visible: true, pending: false };
        new IntersectionObserver(([en]) => {
            s.visible = en.isIntersecting;
            if (!en.isIntersecting) { s.pending = true; dirty = true; }   // una última pasada fija el estado final (0 o 1)
        }, { rootMargin: '30% 0px 30% 0px' }).observe(el);
        scenes.push(s);
        return s;
    }
    const vh = () => innerHeight;

    /* ----- Nav ----- */
    const nav = $('#nav');
    const navProg = $('#nav-progress');
    let navAcc = 0, lastNavY = 0, lastSp = -1;
    function updateNav(y) {
        const d = y - lastNavY; lastNavY = y;
        if (Math.sign(d) !== Math.sign(navAcc)) navAcc = 0;
        navAcc += d;
        if (!menuOpen) {
            if (y < 120 || navAcc < -14) nav.classList.remove('is-hidden');
            else if (navAcc > 28) nav.classList.add('is-hidden');
        }
        const sp = S.max ? clamp(y / S.max) : 0;
        if (Math.abs(sp - lastSp) > .0004) { navProg.style.setProperty('--sp', sp.toFixed(4)); lastSp = sp; }
    }

    /* ----- Hero: salida suave + puntero ----- */
    const hero = $('#inicio');
    const heroCopy = $('.hero__copy');
    const heroReel = $('.reel');
    const heroGhost = $('.hero__ghost');
    scene(hero, rect => {
        const p = clamp(-rect.top / (rect.height * .8));
        if (!reduced) {
            heroCopy.style.transform = `translate3d(0, ${(p * 90).toFixed(1)}px, 0)`;
            heroCopy.style.opacity = (1 - p * 1.15).toFixed(3);
            if (heroReel) heroReel.style.translate = `0 ${(p * 70).toFixed(1)}px`;
            if (heroGhost) heroGhost.style.transform = `translate3d(0, ${(p * 140).toFixed(1)}px, 0)`;
        }
    });
    if (finePointer && !reduced) {
        hero.addEventListener('pointermove', e => {
            const r = hero.getBoundingClientRect();
            hero.style.setProperty('--px', (((e.clientX - r.left) / r.width - .5) * 2).toFixed(3));
            hero.style.setProperty('--py', (((e.clientY - r.top) / r.height - .5) * 2).toFixed(3));
        });
    }

    /* ----- Parallax genérico ----- */
    $$('[data-parallax]').forEach(el => {
        const k = parseFloat(el.dataset.parallax) || .1;
        scene(el.parentElement, () => {
            const r = el.parentElement.getBoundingClientRect();
            el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh() / 2) * k).toFixed(1)}px, 0)`;
        });
    });

    /* ----- Texto que se ilumina palabra por palabra ----- */
    const reading = $('[data-reading]');
    let rWords = [], rOn = 0;
    if (reading) {
        const text = reading.textContent.trim();
        reading.innerHTML = text.split(/\s+/).map(w => `<span class="rw">${w}</span>`).join(' ');
        rWords = $$('.rw', reading);
        scene(reading, rect => {
            const p = reduced ? 1 : clamp((vh() * .85 - rect.top) / (vh() * .5 + rect.height * .35));
            const n = Math.round(p * rWords.length);
            if (n === rOn) return;
            for (let i = Math.min(n, rOn); i < Math.max(n, rOn); i++) rWords[i].classList.toggle('on', i < n);
            rOn = n;
        });
    }

    /* ----- Imagen que se expande ----- */
    const zoom = $('[data-zoom]');
    if (zoom) {
        const over = $('.zoom__over', zoom);
        let lastKey = '';
        scene(zoom, rect => {
            if (reduced) return;
            const p = clamp(-rect.top / (rect.height - vh()));
            const e = easeIO(clamp(p / .62));
            const ov = clamp((p - .58) / .22);
            const key = `${e.toFixed(4)}|${ov.toFixed(3)}`;
            if (key === lastKey) return;
            lastKey = key;
            zoom.style.setProperty('--e', e.toFixed(4));
            zoom.style.setProperty('--o', clamp((e - .3) / .7).toFixed(3));
            zoom.style.setProperty('--ov', ov.toFixed(3));
            over.classList.toggle('is-on', ov > .85);
        });
    }

    /* ----- Tarjetas que se apilan ----- */
    const stack = $('.stack');
    if (stack) {
        const cards = $$('[data-stack]', stack);
        scene(stack, () => {
            const tops = cards.map(c => c.getBoundingClientRect().top);
            cards.forEach((c, i) => {
                if (i === cards.length - 1) return;
                const pinned = 64 + 22 + (i + 1) * 12;
                const p = clamp((vh() - tops[i + 1]) / (vh() - pinned));
                c.style.setProperty('--s', (1 - p * .055).toFixed(4));
                c.style.setProperty('--dim', (p * .55).toFixed(3));
            });
        });
    }

    /* ----- Flota: scroll vertical que mueve el carril horizontal ----- */
    const fleet = $('[data-fleet]');
    const fTrack = $('[data-fleet-track]');
    const fView = $('[data-fleet-view]');
    let fleetDist = 0, fleetOn = false;
    function measureFleet() {
        if (!fleet) return;
        fleetOn = deskMQ.matches && !reduced;
        html.classList.toggle('fleet-pin', fleetOn);
        if (!fleetOn) { fleet.style.height = ''; fTrack.style.transform = ''; fleetDist = 0; return; }
        fleetDist = Math.max(0, fTrack.scrollWidth - fView.clientWidth);
        fleet.style.height = `${Math.round(fleetDist * 1.05 + innerHeight)}px`;
    }
    scene(fleet, rect => {
        if (!fleetOn) return;
        const p = clamp(-rect.top / (rect.height - vh()));
        fTrack.style.transform = `translate3d(${(-p * fleetDist).toFixed(1)}px, 0, 0)`;
        fleet.style.setProperty('--fp', p.toFixed(4));
    });
    if (fleet && !fleetOn) {
        /* En móvil/tablet el carril es horizontal nativo: la barra sigue su scroll */
        fView.addEventListener('scroll', () => {
            const m = fView.scrollWidth - fView.clientWidth;
            fleet.style.setProperty('--fp', m ? (fView.scrollLeft / m).toFixed(4) : 0);
        }, { passive: true });
    }

    /* ----- Proceso: ruta que se dibuja ----- */
    const route = $('[data-route]');
    let nodeY = [];
    let routeD = 1;
    const steps = route ? $$('.step', route) : [];
    function measureRoute() {
        if (!route) return;
        nodeY = steps.map(s => s.offsetTop + 28);
        const lastY = nodeY[nodeY.length - 1];
        routeD = Math.max(1, lastY - 28);                          // de centro del 1er nodo al centro del último
        route.style.setProperty('--rd', `${routeD}px`);
        route.style.setProperty('--rb', `${route.offsetHeight - lastY}px`);
    }
    if (route) {
        let lastRp = -1;
        scene(route, rect => {
            const p = reduced ? 1 : clamp((vh() * .62 - rect.top - 28) / routeD);
            if (Math.abs(p - lastRp) > .0006) { route.style.setProperty('--rp', p.toFixed(4)); lastRp = p; }
            const truckY = 28 + p * routeD;
            steps.forEach((s, i) => s.classList.toggle('is-active', truckY >= (nodeY[i] || 0) - 4));
        });
    }

    /* ==========================================================================
       MARQUEE (único de la página): su velocidad responde al scroll
       ========================================================================== */
    const bandTrack = $('#band-track');
    const bandEl = $('#band');
    let bandX = 0, bandW = 0, bandVisible = true;
    if (bandEl) new IntersectionObserver(([e]) => { bandVisible = e.isIntersecting; }).observe(bandEl);
    function stepBand(dt) {
        if (!bandTrack || !bandVisible || reduced) return;
        const speed = .7 + S.vel * .28;
        bandX -= speed * (dt / 16.667);
        if (bandW) { if (bandX <= -bandW) bandX += bandW; if (bandX > 0) bandX -= bandW; }
        bandTrack.style.transform = `translate3d(${bandX.toFixed(2)}px, 0, 0)`;
    }

    /* ==========================================================================
       LÍNEAS DE VELOCIDAD (canvas): estelas cónicas como las del logo
       ========================================================================== */
    class SpeedLines {
        constructor(canvas, opts) {
            this.c = canvas; this.ctx = canvas.getContext('2d');
            this.o = Object.assign({ gold: '255,194,14', alt: '11,12,14', altK: .45, ratio: .62, density: 15000 }, opts);
            this.visible = true; this.lines = [];
            this.resize();
            new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(canvas);
            new ResizeObserver(() => this.resize()).observe(canvas);
        }
        seed(l, initial) {
            const z = Math.random();
            l.len = 50 + z * 230; l.th = .8 + z * 2.8; l.v = .7 + z * 3.4; l.a = .12 + z * .44;
            l.gold = Math.random() < this.o.ratio; l.slope = .02 + Math.random() * .05;
            l.y = Math.random() * this.h; l.x = initial ? Math.random() * (this.w + 300) - 150 : -l.len - Math.random() * 240;
            return l;
        }
        resize() {
            const r = this.c.getBoundingClientRect();
            this.dpr = Math.min(2, devicePixelRatio || 1);
            this.w = r.width; this.h = r.height;
            this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr));
            const n = clamp(Math.round(this.w * this.h / this.o.density), 16, 64);
            this.lines = Array.from({ length: n }, () => this.seed({}, true));
            if (reduced) this.draw();
        }
        step(dt, boost) {
            if (!this.visible || reduced) return;
            const k = dt / 16.667;
            for (const l of this.lines) {
                l.x += (l.v + boost * (.35 + l.v * .22)) * k;
                if (l.x - l.len > this.w + 20) this.seed(l, false);
            }
            this.draw();
        }
        draw() {
            const { ctx, dpr } = this;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, this.w, this.h);
            for (const l of this.lines) {
                ctx.fillStyle = l.gold ? `rgba(${this.o.gold},${l.a})` : `rgba(${this.o.alt},${(l.a * this.o.altK).toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(l.x, l.y - l.th / 2);
                ctx.lineTo(l.x, l.y + l.th / 2);
                ctx.lineTo(l.x - l.len, l.y + l.len * l.slope);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
    const heroLines = $('#hero-lines') ? new SpeedLines($('#hero-lines'), { ratio: .84, altK: .3 }) : null;
    const finaleLines = $('#finale-lines') ? new SpeedLines($('#finale-lines'), { alt: '255,255,255', altK: .3, ratio: .7, density: 12000 }) : null;

    /* ==========================================================================
       BUCLE PRINCIPAL
       ========================================================================== */
    let last = performance.now(), prevY = 0, sceneY = -1, dirty = true;
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.max(1, Math.min(64, now - last)); last = now;   // dt >= 1 evita división por cero en el primer cuadro
        stepScroll(dt);
        S.vel = lerp(S.vel, clamp((S.y - prevY) / dt * 16.667, -60, 60), .22);
        if (!isFinite(S.vel) || Math.abs(S.vel) < .01) S.vel = 0;
        prevY = S.y;

        updateNav(S.y);

        if (dirty || Math.abs(S.y - sceneY) > .01) {
            sceneY = S.y; dirty = false;
            const vis = scenes.filter(s => s.visible || s.pending);
            const rects = vis.map(s => s.el.getBoundingClientRect());      // todas las lecturas primero
            vis.forEach((s, i) => { s.update(rects[i]); s.pending = false; }); // luego las escrituras
        }
        stepBand(dt);
        const boost = clamp(Math.abs(S.vel) * .35, 0, 16);
        if (heroLines) heroLines.step(dt, boost);
        if (finaleLines) finaleLines.step(dt, boost);
    }

    function measureAll() {
        measureMax();
        if (bandTrack && bandTrack.firstElementChild) bandW = bandTrack.firstElementChild.getBoundingClientRect().width;
        measureFleet();
        measureRoute();
        measureMax();
        dirty = true;
    }
    let rzT;
    const onResize = () => { cancelAnimationFrame(rzT); rzT = requestAnimationFrame(measureAll); };
    addEventListener('resize', onResize);
    new ResizeObserver(onResize).observe(document.body);
    deskMQ.addEventListener('change', measureAll);

    /* ==========================================================================
       REVEAL (IntersectionObserver)
       ========================================================================== */
    function splitWords(el) {
        let i = 0;
        const walk = node => {
            Array.from(node.childNodes).forEach(ch => {
                if (ch.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    ch.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'w';
                        const inn = document.createElement('span'); inn.className = 'w-in';
                        inn.style.setProperty('--i', i++); inn.textContent = part;
                        w.appendChild(inn); frag.appendChild(w);
                    });
                    ch.replaceWith(frag);
                } else if (ch.nodeType === 1) walk(ch);
            });
        };
        walk(el);
    }
    $$('[data-split]').forEach(splitWords);
    $$('.tile').forEach((t, i) => t.style.setProperty('--ti', i % 4));

    const revealIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            en.target.classList.add('is-in');
            revealIO.unobserve(en.target);
        });
    }, { threshold: .14, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal], [data-split], .tile, .foot__word').forEach(el => revealIO.observe(el));

    /* ----- Contadores ----- */
    const counters = $$('[data-count]');
    const countIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            const el = en.target, to = +el.dataset.count, dur = 1500, t0 = performance.now();
            countIO.unobserve(el);
            if (reduced) { el.textContent = to; return; }
            const tick = n => {
                const p = clamp((n - t0) / dur);
                el.textContent = Math.round(to * easeOut(p));
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }, { threshold: .6 });
    counters.forEach(c => countIO.observe(c));

    /* ==========================================================================
       MENÚ MÓVIL
       ========================================================================== */
    const burger = $('#burger'), menu = $('#menu');
    let menuOpen = false;
    function setMenu(open) {
        menuOpen = open;
        menu.classList.toggle('is-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        menu.inert = !open;
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        if (open) { lockScroll('menu'); nav.classList.remove('is-hidden'); } else unlockScroll('menu');
    }
    burger.addEventListener('click', () => setMenu(!menuOpen));
    deskMQ.addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false); });

    /* ==========================================================================
       FAQ
       ========================================================================== */
    $$('.qa').forEach(qa => {
        const btn = $('.qa__q', qa);
        btn.addEventListener('click', () => {
            const open = qa.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
        });
    });

    /* ==========================================================================
       MICRO-INTERACCIONES (solo puntero fino)
       ========================================================================== */
    if (finePointer && !reduced) {
        $$('[data-magnetic]').forEach(btn => {
            btn.addEventListener('pointermove', e => {
                const r = btn.getBoundingClientRect();
                btn.style.setProperty('--tx', `${(((e.clientX - r.left) / r.width - .5) * 16).toFixed(1)}px`);
                btn.style.setProperty('--ty', `${(((e.clientY - r.top) / r.height - .5) * 12).toFixed(1)}px`);
            });
            btn.addEventListener('pointerleave', () => { btn.style.setProperty('--tx', '0px'); btn.style.setProperty('--ty', '0px'); });
        });
        $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', `${e.clientX - r.left}px`);
            el.style.setProperty('--my', `${e.clientY - r.top}px`);
        }));
    }

    /* ==========================================================================
       LIGHTBOX
       ========================================================================== */
    const lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap');
    const lbBtns = $$('[data-lb]');
    const lbFocusables = () => [$('#lb-close'), $('#lb-prev'), $('#lb-next')];
    let lbIndex = 0, lbLast = null, tStart = 0;
    function lbShow(i, animate) {
        lbIndex = (i + lbBtns.length) % lbBtns.length;
        const b = lbBtns[lbIndex], img = $('img', b);
        if (animate) lbImg.style.opacity = 0;
        const apply = () => { lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt; lbCap.textContent = b.dataset.caption || img.alt; };
        if (animate) setTimeout(apply, 180); else apply();
        lbImg.onload = () => { lbImg.style.opacity = 1; };
    }
    function lbOpen(i) {
        lbLast = document.activeElement;
        lbShow(i, false);
        lb.inert = false; lb.setAttribute('aria-hidden', 'false');
        lb.classList.add('is-open'); lockScroll('lb');
        $('#lb-close').focus({ preventScroll: true });
    }
    function lbClose() {
        lb.classList.remove('is-open'); lb.inert = true; lb.setAttribute('aria-hidden', 'true');
        unlockScroll('lb');
        if (lbLast) lbLast.focus({ preventScroll: true });
    }
    lbBtns.forEach((b, i) => b.addEventListener('click', () => lbOpen(i)));
    $('#lb-close').addEventListener('click', lbClose);
    $('#lb-prev').addEventListener('click', () => lbShow(lbIndex - 1, true));
    $('#lb-next').addEventListener('click', () => lbShow(lbIndex + 1, true));
    lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
    lb.addEventListener('touchstart', e => { tStart = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tStart;
        if (Math.abs(dx) > 55) lbShow(lbIndex + (dx < 0 ? 1 : -1), true);
    }, { passive: true });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (lb.classList.contains('is-open')) lbClose(); else if (menuOpen) setMenu(false); return; }
        if (lb.classList.contains('is-open')) {
            if (e.key === 'ArrowRight') lbShow(lbIndex + 1, true);
            else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1, true);
            else if (e.key === 'Tab') {
                const f = lbFocusables(), i = f.indexOf(document.activeElement);
                e.preventDefault();
                f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
            }
        } else if (menuOpen && e.key === 'Tab') {
            const f = $$('a, button', menu).concat(burger).filter(x => x.offsetParent !== null || x === burger);
            const i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
            else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
    });

    /* ==========================================================================
       FORMULARIO -> WHATSAPP
       ========================================================================== */
    const form = $('#quote-form');
    const statusEl = $('#form-status');
    if (form) {
        const dateInput = $('#f-date');
        if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);
        const setErr = (id, msg) => {
            const input = $('#' + id), err = $('#' + id + '-err');
            input.closest('.field').classList.toggle('is-invalid', !!msg);
            input.setAttribute('aria-invalid', msg ? 'true' : 'false');
            if (msg) input.setAttribute('aria-describedby', id + '-err'); else input.removeAttribute('aria-describedby');
            err.textContent = msg || '';
        };
        ['f-name', 'f-tel', 'f-serv'].forEach(id => $('#' + id).addEventListener('input', () => setErr(id, '')));
        form.addEventListener('submit', e => {
            e.preventDefault();
            const v = n => form.elements[n].value.trim();
            let ok = true;
            if (v('nombre').length < 2) { setErr('f-name', 'Escribe tu nombre para saber cómo dirigirnos a ti.'); ok = false; } else setErr('f-name', '');
            if (v('telefono') && v('telefono').replace(/\D/g, '').length < 8) { setErr('f-tel', 'Revisa tu teléfono, parece incompleto.'); ok = false; } else setErr('f-tel', '');
            if (!v('servicio')) { setErr('f-serv', 'Elige el servicio que necesitas.'); ok = false; } else setErr('f-serv', '');
            if (!ok) { const bad = $('.is-invalid input, .is-invalid select', form); if (bad) bad.focus(); return; }

            const lines = [`Hola, soy ${v('nombre')}. Quiero cotizar un servicio con Transportes Valdez.`, `Servicio: ${v('servicio')}`];
            if (v('origen')) lines.push(`Origen: ${v('origen')}`);
            if (v('destino')) lines.push(`Destino: ${v('destino')}`);
            if (v('fecha')) lines.push(`Fecha aproximada: ${v('fecha').split('-').reverse().join('/')}`);
            if (v('detalles')) lines.push(`Detalles: ${v('detalles')}`);
            if (v('telefono')) lines.push(`Mi teléfono: ${v('telefono')}`);
            const url = waUrl(lines.join('\n'));

            const w = window.open(url, '_blank', 'noopener');
            if (!w) location.href = url;
            statusEl.classList.add('is-ok');
            statusEl.innerHTML = `Listo, abrimos WhatsApp con tu mensaje. Si no se abrió, <a href="${url}" target="_blank" rel="noopener">toca aquí</a>.`;
        });
    }

    /* ==========================================================================
       LOADER
       ========================================================================== */
    function runLoader() {
        const loader = $('#loader'), pct = $('#loader-pct');
        const MIN = reduced ? 500 : 2400, HARD = 8000, t0 = performance.now();
        let shown = 0, ready = 0, finished = false;
        const need = 2;
        const mark = () => { ready++; };
        (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(mark, mark);
        if (document.readyState === 'complete') mark(); else addEventListener('load', mark, { once: true });

        function finish() {
            if (finished) return; finished = true;
            loader.style.setProperty('--lp', 100); pct.textContent = '100';
            loader.classList.add('is-leaving');
            setTimeout(() => {
                html.classList.remove('loading');
                html.classList.add('is-ready');
                scrollTo(0, 0); S.y = S.target = S.lastNative = 0;
                measureAll();
                if (location.hash.length > 1) {
                    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
                    if (t) setTimeout(() => scrollToY(t.getBoundingClientRect().top + S.y), 700);
                }
            }, 520);
            setTimeout(() => loader.classList.add('is-gone'), 1900);
        }
        function tick(now) {
            if (finished) return;
            const el = now - t0;
            const cap = ready >= need ? 100 : 88;
            const target = Math.min(cap, el / MIN * 100);
            shown = lerp(shown, target, .1);
            if (cap === 100 && el >= MIN && shown > 99.2) { finish(); return; }
            if (el > HARD) { finish(); return; }
            loader.style.setProperty('--lp', shown.toFixed(2));
            pct.textContent = Math.round(shown);
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /* ---------- Arranque ---------- */
    measureAll();
    requestAnimationFrame(now => { last = now; frame(now); });
    runLoader();
})();
