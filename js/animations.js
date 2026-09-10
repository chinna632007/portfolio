/* =========================================================
   animations.js - lightweight, professional motion
   ---------------------------------------------------------
   - Scroll reveal via IntersectionObserver
   - Staggered fade/slide-up
   - Scroll-spy for the generated portfolio navigation
   - Smooth in-preview anchor scrolling
   - Respects prefers-reduced-motion
   ========================================================= */
'use strict';

const Animations = (function () {
    let reduced = false;

    function prefersReduced() {
        try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch (e) { return false; }
    }

    /* Reveal elements inside `root` (or whole document). */
    function initReveal(root) {
        if (reduced) return null;
        const scope = root || document;
        const els = Array.prototype.slice.call(scope.querySelectorAll('.reveal:not(.visible)'));
        if (!('IntersectionObserver' in window)) {
            els.forEach((el) => el.classList.add('visible'));
            return null;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
        els.forEach((el) => observer.observe(el));
        return observer;
    }

    /* Animate numeric counters when visible. */
    function initCounters(root) {
        if (reduced) return;
        const scope = root || document;
        const els = Array.prototype.slice.call(scope.querySelectorAll('[data-count]'));
        if (!('IntersectionObserver' in window)) { els.forEach(countUp); return; }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) { countUp(entry.target); observer.unobserve(entry.target); }
            });
        }, { threshold: 0.5 });
        els.forEach((el) => observer.observe(el));
    }

    function countUp(el) {
        const target = parseInt(el.getAttribute('data-count'), 10) || 0;
        const dur = 900, start = null;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            el.textContent = String(Math.floor(p * target));
            if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
        };
        requestAnimationFrame(step);
    }

    /* Scroll-spy: highlight the portfolio nav item of the section in view. */
    function initPortfolioNav(scrollRoot, navEl) {
        if (!scrollRoot || !navEl || reduced) return;
        const sections = Array.prototype.slice.call(scrollRoot.querySelectorAll('section[id^="pf-"]'));
        if (!('IntersectionObserver' in window)) return;
        const seen = new Set();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = entry.target.id;
                if (entry.isIntersecting && !seen.has(id)) {
                    seen.add(id);
                    navEl.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
                }
            });
        }, { threshold: 0.4, rootMargin: '-20% 0px -30% 0px' });
        sections.forEach((s) => observer.observe(s));
    }

    /* Smooth click-to-section inside a scrollable preview container. */
    function bindSmoothAnchors(scrollRoot) {
        if (reduced) return;
        document.querySelectorAll('a[href^="#pf-"]').forEach((a) => {
            a.addEventListener('click', (e) => {
                const target = scrollRoot && scrollRoot.querySelector(a.getAttribute('href'));
                if (!target) return;
                e.preventDefault();
                scrollRoot.scrollTo({ top: target.offsetTop - 60, behavior: 'smooth' });
            });
        });
    }

    function init(root) {
        reduced = prefersReduced();
        initReveal(root);
        initCounters(root);
    }

    return { init: init, initReveal: initReveal, initCounters: initCounters, initPortfolioNav: initPortfolioNav, bindSmoothAnchors: bindSmoothAnchors };
})();

window.Animations = Animations;