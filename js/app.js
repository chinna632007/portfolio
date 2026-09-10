/* =========================================================
   app.js - shared helpers, storage, toast + view router
   Resume To Portfolio Generator
   ---------------------------------------------------------
   IMPORTANT DATA RULE:
   The uploaded resume data is NEVER rewritten, summarized or
   re-ordered. Every section title and every line of content is
   preserved exactly and simply re-presented with a nicer look.
   ========================================================= */
'use strict';

const App = {
    KEYS: { DATA: 'rtpg_data', CUSTOM: 'rtpg_custom' },

    /* ---------- extracted resume data ---------- */
    saveData(data) { localStorage.setItem(this.KEYS.DATA, JSON.stringify(data)); },
    getData() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.DATA)); }
        catch (e) { return null; }
    },
    clearData() { localStorage.removeItem(this.KEYS.DATA); },

    /* ---------- customization ---------- */
    defaultCustom() {
        return { theme: 'light', color: 'indigo', layout: 'modern', hidden: [] };
    },
    saveCustom(c) { localStorage.setItem(this.KEYS.CUSTOM, JSON.stringify(c)); },
    getCustom() {
        try { return Object.assign(this.defaultCustom(), JSON.parse(localStorage.getItem(this.KEYS.CUSTOM)) || {}); }
        catch (e) { return this.defaultCustom(); }
    },

    /* ---------- utilities ---------- */
    escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    titleCase(str) {
        return String(str || '').replace(/_/g, ' ').split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    },

    toast(message, type) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const t = document.createElement('div');
        t.className = 'toast ' + (type || 'info');
        t.textContent = message;
        container.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 350);
        }, 3600);
    },

    /* ---------- view routing ---------- */
    show(id) {
        document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /* ---------- bootstrap ---------- */
    init() {
        const navbar = document.getElementById('appNav');
        if (navbar) {
            const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 10);
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }
        window.dispatchEvent(new CustomEvent('app:ready'));
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;