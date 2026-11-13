/* =========================================================
   templates.js - the Templates gallery page
   ---------------------------------------------------------
   A dedicated page that presents EVERY portfolio template as a
   real, scaled-down live preview of the generated portfolio.
   Choosing a card applies that template to the current
   customization state and generates the portfolio with it.

   CONTENT RULE: a template is pure CSS. Section titles, section
   order and every line of resume text stay exactly as extracted
   and analyzed - a template only changes how they look.
   ========================================================= */
'use strict';

const Templates = (function () {

    /* Virtual page width each thumbnail is rendered at, then scaled to fit. */
    const STAGE_WIDTH = 1040;

    function esc(value) { return window.App ? App.escapeHtml(value) : String(value == null ? '' : value); }

    /* Sample used for thumbnails until a resume exists, so the gallery is
       explorable before any file is uploaded. */
    function sampleData() {
        return {
            personalInfo: {
                name: 'Your Name', title: 'Your Role', email: 'you@example.com',
                phone: '+00 00000 00000', location: 'Your City',
                linkedin: 'linkedin.com/in/your-name', github: 'github.com/your-name'
            },
            sections: [
                { type: 'summary', original: 'Career Objective',
                  lines: ['A short introduction lifted word for word from your resume.'] },
                { type: 'experience', original: 'Experience',
                  lines: ['Software Engineer', 'Example Technologies', '2023 - Present',
                      'Worked on the projects described in your resume.',
                      'Technologies: React, Node.js, SQL'] },
                { type: 'projects', original: 'Projects',
                  lines: ['Portfolio Generator', 'Turns a resume into a portfolio.',
                      'Technologies: JavaScript, CSS'] },
                { type: 'skills', original: 'Technical Skills',
                  lines: ['Languages: Java, Python, SQL', 'Frameworks: React, Node.js'] }
            ]
        };
    }

    /* Thumbnails use the real resume when there is one (trimmed to keep the
       gallery light), otherwise the sample above. */
    function thumbSource() {
        const real = window.App ? App.getData() : null;
        if (real && real.sections && real.sections.length) {
            return { personalInfo: real.personalInfo || {}, sections: real.sections.slice(0, 4) };
        }
        return sampleData();
    }

    function registry() {
        return (window.PortfolioGenerator && PortfolioGenerator.templates) || [];
    }

    function galleryEl() { return document.getElementById('templateGallery'); }

    /* ---- one card = one template, previewed live ----
       The shared stylesheet is injected once for the whole gallery, so each
       card keeps only its markup. Shipping the full CSS inside all fifteen
       cards would repeat the same rules fifteen times for no benefit. */
    function thumbHtml(custom) {
        try {
            return PortfolioGenerator.render(thumbSource(), Object.assign({}, custom, { hidden: [] }))
                .replace(/<style>[\s\S]*?<\/style>/, '');
        } catch (e) {
            return '';
        }
    }

    function sharedCss() {
        return PortfolioGenerator.layoutCss ? '<style>' + PortfolioGenerator.layoutCss() + '</style>' : '';
    }

    function cardHtml(tpl, custom, selected, index) {
        /* Each card previews ITS OWN template, keeping the chosen theme/color. */
        const preview = Object.assign({}, custom, { layout: tpl.id, hidden: [] });
        return '<article class="tpl-card' + (selected ? ' is-active' : '') + '" data-template="' + esc(tpl.id) + '"' +
                ' style="--tpl-i:' + index + '">' +
            '<div class="tpl-frame" aria-hidden="true">' +
                '<div class="tpl-frame-bar"><i></i><i></i><i></i></div>' +
                '<div class="tpl-preview"><div class="tpl-preview-stage">' + thumbHtml(preview) + '</div></div>' +
                '<div class="tpl-badge"><span>&#10003; Selected</span></div>' +
            '</div>' +
            '<div class="tpl-meta">' +
                '<h3 class="tpl-name">' + esc(tpl.name) + '</h3>' +
                '<p class="tpl-tagline">' + esc(tpl.tagline) + '</p>' +
                '<p class="tpl-blurb">' + esc(tpl.blurb) + '</p>' +
                '<ul class="tpl-tags">' + tpl.tags.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
                '<span class="tpl-use">Use this template <em>&rarr;</em></span>' +
            '</div>' +
            '<button type="button" class="tpl-pick" data-template="' + esc(tpl.id) + '"' +
                ' aria-pressed="' + (selected ? 'true' : 'false') + '"' +
                ' aria-label="Generate my portfolio with the ' + esc(tpl.name) + ' template"></button>' +
        '</article>';
    }

    /* ---- paint the gallery ---- */
    function render() {
        const host = galleryEl();
        if (!host) return;
        const custom = App.getCustom();
        const list = registry();
        host.innerHTML = sharedCss() + list.map((tpl, i) => cardHtml(tpl, custom, tpl.id === custom.layout, i)).join('');

        const current = document.getElementById('templateCurrent');
        if (current) {
            const active = list.filter((t) => t.id === custom.layout)[0];
            current.textContent = active
                ? 'Currently using: ' + active.name
                : 'Pick a template to generate your portfolio with it.';
        }
        fit();
    }

    /* Scale every 1040px virtual page down to its card width. */
    function fit() {
        const host = galleryEl();
        if (!host) return;
        Array.prototype.forEach.call(host.querySelectorAll('.tpl-preview'), (box) => {
            const stage = box.querySelector('.tpl-preview-stage');
            if (!stage) return;
            const width = box.clientWidth;
            if (!width) return;
            stage.style.width = STAGE_WIDTH + 'px';
            stage.style.transform = 'scale(' + (width / STAGE_WIDTH) + ')';
        });
    }

    /* ---- choose: apply the template + regenerate the portfolio ---- */
    function choose(id) {
        const tpl = registry().filter((t) => t.id === id)[0];
        if (!tpl) return;
        const custom = App.getCustom();
        custom.layout = id;
        App.saveCustom(custom);

        /* The sidebar lists only the featured designs, so let it report which
           template is actually in use instead of checking a stale tile. */
        if (PortfolioGenerator.syncPickerLabels) PortfolioGenerator.syncPickerLabels();

        if (!App.getData()) {
            App.toast('Upload a resume first - "' + tpl.name + '" is now your selected template.', 'info');
            App.show('view-home');
            return;
        }
        /* initPreviewPage rebuilds the preview with the new template and
           brings the preview view forward. */
        PortfolioGenerator.initPreviewPage();
        App.show('view-preview');
        App.toast(tpl.name + ' template applied - your text is unchanged.', 'success');
    }

    /* ---- page routing ---- */
    function open() {
        render();
        App.show('view-templates');
        fit();
        /* The view was hidden, so an IntersectionObserver may not have marked
           its chrome visible yet - reveal it deterministically. */
        const view = document.getElementById('view-templates');
        if (view && window.Animations) Animations.initReveal(view);
    }

    function back() {
        App.show(App.getData() ? 'view-preview' : 'view-home');
    }

    /* ---- wiring (called once from index.html) ---- */
    function init() {
        const host = galleryEl();
        if (host) {
            host.addEventListener('click', (e) => {
                const btn = e.target && e.target.closest ? e.target.closest('.tpl-pick') : null;
                if (!btn) return;
                e.preventDefault();
                choose(btn.getAttribute('data-template'));
            });
        }
        ['templatesBtn', 'browseTemplatesBtn', 'templatesTeaserBtn'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', open);
        });
        const backBtn = document.getElementById('templatesBackBtn');
        if (backBtn) backBtn.addEventListener('click', back);

        let frame = 0;
        window.addEventListener('resize', () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(fit);
        });
    }

    return {
        init: init,
        open: open,
        render: render,
        fit: fit,
        choose: choose,
        sampleData: sampleData
    };
})();

window.Templates = Templates;
