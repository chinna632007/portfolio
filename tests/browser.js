/* Optional real-browser regression: node tests/browser.js
   Uses installed Chrome (or BROWSER_PATH); no additional dependencies. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const browser = process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(browser)) throw new Error('Set BROWSER_PATH to an installed Chromium browser executable.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-regression-'));
const sample = fs.readFileSync(path.join(__dirname, 'samples/resumeA.txt'), 'utf8');
function checkEditor(sample) {
    window.addEventListener('load', async function () {
        const results = {};
        try {
            App.saveData(ResumeAnalyzer.analyze(sample, 'resumeA.txt'));
            App.show('view-preview');
            PortfolioGenerator.initPreviewPage();
            const panelToggle = document.getElementById('panelToggle');
            const panelContent = document.getElementById('panelContent');
            results.panelLinked = panelToggle.getAttribute('aria-controls') === panelContent.id;
            panelToggle.click();
            results.panelClosed = panelContent.hidden && getComputedStyle(panelContent).display === 'none' &&
                panelToggle.getAttribute('aria-expanded') === 'false';
            panelToggle.click();
            results.panelOpened = !panelContent.hidden && panelToggle.getAttribute('aria-expanded') === 'true';
            const projectsField = () => Array.from(document.querySelectorAll('.edit-section'))
                .find(el => el.querySelector('[data-title]').value === 'Projects').querySelector('textarea');
            document.getElementById('editDataBtn').click();
            results.sectionsBefore = document.querySelectorAll('.edit-section').length;
            results.separatorsKept = projectsField().value.includes('\n\n');
            projectsField().value = '';
            document.getElementById('editSave').click();
            results.cardsAfterClear = document.querySelectorAll('.pf-project').length;
            document.getElementById('editDataBtn').click();
            projectsField().value = 'first project\n2023 - 2024\nBuilt a site.\nTechnologies: React, CSS\n\nsecond project\nCreated a quiz.';
            document.getElementById('editSave').click();
            results.sectionsAfter = App.getData().sections.length;
            results.projectSections = App.getData().sections.filter(s => s.type === 'projects').length;
            results.cardsAfterRestore = document.querySelectorAll('.pf-project').length;
            const card = document.querySelector('.pf-project');
            results.heading = card.querySelector('h3').textContent;
            const title = card.querySelector('h3'), date = card.querySelector('.pf-entry-metas');
            results.titleBeforeDate = !!(title.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING);
            results.dateBeforeDescription = !!(date.compareDocumentPosition(card.querySelector('.pf-project-description')) & Node.DOCUMENT_POSITION_FOLLOWING);
            results.previewError = !!document.querySelector('#portfolioPreview .preview-empty');
            const grid = document.querySelector('.pf-project-grid');
            results.columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
            results.overflow = grid.scrollWidth > grid.clientWidth;
            const fixture = document.createElement('div');
            fixture.innerHTML = PortfolioGenerator.render({ personalInfo: {}, sections: [
                { type: 'skills', original: 'Soft Skills', lines: ['Communication • Teamwork • Adaptability'] },
                { type: 'certifications', original: 'Certifications', lines: ['• Completed a course.', '• Received an award.'] },
                { type: 'contact', original: 'Personal Details', lines: ['Name Example Person', 'Languages Known English, Telugu'] },
                { type: 'declaration', original: 'Declaration', lines: ['I declare this correct.', 'Date: 02/09/2026 Example Person', 'Place: Sample City Signature'] }
            ] }, {});
            document.body.appendChild(fixture);
            const soft = fixture.querySelectorAll('.pf-soft-skills li');
            results.softCount = soft.length;
            results.softVertical = soft[1].getBoundingClientRect().top > soft[0].getBoundingClientRect().bottom;
            results.certificateColumns = getComputedStyle(fixture.querySelector('.pf-entries-grid')).gridTemplateColumns.split(' ').length;
            results.personalLabels = Array.from(fixture.querySelectorAll('.pf-details dt')).map(el => el.textContent);
            results.signature = fixture.querySelector('.pf-signature-name').textContent;
            results.detailsOverflow = Array.from(fixture.querySelectorAll('.pf-detail-row')).some(el => el.scrollWidth > el.clientWidth);
            results.overflowDetail = Array.from(fixture.querySelectorAll('.pf-detail-row'))
                .filter(el => el.scrollWidth > el.clientWidth)
                .map(el => ({ text: el.textContent.slice(0, 60), client: el.clientWidth, scroll: el.scrollWidth }));
            fixture.remove();

            // Reopening/re-generating must replace handlers, not accumulate them.
            const next = App.getData();
            next.personalInfo.name = 'Latest Resume';
            next.sections.push({ type: 'generic', original: 'LongSection'.repeat(25), lines: ['Kept verbatim.'] });
            App.saveData(next);
            PortfolioGenerator.initPreviewPage();
            PortfolioGenerator.initPreviewPage();
            let saves = 0;
            const saveCustom = App.saveCustom;
            App.saveCustom = function (custom) { saves++; saveCustom.call(App, custom); };
            document.querySelector('input[name="theme"][value="dark"]').click();
            document.querySelector('input[name="color"][value="rose"]').click();
            document.querySelector('input[name="layout"][value="minimal"]').click();
            results.singleRadioHandlers = saves === 3;
            results.customSaved = App.getCustom().theme === 'dark' && App.getCustom().color === 'rose' && App.getCustom().layout === 'minimal';
            const section = document.querySelector('#sectionToggles input');
            const original = App.getData().sections[0].original;
            section.click();
            results.sectionHidden = App.getCustom().hidden.includes(original);
            section.click();
            results.sectionRestored = !App.getCustom().hidden.includes(original);
            App.saveCustom = saveCustom;
            panelToggle.click();
            results.singleToggleHandler = panelContent.hidden;
            panelToggle.click();
            results.toggleVisible = getComputedStyle(panelToggle).display !== 'none';
            results.sidebarOverflow = panelContent.scrollWidth > panelContent.clientWidth;
            const headerTop = document.querySelector('.panel-header').getBoundingClientRect().top;
            panelContent.scrollTop = panelContent.scrollHeight;
            const contentRect = panelContent.getBoundingClientRect();
            const resetRect = document.getElementById('resetBtn').getBoundingClientRect();
            results.actionsReachable = resetRect.bottom <= contentRect.bottom + 1 && resetRect.top >= contentRect.top;
            results.headerStable = document.querySelector('.panel-header').getBoundingClientRect().top === headerTop;
            results.panelBounded = document.getElementById('customizationPanel').getBoundingClientRect().height < window.innerHeight;
            let downloads = 0, prompts = 0;
            const anchorClick = HTMLAnchorElement.prototype.click;
            const confirm = window.confirm;
            HTMLAnchorElement.prototype.click = function () { downloads++; };
            window.confirm = function () { prompts++; return false; };
            document.getElementById('downloadBtn').click();
            document.getElementById('resetBtn').click();
            HTMLAnchorElement.prototype.click = anchorClick;
            window.confirm = confirm;
            results.singleActions = downloads === 1 && prompts === 1;
            document.getElementById('editDataBtn').click();
            results.latestData = document.querySelector('[data-personal="name"]').value === 'Latest Resume';
            document.getElementById('editCancel').click();

            // A click on a real label focuses its input before change fires.
            // input.click() alone misses the browser's focus-induced scrolling.
            document.documentElement.style.scrollBehavior = 'auto';
            const previewScroll = document.getElementById('previewScroll');
            previewScroll.style.scrollBehavior = 'auto';
            await new Promise(resolve => setTimeout(resolve, 400));
            const row = document.querySelectorAll('.section-toggle')[2];
            const input = row.querySelector('input');
            const panelRect = panelContent.getBoundingClientRect();
            panelContent.scrollTop += row.getBoundingClientRect().top - panelRect.top - 80;
            previewScroll.scrollTop = 250;
            await new Promise(resolve => setTimeout(resolve, 100));
            const before = { panel: panelContent.scrollTop, page: window.scrollY, preview: previewScroll.scrollTop };
            const rowRect = row.getBoundingClientRect(), inputRect = input.getBoundingClientRect();
            results.sectionFocusInsideRow = inputRect.top >= rowRect.top && inputRect.bottom <= rowRect.bottom &&
                inputRect.left >= rowRect.left && inputRect.right <= rowRect.right;
            input.focus();
            row.querySelector('.toggle-label').click();
            await new Promise(resolve => setTimeout(resolve, 150));
            results.sectionClickStable = !panelContent.hidden && panelToggle.getAttribute('aria-expanded') === 'true' &&
                Math.abs(panelContent.scrollTop - before.panel) <= 1 && Math.abs(window.scrollY - before.page) <= 1;
            results.previewPositionKept = Math.abs(previewScroll.scrollTop - before.preview) <= 1;
            results.scrollDebug = { before, after: { panel: panelContent.scrollTop, page: window.scrollY, preview: previewScroll.scrollTop } };
            input.click(); // re-activate the focused native checkbox without rebuilding the sidebar
            await new Promise(resolve => setTimeout(resolve, 100));
            results.sectionFocusKept = document.activeElement === input && !panelContent.hidden;

            // End-to-end appearance check: operate the actual sidebar controls.
            document.querySelector('input[name="theme"][value="dark"]').click();
            document.querySelector('input[name="color"][value="rose"]').click();
            document.querySelector('input[name="layout"][value="professional"]').click();
            let appearanceRoot = document.querySelector('#portfolioPreview .pf-root');
            const appearanceStyle = getComputedStyle(appearanceRoot);
            results.appearance = {
                classes: appearanceRoot.className,
                background: appearanceStyle.backgroundColor,
                text: appearanceStyle.color,
                accent: appearanceStyle.getPropertyValue('--pf-accent').trim(),
                surface: getComputedStyle(appearanceRoot.querySelector('.pf-entry')).backgroundColor,
                projectBorder: getComputedStyle(appearanceRoot.querySelector('.pf-project')).borderTopColor
            };
            const exported = document.createElement('iframe');
            const exportLoaded = new Promise(resolve => exported.onload = resolve);
            exported.srcdoc = PortfolioGenerator.buildStandalone(App.getData(), App.getCustom());
            document.body.appendChild(exported);
            await exportLoaded;
            const exportRoot = exported.contentDocument.querySelector('.pf-root');
            const exportStyle = exported.contentWindow.getComputedStyle(exportRoot);
            results.exportAppearance = { classes: exportRoot.className, background: exportStyle.backgroundColor,
                text: exportStyle.color, accent: exportStyle.getPropertyValue('--pf-accent').trim() };
            exported.remove();
            const sourceBefore = JSON.stringify(App.getData());
            const contentBefore = Array.from(appearanceRoot.querySelectorAll('.pf-section')).map(el => el.textContent).join('|');
            results.templateStyles = [];
            results.templateNames = [];
            results.appliedStyles = [];
            results.appliedNames = [];
            results.paletteMatrix = true;
            results.accentKept = true;
            results.registry = {
                templates: PortfolioGenerator.templateIds,
                featured: PortfolioGenerator.featuredIds,
                colors: PortfolioGenerator.colorIds
            };
            results.sidebarLayouts = Array.from(document.querySelectorAll('input[name="layout"]')).map(r => r.value);
            results.sidebarColors = Array.from(document.querySelectorAll('input[name="color"]')).map(r => r.value);
            results.sidebarActiveNote = document.getElementById('templateActiveNote').textContent;
            const palette = {};
            PortfolioGenerator.colors.forEach(c => { palette[c.id] = c.accent; });
            results.paletteCount = Object.keys(palette).length;
            /* One measurement vocabulary shared by thumbnails and the real
               preview, so a template can be compared wherever it renders. */
            const designOf = (root) => {
                const hero = getComputedStyle(root.querySelector('.pf-hero'));
                const avatar = getComputedStyle(root.querySelector('.pf-hero-avatar'));
                const title = getComputedStyle(root.querySelector('.pf-section-title'));
                return [hero.textAlign, hero.borderTopWidth, hero.borderBottomWidth,
                    hero.backgroundImage === 'none' ? 'flat' : 'gradient', hero.borderBottomStyle, hero.paddingTop,
                    avatar.borderRadius, avatar.width, avatar.backgroundImage === 'none' ? 'flat' : 'gradient',
                    title.textTransform, title.fontFamily.split(',')[0], title.fontSize, title.fontWeight].join('|');
            };
            const accentOf = (root) => getComputedStyle(root).getPropertyValue('--pf-accent').trim();
            const currentAccent = () => palette[App.getCustom().color];
            /* 1. Every design is measured from its own gallery thumbnail, so a card
               can never silently fall back to another template's look. */
            document.getElementById('templatesBtn').click();
            Array.from(document.getElementById('templateGallery').querySelectorAll('.tpl-card')).forEach(card => {
                const id = card.getAttribute('data-template');
                const thumbRoot = card.querySelector('.tpl-preview-stage .pf-root');
                results.templateNames.push(id);
                results.templateStyles.push(designOf(thumbRoot));
                results.accentKept = results.accentKept && accentOf(thumbRoot) === currentAccent();
            });
            document.getElementById('templatesBackBtn').click();

            /* 2. Apply non-featured designs for real - they are only reachable
               through the gallery, so this proves the round trip works. */
            for (const layout of ['terminal', 'split', 'magazine', 'creative']) {
                document.getElementById('templatesBtn').click();
                document.querySelector('.tpl-pick[data-template="' + layout + '"]').click();
                appearanceRoot = document.querySelector('#portfolioPreview .pf-root');
                results.appliedNames.push(layout);
                results.appliedStyles.push(designOf(appearanceRoot) + '|' + appearanceRoot.className);
                results.accentKept = results.accentKept && accentOf(appearanceRoot) === currentAccent();
            }

            /* 3. Every accent in both themes, measured on the base design. */
            document.querySelector('input[name="layout"][value="modern"]').click();
            for (const theme of ['light', 'dark']) {
                document.querySelector('input[name="theme"][value="' + theme + '"]').click();
                for (const color of Object.keys(palette)) {
                    document.querySelector('input[name="color"][value="' + color + '"]').closest('label').querySelector('span').click();
                    const style = getComputedStyle(appearanceRoot);
                    results.paletteMatrix = results.paletteMatrix && style.getPropertyValue('--pf-accent').trim() === palette[color] &&
                        style.backgroundColor === (theme === 'dark' ? 'rgb(11, 18, 32)' : 'rgb(248, 250, 252)');
                }
            }
            /* End on dark/purple/professional so the assertions below stay valid. */
            document.querySelector('input[name="theme"][value="dark"]').click();
            document.querySelector('input[name="color"][value="purple"]').click();
            document.querySelector('input[name="layout"][value="professional"]').click();
            results.appearanceKeepsContent =
                contentBefore === Array.from(document.querySelector('#portfolioPreview .pf-root').querySelectorAll('.pf-section')).map(el => el.textContent).join('|') &&
                sourceBefore === JSON.stringify(App.getData());
            PortfolioGenerator.initPreviewPage();
            results.appearanceRestored = document.querySelector('#portfolioPreview .pf-root').className === 'pf-root pf-dark pf-purple pf-professional';

            // ---- Templates gallery page ----
            const contentOf = (rootEl) => Array.from(rootEl.querySelectorAll('.pf-section')).map(el => el.textContent).join('|');
            const galleryBtn = document.getElementById('templatesBtn');
            results.galleryBtnVisible = galleryBtn.getBoundingClientRect().width > 0;
            galleryBtn.click();
            results.galleryOpened = document.getElementById('view-templates').classList.contains('active') &&
                !document.getElementById('view-preview').classList.contains('active');
            const gallery = document.getElementById('templateGallery');
            const cards = Array.from(gallery.querySelectorAll('.tpl-card'));
            results.galleryCards = cards.length;
            results.galleryIds = cards.map(c => c.getAttribute('data-template'));
            results.galleryPickCount = gallery.querySelectorAll('.tpl-pick').length;
            results.galleryPreviews = cards.every(c => !!c.querySelector('.tpl-preview-stage .pf-root'));
            results.galleryPerCard = cards.map(c => c.querySelector('.tpl-preview-stage .pf-root').className);
            results.galleryStageScaled = cards.every(c => {
                const box = c.querySelector('.tpl-preview');
                const stage = c.querySelector('.tpl-preview-stage');
                const m = /scale\(([\d.]+)\)/.exec(stage.style.transform || '');
                if (!m) { return false; }
                if (Math.abs(parseFloat(m[1]) - box.clientWidth / 1040) > 0.01) { return false; }
                // the scaled page must actually cover the visible slice
                return stage.getBoundingClientRect().width >= box.clientWidth - 1 && box.clientHeight >= 150;
            });
            results.galleryNoOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
            results.gallerySingleActive = gallery.querySelectorAll('.tpl-card.is-active').length === 1;
            const activeCard = gallery.querySelector('.tpl-card.is-active');
            results.galleryActiveCard = !!activeCard && activeCard.getAttribute('data-template') === 'professional';
            const customNow = App.getCustom();
            results.galleryThemeMatches = cards.every(c =>
                c.querySelector('.pf-root').className.indexOf('pf-' + customNow.theme) !== -1);
            results.galleryAccentMatches = cards.every(c =>
                getComputedStyle(c.querySelector('.pf-root')).getPropertyValue('--pf-accent').trim() === palette[customNow.color]);

            const galleryDataBefore = JSON.stringify(App.getData());
            const galleryContentBefore = contentOf(document.querySelector('#portfolioPreview .pf-root'));
            gallery.querySelector('.tpl-pick[data-template="creative"]').click();
            const chosenRoot = document.querySelector('#portfolioPreview .pf-root');
            results.galleryChosen = {
                view: document.getElementById('view-preview').classList.contains('active'),
                cls: chosenRoot.className,
                saved: App.getCustom().layout,
                checked: document.querySelectorAll('input[name="layout"]:checked').length,
                note: document.getElementById('templateActiveNote').textContent,
                content: contentOf(chosenRoot) === galleryContentBefore,
                data: JSON.stringify(App.getData()) === galleryDataBefore
            };
            galleryBtn.click();
            const reopened = document.getElementById('templateGallery').querySelector('.tpl-card.is-active');
            results.galleryReflectsChoice = !!reopened && reopened.getAttribute('data-template') === 'creative' &&
                reopened.querySelector('.tpl-pick').getAttribute('aria-pressed') === 'true';

            // the gallery is explorable before any resume is uploaded
            const dataBackup = App.getData();
            const customBackup = Object.assign({}, App.getCustom());
            App.clearData();
            Templates.open();
            results.galleryNoResumeCards = document.getElementById('templateGallery').querySelectorAll('.tpl-card').length;
            document.querySelector('.tpl-pick[data-template="elegant"]').click();
            results.galleryNoResumeGoesHome = document.getElementById('view-home').classList.contains('active') &&
                App.getCustom().layout === 'elegant';
            App.saveData(dataBackup);
            App.saveCustom(customBackup);
        } catch (e) { results.error = e.message; }
        const report = document.createElement('pre');
        report.id = 'browser-report';
        report.textContent = JSON.stringify(results);
        document.body.appendChild(report);
    });
}
try {
    let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    html = html.replace('<head>', '<head><base href="' + pathToFileURL(root + path.sep).href + '">');
    html = html.replace('</body>', '<script>(' + checkEditor.toString() + ')(' + JSON.stringify(sample) + ');</script></body>');
    const fixture = path.join(temp, 'editor.html');
    fs.writeFileSync(fixture, html);
    for (const width of [1200, 980, 500]) {
        const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--user-data-dir=' + path.join(temp, 'profile-' + width), '--window-size=' + width + ',900',
            '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(fixture).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
        if (run.error) throw run.error;
        const match = run.stdout.match(/<pre id="browser-report">([^<]+)<\/pre>/);
        assert(match, 'Browser did not produce a result: ' + run.stderr);
        const result = JSON.parse(match[1]);
        assert(!result.error, result.error);
        assert(result.panelLinked && result.panelClosed && result.panelOpened, 'Sidebar disclosure must work');
        assert.strictEqual(result.sectionsBefore, 5);
        assert.strictEqual(result.sectionsAfter, 5);
        assert.strictEqual(result.projectSections, 1);
        assert.strictEqual(result.cardsAfterClear, 0);
        assert.strictEqual(result.cardsAfterRestore, 2);
        assert.strictEqual(result.heading, 'first project');
        assert(result.separatorsKept && result.titleBeforeDate && result.dateBeforeDescription);
        assert(!result.previewError && !result.overflow);
        assert.strictEqual(result.columns, 1);
        assert.strictEqual(result.softCount, 3);
        assert(result.softVertical, 'Soft skills must stack vertically: ' + JSON.stringify(result));
        assert(!result.detailsOverflow, 'Detail rows must not overflow: ' + JSON.stringify(result));
        assert.strictEqual(result.certificateColumns, 1);
        assert.deepStrictEqual(result.personalLabels, ['Name', 'Languages Known', 'Date', 'Place']);
        assert.strictEqual(result.signature, 'Example Person');
        assert(result.singleRadioHandlers && result.customSaved && result.singleToggleHandler && result.singleActions && result.latestData, 'Repeated generation must use only current handlers: ' + JSON.stringify(result));
        assert(result.sectionHidden && result.sectionRestored, 'Section switches must persist visibility');
        assert(result.toggleVisible && !result.sidebarOverflow && result.actionsReachable && result.headerStable && result.panelBounded, 'Sidebar layout must remain usable: ' + JSON.stringify(result));
        assert(result.sectionFocusInsideRow && result.sectionClickStable && result.previewPositionKept && result.sectionFocusKept,
            'Section interaction must not jump or collapse: ' + JSON.stringify(result));
        assert.strictEqual(result.appearance.background, 'rgb(11, 18, 32)', 'Dark preview background');
        assert.strictEqual(result.appearance.text, 'rgb(230, 237, 247)', 'Dark preview text');
        assert.strictEqual(result.appearance.accent, '#f43f5e', 'Professional must respect Rose');
        assert.strictEqual(result.appearance.projectBorder, 'rgb(244, 63, 94)', 'Visible Rose project border');
        assert.strictEqual(result.exportAppearance.background, result.appearance.background, 'Export must match dark preview');
        assert.strictEqual(result.exportAppearance.text, result.appearance.text, 'Export text must match preview');
        assert.strictEqual(result.exportAppearance.accent, result.appearance.accent, 'Export accent must match preview');
        assert(result.paletteMatrix && result.appearanceKeepsContent && result.appearanceRestored, 'All palettes/templates must apply without replacing resume content');
        assert(result.registry.templates.length >= 10 && result.registry.templates.length <= 15,
            'Registry must offer 10-15 portfolio templates, got ' + result.registry.templates.length);
        assert.strictEqual(result.registry.featured.length, 3, 'Exactly the 3 best templates belong in the sidebar');
        assert.deepStrictEqual(result.sidebarLayouts, result.registry.featured,
            'Sidebar must list only the 3 featured templates: ' + JSON.stringify(result.sidebarLayouts));
        assert.strictEqual(result.sidebarColors.length, result.registry.colors.length,
            'Sidebar must offer every registered accent color');
        assert.strictEqual(result.paletteCount, result.registry.colors.length,
            'Every accent color must reach the browser with its hex value');
        assert.strictEqual(result.sidebarActiveNote, 'In use: Professional',
            'Sidebar must report the design in use: ' + result.sidebarActiveNote);
        assert(result.accentKept, 'No template may override the chosen accent color');
        assert.strictEqual(new Set(result.templateStyles).size, result.registry.templates.length,
            'All ' + result.registry.templates.length + ' templates must be visibly distinct: ' +
            JSON.stringify(result.templateNames.map((n, i) => n + '=' + result.templateStyles[i])));
        assert.strictEqual(new Set(result.appliedStyles).size, result.appliedStyles.length,
            'Gallery-chosen designs must really apply to the preview: ' + JSON.stringify(result.appliedStyles));
        assert(result.appliedStyles.every((s, i) => s.indexOf('pf-' + result.appliedNames[i]) !== -1),
            'Applied preview must carry the chosen template class: ' + JSON.stringify(result.appliedStyles));
        assert(result.galleryBtnVisible && result.galleryOpened, 'Templates button must open the gallery at every width: ' + JSON.stringify(result));
        assert.strictEqual(result.galleryCards, result.registry.templates.length,
            'Gallery must present all ' + result.registry.templates.length + ' templates');
        assert.deepStrictEqual(result.galleryIds, result.registry.templates,
            'Gallery order must match the template registry');
        assert.strictEqual(result.galleryPickCount, result.registry.templates.length, 'Every card needs exactly one choose button');
        assert(result.galleryPreviews && result.galleryStageScaled,
            'Every card must embed a correctly scaled live portfolio preview: ' + JSON.stringify(result));
        assert.deepStrictEqual(result.galleryPerCard,
            result.registry.templates.map(id => 'pf-root pf-dark pf-purple pf-' + id),
            'Each card must preview its OWN template design: ' + JSON.stringify(result.galleryPerCard));
        assert(result.galleryNoOverflow, 'Gallery must not overflow horizontally');
        assert(result.gallerySingleActive && result.galleryActiveCard, 'Gallery must mark exactly the active template');
        assert(result.galleryThemeMatches && result.galleryAccentMatches,
            'Thumbnails must follow the chosen theme and accent color');
        assert(result.galleryChosen.view && result.galleryChosen.cls.indexOf('pf-creative') !== -1 &&
            result.galleryChosen.saved === 'creative' && result.galleryChosen.checked === 0 &&
            result.galleryChosen.note.indexOf('Creative') !== -1 &&
            result.galleryChosen.content && result.galleryChosen.data,
            'Choosing a template must regenerate the portfolio with it and leave the resume untouched: ' +
            JSON.stringify(result.galleryChosen));
        assert(result.galleryReflectsChoice, 'Reopening the gallery must show the chosen template as active');
        assert.strictEqual(result.galleryNoResumeCards, result.registry.templates.length,
            'Gallery must be explorable before a resume is uploaded');
        assert(result.galleryNoResumeGoesHome, 'Choosing a template without a resume must not break the app');
        console.log('PASS browser sidebar, appearance, export, templates gallery, and layout at ' + width + 'px');
    }
} finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
