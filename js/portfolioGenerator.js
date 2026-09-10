/* =========================================================
   portfolioGenerator.js - dynamic portfolio renderer
   ---------------------------------------------------------
   Renders the analyzed resume sections in their ORIGINAL order
   using their EXACT ORIGINAL titles and EXACT content lines.
   Each section type only changes the VISUAL PRESENTATION
   (cards / timeline / chips / paragraphs). FALLBACK: any
   unrecognized section is rendered as a generic card section
   keeping the original title + text. No data is rewritten.
   ========================================================= */
'use strict';

const PortfolioGenerator = (function () {

    function esc(value) { return window.App ? App.escapeHtml(value) : String(value == null ? '' : value); }

    /* Clean url for links; returns '' if empty. */
    function linkHref(v) {
        const s = String(v || '').trim();
        if (!s) return '';
        return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
    }

    /* ---------- map a section type to a visual template ---------- */
    function templateFor(type) {
        switch (type) {
            case 'summary': return 'text';
            case 'skills': return 'chips';
            case 'languages': return 'chips';
            case 'hobbies': return 'chips';
            case 'contact': return 'chips';
            default: return 'entries';
        }
    }

    /* Group raw content lines into visual entries.
       Entries split on blank lines and on bullet markers.
       The text of every line is preserved exactly. */
    function groupEntries(lines) {
        const entries = [];
        let current = [];
        lines.forEach((line) => {
            const bullet = line.match(/^[\u2022\-*·◦▪■]\s?(.*)/);
            const clean = bullet ? bullet[1].trim() : line.trim();
            if (!clean) {
                if (current.length) { entries.push(current); current = []; }
                return;
            }
            if (bullet && current.length) { entries.push(current); current = []; }
            current.push(clean);
        });
        if (current.length) entries.push(current);
        return entries.filter((e) => e.length);
    }

    /* Split a text blob into chips (skills / languages / hobbies). */
    function tokenize(blob) {
        const tokens = [];
        blob.forEach((line) => {
            line.split(/[,;|\u2022\r\n]+/).forEach((part) => {
                const t = part.replace(/^[\-•·*\s]+/, '').replace(/[\s\-•·*]+$/, '').trim();
                if (t) tokens.push(t);
            });
        });
        return tokens;
    }

    function sectionId(idx, title) {
        return 'pf-s' + idx + '-' + normalizeSlug(title);
    }
    function normalizeSlug(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function titleShort(s) {
        const words = String(s || '').split(/\s+/);
        return words.length > 3 ? words.slice(0, 3).join(' ') + '…' : s;
    }
/* ---------- render a single resume section (visual transform only) ---------- */
    function renderSectionContent(section) {
        const type = templateFor(section.type);
        const html = [];

        if (type === 'chips') {
            const tokens = tokenize(section.lines);
            if (tokens.length) {
                html.push('<div class="pf-chips">');
                tokens.forEach((t) => html.push('<span class="pf-chip">' + esc(t) + '</span>'));
                html.push('</div>');
            }
        } else if (type === 'text') {
            section.lines.forEach((line) => html.push('<p class="pf-text">' + esc(line) + '</p>'));
        } else {
            // Entries (call it "timeline-style cards") - each entry is a card.
            const entries = groupEntries(section.lines);
            html.push('<div class="pf-timeline">');
            entries.forEach((entry) => {
                if (!entry.length) return;
                html.push('<div class="pf-entry">');
                html.push('<div class="pf-entry-dot"></div>');
                entry.forEach((line) => html.push('<p class="pf-text pf-lines">' + esc(line) + '</p>'));
                html.push('</div>');
            });
            html.push('</div>');
        }
        return html.join('');
    }

    function renderSectionBlock(sec, idx) {
        const custom = arguments[2] || {};
        const hidden = (custom.hidden) || [];
        if (hidden.indexOf(sec.original) !== -1) return '';
        const id = sectionId(idx, sec.original);
        /* Sections detected BEFORE the first heading (the name / contact
           header block) have no original title - render their content
           without inventing a heading for them. */
        const headHtml = sec.original
            ? '<div class="pf-section-head">' +
                '<span class="pf-index">' + String(idx + 1).padStart(2, '0') + '</span>' +
                '<h2 class="pf-section-title">' + esc(sec.original) + '</h2>' +
            '</div>'
            : '';
        return '<section class="pf-section reveal" id="' + id + '">' +
            headHtml +
            '<div class="pf-section-body">' + renderSectionContent(sec) + '</div>' +
        '</section>';
    }

    function visibleSections(data, custom) {
        const hidden = (custom && custom.hidden) || [];
        return (data.sections || []).filter((s) => hidden.indexOf(s.original) === -1);
    }
/* ---------- home / hero section (only data that exists in resume) ---------- */
    function buildHero(data, custom) {
        const p = data.personalInfo || {};
        const intro = (data.sections || []).find((s) => s.type === 'summary');
        const introText = intro && intro.lines.length ? intro.lines.join(' ') : '';

        let contact = '';
        const pills = [];
        if (p.email) pills.push('<a class="pf-pill" href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>');
        if (p.phone) pills.push('<a class="pf-pill" href="tel:' + esc(p.phone.replace(/[^+\d]/g, '')) + '">' + esc(p.phone) + '</a>');
        if (p.location) pills.push('<span class="pf-pill">' + esc(p.location) + '</span>');
        if (p.linkedin) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.linkedin)) + '">LinkedIn</a>');
        if (p.github) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.github)) + '">GitHub</a>');
        if (p.website) pills.push('<a class="pf-pill" target="_blank" rel="noopener" href="' + esc(linkHref(p.website)) + '">' + esc(p.website) + '</a>');
        if (pills.length) contact = '<div class="pf-hero-pills">' + pills.join('') + '</div>';

        let nameBlock = '';
        if (p.name) nameBlock += '<h1 class="pf-hero-name reveal">' + esc(p.name) + '</h1>';
        if (p.title) nameBlock += '<p class="pf-hero-role reveal d-1">' + esc(p.title) + '</p>';
        if (introText) nameBlock += '<p class="pf-hero-intro reveal d-2">' + esc(introText) + '</p>';

        return '<div class="pf-hero">' +
            '<div class="pf-hero-bg"></div>' +
            '<div class="pf-hero-inner">' + nameBlock + contact + '</div>' +
        '</div>';
    }

    /* ---------- dynamic navigation (Home + visible sections + Contact) ---------- */
    function buildNav(data, custom) {
        const items = [];
        items.push('<li><a href="#pf-home" class="active">Home</a></li>');
        visibleSections(data, custom).forEach((s, i) => {
            if (!s.original) return; // untitled header block: content still renders, just no nav link
            const id = sectionId(i, s.original);
            items.push('<li><a href="#' + id + '">' + esc(titleShort(s.original)) + '</a></li>');
        });
        return '<nav class="pf-nav"><div class="pf-nav-inner"><ul>' + items.join('') + '</ul></div></nav>';
    }

    /* ---------- full preview HTML ---------- */
    function buildPortfolioHtml(data, custom) {
        custom = custom || {};
        const parts = [];
        parts.push('<div class="pf-root pf-' + (custom.theme || 'light') + ' pf-' + (custom.color || 'indigo') + ' pf-' + (custom.layout || 'modern') + '">');
        parts.push(buildNav(data, custom));
        parts.push('<div class="pf-home" id="pf-home">' + buildHero(data, custom) + '</div>');
        visibleSections(data, custom).forEach((s, i) => parts.push(renderSectionBlock(s, i, custom)));
        parts.push('<footer class="pf-footer"><p>&copy; Made from your resume &middot; ' + esc((data.personalInfo || {}).name || 'Portfolio') + '</p></footer>');
        parts.push('</div>');
        return parts.join('');
    }
/* ---------- content-integrity validation ---------- */
    function validate(data) {
        const report = { total: 0, empty: [], missingFromNav: [] };
        const s = (data && data.sections) || [];
        report.total = s.length;
        s.forEach((sec) => {
            if (!sec.lines.length) report.empty.push(sec.original);
        });
        return report;
    }

    /* ---------- download a standalone HTML file ---------- */
    function buildStandalone(data, custom) {
        custom = custom || {};
        const body = buildPortfolioHtml(data, custom);
        const name = ((data.personalInfo || {}).name || 'portfolio').toLowerCase().replace(/\s+/g, '-');
        return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>' + esc((data.personalInfo || {}).name || 'Portfolio') + ' &middot; Portfolio</title>' +
            '<style>' + STANDALONE_CSS + '</style></head><body>' + body +
            '<script>document.addEventListener("DOMContentLoaded",function(){' +
            'try{var r=document.querySelector(".pf-preview-scroll")||document.body;' +
            'var s=document.querySelector(".pf-preview-scroll");' +
            'document.querySelectorAll("a[href^=\\"#pf-\\"]").forEach(function(a){a.addEventListener("click",function(e){' +
            'var t=document.querySelector(a.getAttribute("href"));if(!t){return;}e.preventDefault();' +
            'var o=(s||document.documentElement);' +
            '(s?o.scrollTo({top:t.offsetTop-70,behavior:"smooth"}):window.scrollTo({top:t.offsetTop-70,behavior:"smooth"}));});});' +
            '}catch(e){}});<\/script></body></html>';
    }

    /* Compact portfolio CSS bundled into standalone downloads so the file
       opens anywhere. Scope is identical to the live preview styles. */
    const STANDALONE_CSS = 'body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,sans-serif;}' +
        '.pf-root{--pf-bg:#f8fafc;--pf-surface:#fff;--pf-text:#0f172a;--pf-muted:#64748b;--pf-border:#e2e8f0;--pf-accent:#6366f1;}' +
        '.pf-root.pf-dark{--pf-bg:#0b1220;--pf-surface:#141c30;--pf-text:#e2e8f0;--pf-muted:#94a3b8;--pf-border:#243046;}' +
        '.pf-root.pf-light{--pf-accent:#6366f1;}.pf-root.pf-indigo{--pf-accent:#6366f1;}' +
        '.pf-root.pf-blue{--pf-accent:#3b82f6;}.pf-root.pf-emerald{--pf-accent:#10b981;}' +
        '.pf-root.pf-rose{--pf-accent:#f43f5e;}.pf-root.pf-amber{--pf-accent:#f59e0b;}' +
        '.pf-root.pf-purple{--pf-accent:#8b5cf6;}' +
        '.pf-nav{position:sticky;top:0;z-index:5;background:var(--pf-surface);border-bottom:1px solid var(--pf-border);}' +
        '.pf-nav ul{display:flex;flex-wrap:wrap;gap:6px;padding:12px 18px;}' +
        '.pf-nav a{color:var(--pf-muted);text-decoration:none;padding:6px 12px;border-radius:999px;font-size:.85rem;}' +
        '.pf-nav a.active,.pf-nav a:hover{background:var(--pf-accent);color:#fff;}' +
        '.pf-hero{padding:64px 20px;background:linear-gradient(135deg,var(--pf-surface),#0b1220);text-align:center;}' +
        '.pf-hero h1{font-size:2.4rem;background:linear-gradient(90deg,var(--pf-accent),#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent;}' +
        '.pf-hero-role{color:var(--pf-muted);font-size:1.1rem;margin-top:8px;} .pf-hero-intro{color:var(--pf-muted);max-width:720px;margin:14px auto 0;}' +
        '.pf-hero-pills{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;}' +
        '.pf-pill{display:inline-block;padding:7px 14px;border-radius:999px;border:1px solid var(--pf-border);color:var(--pf-text);text-decoration:none;font-size:.8rem;}' +
        '.pf-section{padding:40px 20px;max-width:900px;margin:0 auto;}' +
        '.pf-section-head{display:flex;align-items:center;gap:12px;}' +
        '.pf-index{font-size:.8rem;color:var(--pf-accent);font-weight:700;}' +
        '.pf-section-title{font-size:1.7rem;} .pf-text{line-height:1.7;color:#334155;}' +
        '.pf-lines{margin:.4em 0;} .pf-text{padding:.4em 0;}' +
        '.pf-timeline{position:relative;padding-left:18px;}' +
        '.pf-entry{background:var(--pf-surface);border:1px solid var(--pf-border);border-radius:14px;padding:16px;margin:14px 0;}' +
        '.pf-chips{display:flex;flex-wrap:wrap;gap:8px;} .pf-chip{display:inline-block;padding:7px 14px;border-radius:999px;background:var(--pf-accent);color:#fff;font-size:.8rem;}' +
        '.pf-footer{text-align:center;padding:30px;color:var(--pf-muted);}' +
        '@media(max-width:640px){.pf-hero{padding:48px 16px;}.pf-section{padding:28px 14px;}.pf-nav ul{justify-content:flex-start;}}' +
        '@media print{.pf-nav,.pf-hero-bg{display:none;}}';
/* ---------- preview page controller (wired after the preview view shows) ---------- */
    function initPreviewPage() {
        const frame = document.getElementById('portfolioPreview');
        const data = App.getData();
        if (!frame) return;
        if (!data || !data.sections) {
            frame.innerHTML = '<div class="preview-empty"><h2>No resume data found</h2>' +
                '<p>Upload a resume first to generate your portfolio.</p></div>';
            return;
        }
        const custom = App.getCustom();

        function paint() {
            try {
                frame.innerHTML = buildPortfolioHtml(data, custom);
                const scrollRoot = frame.closest('.pf-preview-scroll') || frame;
                Animations.initReveal(frame);
                Animations.initPortfolioNav(scrollRoot, frame.querySelector('.pf-nav'));
                Animations.bindSmoothAnchors(scrollRoot);
            } catch (err) {
                // Never blank-the screen without a trace - show the real error.
                console.error('Portfolio preview render error', err);
                frame.innerHTML = '<div class="preview-empty"><h2>Preview could not be rendered</h2>' +
                    '<p>' + esc(err && err.message ? err.message : 'unknown error') + '</p></div>';
            }
        }

        /* --- theme / color / layout --- */
        // reflect saved preferences onto the inputs first
        document.querySelectorAll('input[name="theme"]').forEach((r) => r.checked = (r.value === custom.theme));
        document.querySelectorAll('input[name="color"]').forEach((r) => r.checked = (r.value === custom.color));
        document.querySelectorAll('input[name="layout"]').forEach((r) => r.checked = (r.value === custom.layout));

        function bindRadios(name, apply) {
            const radios = document.querySelectorAll('input[name="' + name + '"]');
            radios.forEach((r) => r.addEventListener('change', () => {
                if (!r.checked) return;
                apply(r.value); App.saveCustom(custom); paint();
            }));
        }
        bindRadios('theme', (v) => custom.theme = v);
        bindRadios('color', (v) => custom.color = v);
        bindRadios('layout', (v) => custom.layout = v);

        /* --- section visibility toggles (show / hide sections) --- */
        const toggleList = document.getElementById('sectionToggles');
        function buildToggles() {
            toggleList.innerHTML = '';
            data.sections.forEach((s, i) => {
                const id = 'toggle-' + i;
                const label = document.createElement('label');
                label.className = 'section-toggle';
                const hidden = (custom.hidden || []).indexOf(s.original) !== -1;
                label.innerHTML = '<input type="checkbox" id="' + id + '"' + (hidden ? '' : ' checked') + '>' +
                    '<span class="toggle"></span><span class="toggle-label"></span>';
                label.querySelector('.toggle-label').textContent = s.original;
                label.querySelector('input').addEventListener('change', (e) => {
                    custom.hidden = custom.hidden || [];
                    const i2 = custom.hidden.indexOf(s.original);
                    if (e.target.checked && i2 !== -1) custom.hidden.splice(i2, 1);
                    if (!e.target.checked && i2 === -1) custom.hidden.push(s.original);
                    App.saveCustom(custom);
                    paint();
                });
                toggleList.appendChild(label);
            });
        }
        buildToggles();
/* --- integrity indicator --- */
        const integrityEl = document.getElementById('integrityInfo');
        if (integrityEl) {
            const rep = validate(data);
            integrityEl.textContent = rep.total + ' sections preserved from your resume.' +
                (rep.empty.length ? ' (' + rep.empty.length + ' were empty and kept as-is)' : '');
        }

        /* --- edit extracted text modal --- */
        const editModal = document.getElementById('editModal');
        const editBody = document.getElementById('editModalBody');

        function buildEditForm() {
            const p = data.personalInfo || {};
            let h = '';
            const P = [['name', 'Full Name'], ['title', 'Title / Role'], ['email', 'Email'],
                ['phone', 'Phone'], ['location', 'Location'], ['linkedin', 'LinkedIn'],
                ['github', 'GitHub'], ['website', 'Website']];
            h += '<div class="edit-grid">';
            P.forEach(([k, lab]) => {
                h += '<label class="edit-field"><span>' + lab + '</span>' +
                    '<input type="text" data-personal="' + k + '" value="' + esc(p[k] || '') + '"></label>';
            });
            h += '</div>';

            data.sections.forEach((s, i) => {
                h += '<div class="edit-section" data-sec="' + i + '">';
                h += '<input class="edit-title" data-sec="' + i + '" data-title value="' + esc(s.original) + '">';
                h += '<textarea class="edit-content" data-sec="' + i + '" data-content rows="4">' +
                    esc(s.lines.join('\n')) + '</textarea>';
                h += '</div>';
            });
            return h;
        }

        function saveEditForm() {
            data.personalInfo = data.personalInfo || {};
            document.querySelectorAll('#editModalBody [data-personal]').forEach((inp) => {
                data.personalInfo[inp.getAttribute('data-personal')] = inp.value.trim();
            });
            const rebuilt = [];
            Array.prototype.slice.call(editBody.querySelectorAll('[data-sec]'))
                .sort((a, b) => parseInt(a.getAttribute('data-sec'), 10) - parseInt(b.getAttribute('data-sec'), 10))
                .forEach((group) => {
                    const title = group.querySelector('[data-title]');
                    const content = group.querySelector('[data-content]');
                    const typeInfo = data.sections[parseInt(group.getAttribute('data-sec'), 10)] || {};
                    rebuilt.push({
                        original: title ? title.value.trim() : (typeInfo.original || ''),
                        type: typeInfo.type || 'generic',
                        lines: content ? content.value.split(/\r?\n/) : []
                    });
                });
            data.sections = rebuilt;
            // Re-classify types in case a title was corrected.
            data.sections.forEach((s) => { s.type = ResumeAnalyzer.classify(s.original); });
            App.saveData(data);
            editModal.hidden = true;
            editModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            buildToggles();
            paint();
            App.toast('Edits saved. Your resume text is preserved.', 'success');
        }

        if (editModal) {
            const close = () => { editModal.hidden = true; editModal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); };
            document.getElementById('editDataBtn').addEventListener('click', () => {
                editBody.innerHTML = buildEditForm();
                editModal.hidden = false;
                editModal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('modal-open');
            });
            document.getElementById('editModalClose').addEventListener('click', close);
            document.getElementById('editCancel').addEventListener('click', close);
            editModal.addEventListener('click', (e) => { if (e.target === editModal) close(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !editModal.hidden) close(); });
            document.getElementById('editSave').addEventListener('click', saveEditForm);
        }

        /* --- export standalone / back --- */
        const exportHtml = () => {
            const blob = new Blob([buildStandalone(data, custom)], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = ((data.personalInfo || {}).name || 'portfolio').toLowerCase().replace(/\s+/g, '-') + '-portfolio.html';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            App.toast('Portfolio downloaded!', 'success');
        };
        document.getElementById('exportBtn').addEventListener('click', exportHtml);
        /* The in-panel "Download Portfolio" button was unbound before; bind it
           to the same exporter so both export buttons work. */
        const dlBtn = document.getElementById('downloadBtn');
        if (dlBtn) dlBtn.addEventListener('click', exportHtml);
        document.getElementById('backBtn').addEventListener('click', () => {
            App.show('view-home');
        });
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Start over? Your uploaded resume data will be removed.')) {
                App.clearData();
                localStorage.removeItem(App.KEYS.CUSTOM);
                App.show('view-home');
            }
        });

        paint();
    }

    /* ---------- public API ---------- */
    return {
        render: buildPortfolioHtml,
        buildStandalone: buildStandalone,
        initPreviewPage: initPreviewPage,
        validate: validate,
        classify: ResumeAnalyzer.classify
    };
})();

window.PortfolioGenerator = PortfolioGenerator;