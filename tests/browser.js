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
            const appearanceRoot = document.querySelector('#portfolioPreview .pf-root');
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
            results.paletteMatrix = true;
            const palette = { indigo: '#6366f1', blue: '#3b82f6', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', purple: '#8b5cf6' };
            for (const layout of ['modern', 'minimal', 'professional']) {
                document.querySelector('input[name="layout"][value="' + layout + '"]').closest('label').querySelector('strong').click();
                const heroStyle = getComputedStyle(appearanceRoot.querySelector('.pf-hero'));
                results.templateStyles.push([heroStyle.textAlign, heroStyle.borderTopWidth,
                    getComputedStyle(appearanceRoot.querySelector('.pf-hero-avatar')).borderRadius].join('|'));
                for (const theme of ['light', 'dark']) {
                    document.querySelector('input[name="theme"][value="' + theme + '"]').click();
                    for (const color of Object.keys(palette)) {
                        document.querySelector('input[name="color"][value="' + color + '"]').closest('label').querySelector('span').click();
                        const style = getComputedStyle(appearanceRoot);
                        results.paletteMatrix = results.paletteMatrix && style.getPropertyValue('--pf-accent').trim() === palette[color] &&
                            style.backgroundColor === (theme === 'dark' ? 'rgb(11, 18, 32)' : 'rgb(248, 250, 252)');
                    }
                }
            }
            results.appearanceKeepsContent = appearanceRoot === document.querySelector('#portfolioPreview .pf-root') &&
                contentBefore === Array.from(appearanceRoot.querySelectorAll('.pf-section')).map(el => el.textContent).join('|') &&
                sourceBefore === JSON.stringify(App.getData());
            PortfolioGenerator.initPreviewPage();
            results.appearanceRestored = document.querySelector('#portfolioPreview .pf-root').className === 'pf-root pf-dark pf-purple pf-professional';
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
        assert.strictEqual(new Set(result.templateStyles).size, 3, 'Templates must have visibly distinct layouts');
        console.log('PASS browser sidebar, appearance, export, repeated generation, and layout at ' + width + 'px');
    }
} finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
