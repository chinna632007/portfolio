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
    window.addEventListener('load', function () {
        const results = {};
        try {
            App.saveData(ResumeAnalyzer.analyze(sample, 'resumeA.txt'));
            App.show('view-preview');
            PortfolioGenerator.initPreviewPage();
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
    for (const width of [1200, 500]) {
        const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--user-data-dir=' + path.join(temp, 'profile-' + width), '--window-size=' + width + ',900',
            '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(fixture).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
        if (run.error) throw run.error;
        const match = run.stdout.match(/<pre id="browser-report">([^<]+)<\/pre>/);
        assert(match, 'Browser did not produce a result: ' + run.stderr);
        const result = JSON.parse(match[1]);
        assert(!result.error, result.error);
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
        console.log('PASS browser editor, source order, vertical sections, declaration, and layout at ' + width + 'px');
    }
} finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
