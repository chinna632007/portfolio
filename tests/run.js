/* =========================================================
   tests/run.js - headless verification suite
   Loads the REAL app scripts (app, analyzer, generator, parsers,
   upload, animations) into a Node VM with browser stubs, then
   pushes three DIFFERENT sample resumes through the full pipeline:
   analyze -> validate -> render -> export.
   Asserts: exact original titles, original order, 100% content
   preservation, no invented data, dynamic nav, customization.
   Run:  node tests/run.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const failed = [];
function ok(c, label) {
    if (c) { pass++; console.log('  PASS  ' + label); }
    else { fail++; failed.push(label); console.log('  FAIL  ' + label); }
}
function head(n) { console.log('\n================ ' + n + ' ================'); }
const clip = (s) => (s.length > 44 ? s.slice(0, 44) + '…' : s);
/* mirrors App.escapeHtml exactly */
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------------- minimal browser sandbox ---------------- */
function makeEl(tag) {
    return {
        tagName: String(tag || 'div').toUpperCase(), children: [], attrs: {}, style: {},
        disabled: false, offsetTop: 0, id: '', hidden: true, textContent: '', value: '',
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute(n, v) { this.attrs[n] = String(v); },
        getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
        removeAttribute(n) { delete this.attrs[n]; },
        addEventListener() {}, removeEventListener() {},
        appendChild(c) { this.children.push(c); return c; },
        remove() {}, click() {}, focus() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
        closest() { return null; },
        get firstChild() { return this.children[0] || null; },
        set innerHTML(v) { this._html = String(v); this.children = []; },
        get innerHTML() { return this._html || ''; }
    };
}
const store = {};
const els = {};
const sandbox = {
    console, setTimeout, clearTimeout,
    requestAnimationFrame(fn) { return setTimeout(() => fn(Date.now()), 0); },
    confirm() { return false; }, alert() {},
    CustomEvent: function (t) { this.type = t; },
    Blob: function (p, o) { this.parts = p; this.options = o; },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    localStorage: {
        getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem(k, v) { store[k] = String(v); },
        removeItem(k) { delete store[k]; }
    },
    document: {
        addEventListener() {}, removeEventListener() {},
        createElement(t) { return makeEl(t); },
        getElementById(id) { if (!els[id]) { els[id] = makeEl('div'); els[id].id = id; } return els[id]; },
        querySelector() { return null; }, querySelectorAll() { return []; },
        body: makeEl('body'), documentElement: makeEl('html')
    }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

/* ---------------- load scripts exactly like index.html ---------------- */
const FILES = ['js/app.js', 'js/resumeAnalyzer.js', 'js/portfolioGenerator.js',
    'js/pdfParser.js', 'js/docxParser.js', 'js/upload.js', 'js/animations.js'];

head('Module load smoke test (index.html script order)');
FILES.forEach((f) => {
    try {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
        ok(true, f + ' loads without runtime errors');
    } catch (e) { ok(false, f + ' loads -> ' + e.message); }
});
const RA = sandbox.ResumeAnalyzer;
const PG = sandbox.PortfolioGenerator;
ok(!!RA && typeof RA.analyze === 'function' && typeof RA.classify === 'function', 'ResumeAnalyzer exposes analyze/classify/validate');
ok(!!PG && typeof PG.render === 'function', 'PortfolioGenerator exposes render');
ok(!!sandbox.Upload && !!sandbox.Animations && !!sandbox.PdfParser && !!sandbox.DocxParser, 'Upload/Animations/PdfParser/DocxParser exposed');
/* ---------------- sample resumes (3 different layouts) ---------------- */
const SAMPLES = [
    {
        file: 'resumeA.txt', name: 'ANJALI SHARMA', email: 'anjali.sharma@example.com',
        titles: ['Career Objective', 'Education', 'Skills', 'Projects', 'Contact Information'],
        inventedAbsent: ['About Me'],
        spot: ['CGPA: 8.7 / 10', 'Rajiv Gandhi Institute of Technology, Bengaluru',
            'E-Commerce Web Application', 'Razorpay payment integration',
            'Weather Forecast App', 'Tailwind CSS', 'linkedin.com/in/anjali-sharma']
    },
    {
        file: 'resumeB.txt', name: 'ROHAN VERMA', email: 'rohan.verma@example.com',
        titles: ['Professional Summary', 'Experience', 'Internships', 'Technical Skills',
            'Certifications', 'Achievements', 'Languages'],
        inventedAbsent: ['About Me'],
        spot: ['Full Stack Developer | Cloud Enthusiast', 'Smart India Hackathon 2022',
            'AWS Certified Solutions Architect - Associate', 'Zoho Corporation',
            'cutting deploy', 'Marathi (Conversational)']
    },
    {
        file: 'resumeC.txt', name: 'PRIYA NAIR', email: 'priya.nair@example.com',
        titles: ['Profile', 'Education', 'Projects', 'Skills', 'Hobbies', 'Social Links',
            'Extra Curricular Activities'],
        inventedAbsent: ['Full Stack Developer'],
        spot: ['National Institute of Design, Ahmedabad', 'Watercolor painting',
            'https://dribbble.com/priyanair', 'Runner-up, Inter-college UI Design Championship 2021']
    }
];

function chipUnits(line) {
    return line.split(/[,;|\u2022]/)
        .map((p) => p.replace(/^[-\u2022\u00b7*\s]+/, '').replace(/[\s-\u2022\u00b7*]+$/, '').trim())
        .filter(Boolean);
}

SAMPLES.forEach((S) => {
    head('Sample ' + S.file.toUpperCase());
    const text = fs.readFileSync(path.join(ROOT, 'tests', 'samples', S.file), 'utf8');

    /* analyze (steps 1-5 of the workflow) */
    const parsed = RA.analyze(text);
    const titled = parsed.sections.filter((s) => s.original).map((s) => s.original);
    ok(JSON.stringify(titled) === JSON.stringify(S.titles),
        'detects exact original titles in original order (' + titled.length + ' titled sections)');
    ok(parsed.personalInfo.name === S.name, 'extracts exact name "' + S.name + '"');
    ok(parsed.personalInfo.email === S.email, 'extracts exact email');

    /* validation / integrity */
    const rep = RA.validate(parsed);
    ok(rep.sectionCount === parsed.sections.length && rep.warnings.indexOf('No headings detected') === -1,
        'validate: ' + rep.sectionCount + ' sections preserved, 0 lost');
    ok(rep.warnings.filter((w) => w.indexOf('Empty section') === 0).length === 0, 'validate: no empty sections');

    /* 100% raw-content preservation inside structured data (compare in
       JSON-escaped form so quotes in lines like "fast-json-mask" match) */
    const blob = JSON.stringify(parsed);
    const missed = text.split('\n').map((l) => l.trim()).filter((l) => l && S.titles.indexOf(l) === -1)
        .filter((l) => blob.indexOf(JSON.stringify(l).slice(1, -1)) === -1);
    ok(missed.length === 0, 'every resume line survives analysis' +
        (missed.length ? ' (missing: ' + missed.slice(0, 4).join(' | ') + ')' : ''));
    /* render */
    const html = PG.render(parsed, {});

    /* every content line / chip token appears in the rendered portfolio */
    parsed.sections.forEach((sec) => {
        const isChips = ['skills', 'languages', 'hobbies', 'contact'].indexOf(sec.type) !== -1;
        sec.lines.forEach((line) => {
            if (isChips) {
                chipUnits(line).forEach((u) => ok(html.indexOf(esc(u)) !== -1, 'renders "' + clip(u) + '"'));
            } else {
                ok(html.indexOf(esc(line)) !== -1, 'renders "' + clip(line) + '"');
            }
        });
    });

    /* titles + order in the HTML */
    let last = -1, orderOk = true;
    S.titles.forEach((t) => {
        const i = html.indexOf(esc(t));
        if (i === -1 || i < last) orderOk = false;
        last = i;
    });
    ok(orderOk, 'portfolio shows all titles in original resume order');

    /* spot-check key content */
    S.spot.forEach((s) => ok(html.indexOf(esc(s)) !== -1, 'spot content preserved: "' + clip(s) + '"'));

    /* NO fake data */
    ok(html.toLowerCase().indexOf('lorem ipsum') === -1, 'no placeholder/fake text');
    S.inventedAbsent.forEach((s) => ok(html.indexOf(s) === -1, 'does not invent "' + s + '"'));

    /* dynamic navigation + anchors */
    const navLinks = (html.match(/href="#pf-s\d+/g) || []).length;
    const anchorIds = (html.match(/id="pf-s\d+/g) || []).length;
    ok(navLinks === S.titles.length, 'navigation auto-built with ' + S.titles.length + ' detected sections');
    ok(anchorIds === parsed.sections.length, 'every section has an anchor target');

    /* hero shows only what exists */
    ok(html.indexOf(esc(S.name)) !== -1, 'hero shows exact name');
    if (S.file === 'resumeB.txt') ok(html.indexOf('pf-hero-role') !== -1, 'hero shows role (exists in resume)');
    else ok(html.indexOf('pf-hero-role') === -1, 'hero invents no role (none in resume)');

    /* customization: hide a section */
    const hiddenHtml = PG.render(parsed, { hidden: [S.titles[2]] });
    ok((hiddenHtml.match(/href="#pf-s\d+/g) || []).length === S.titles.length - 1,
        'hidden section removed from navigation');
    ok(hiddenHtml.length < html.length, 'hidden section removed from portfolio');

    /* standalone export */
    const sg = PG.buildStandalone(parsed, {});
    ok(sg.indexOf('<!DOCTYPE html>') === 0 && sg.slice(-7) === '</html>', 'standalone export is a complete HTML file');
    ok(sg.indexOf(esc(S.name)) !== -1 && S.titles.every((t) => sg.indexOf(esc(t)) !== -1),
        'standalone export keeps name + all titles');
});

head('RESULT');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
if (failed.length) { console.log('\nFailed assertions:'); failed.forEach((f) => console.log('   - ' + f)); process.exit(1); }
console.log('  ALL CHECKS GREEN — every sample line preserved, no fake data, order intact.');

