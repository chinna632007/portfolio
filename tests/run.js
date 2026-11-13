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
    scrollTo() {},
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
const FILES = ['js/app.js', 'js/resumeAnalyzer.js', 'js/portfolioGenerator.js', 'js/templates.js',
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
ok(!!sandbox.Templates && typeof sandbox.Templates.open === 'function' && typeof sandbox.Templates.choose === 'function',
    'Templates gallery page exposes open/choose');
/* ---------------- sample resumes (3 different layouts) ---------------- */
const SAMPLES = [
    {
        file: 'resumeA.txt', name: 'ANJALI SHARMA', email: 'anjali.sharma@example.com',
        location: 'Bengaluru, Karnataka, India',
        titles: ['Career Objective', 'Education', 'Skills', 'Projects', 'Contact Information'],
        inventedAbsent: ['About Me'],
        spot: ['CGPA: 8.7 / 10', 'Rajiv Gandhi Institute of Technology, Bengaluru',
            'E-Commerce Web Application', 'Razorpay payment integration',
            'Weather Forecast App', 'Tailwind CSS', 'linkedin.com/in/anjali-sharma']
    },
    {
        file: 'resumeB.txt', name: 'ROHAN VERMA', email: 'rohan.verma@example.com',
        location: 'Pune, Maharashtra',
        titles: ['Professional Summary', 'Experience', 'Internships', 'Technical Skills',
            'Certifications', 'Achievements', 'Languages'],
        inventedAbsent: ['About Me'],
        spot: ['Full Stack Developer | Cloud Enthusiast', 'Smart India Hackathon 2022',
            'AWS Certified Solutions Architect - Associate', 'Zoho Corporation',
            'cutting deploy', 'Marathi (Conversational)']
    },
    {
        file: 'resumeC.txt', name: 'PRIYA NAIR', email: 'priya.nair@example.com',
        location: 'Kochi, Kerala',
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

/* ---------- structured-layout helpers ---------- */
/* mirrors the generator's sectionId() so a section can be sliced out */
function sectionId(idx, title) {
    const s = String(title || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    return 'pf-s' + String(idx + 1).padStart(2, '0') + '-' + s;
}
function sectionChunk(html, id) {
    const start = html.indexOf('id="' + id + '"');
    if (start === -1) return '';
    const next = html.indexOf('id="pf-s', start + 6);
    return html.slice(start, next === -1 ? html.length : next);
}
const countIn = (chunk, re) => (chunk.match(re) || []).length;
/* mirrors the generator's bracket-aware value splitter */
function splitValuesLike(text) {
    const parts = [];
    let buf = '', depth = 0;
    for (const ch of String(text == null ? '' : text)) {
        if ('([{'.indexOf(ch) !== -1) { depth++; }
        else if (')]}'.indexOf(ch) !== -1) { depth = Math.max(0, depth - 1); }
        else if (depth === 0 && (ch === ',' || ch === ';' || ch === '|' ||
            ch === '\u2022' || ch === '\u25aa' || ch === '\u00b7')) { parts.push(buf); buf = ''; continue; }
        buf += ch;
    }
    parts.push(buf);
    return parts.map((p) => p.replace(/^[\-*\u00b7\u2022\u25aa\s]+/, '').replace(/[\s\u2022\u00b7*]+$/, '').trim()).filter(Boolean);
}

/* ---------- expected layout of the generated portfolio ---------- */
const STRUCTURE = {
    'resumeA.txt': {
        'Education': { entries: 3, subs: 3, metas: 3 },
        'Skills': { skillGroups: 1, labels: [], chips: 17 },
        'Projects': { entries: 3, texts: 3 },
        'Contact Information': { chips: 7 }
    },
    'resumeB.txt': {
        'Experience': { entries: 2, items: 5 },
        'Internships': { entries: 1, items: 2 },
        'Technical Skills': {
            skillGroups: 4, chips: 14,
            labels: ['Languages', 'Frameworks', 'Cloud & DevOps', 'Databases']
        },
        'Certifications': { entries: 3, grids: 1 },
        'Achievements': { entries: 3, grids: 1 },
        'Languages': { chips: 4 }
    },
    'resumeC.txt': {
        'Education': { entries: 2, subs: 2, metas: 2 },
        'Projects': { entries: 3, texts: 3 },
        'Skills': { skillGroups: 1, labels: [], chips: 12 },
        'Hobbies': { chips: 5 },
        'Social Links': { entries: 4, grids: 1 },
        'Extra Curricular Activities': { entries: 3, grids: 1 }
    }
};

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
    ok(parsed.personalInfo.location === S.location, 'extracts exact location "' + S.location + '"');

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
    if (S.file === 'resumeB.txt') ok(html.indexOf('class="pf-hero-role') !== -1, 'hero shows role (exists in resume)');
    else ok(html.indexOf('class="pf-hero-role') === -1, 'hero invents no role (none in resume)');

    /* the hero header must never mistake a skills row for the location */
    const heroPills = (html.match(/<div class="pf-hero-pills">[\s\S]*?<\/div>/) || [''])[0];
    ok(heroPills.indexOf('REST APIs') === -1 && heroPills.indexOf('Figma') === -1,
        'hero never mistakes a skills row for the location');
    ok(heroPills.indexOf(esc(S.location)) !== -1, 'hero shows the location from the resume');

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

    /* standalone export ships the same design system + working motion */
    ok(sg.indexOf('pf-progress') !== -1, 'standalone export keeps the reading-progress bar');
    ok(sg.indexOf('.pf-skill-group{') !== -1 && sg.indexOf('@keyframes pfFloat') !== -1,
        'standalone export ships the skills/motion CSS');
    ok(sg.indexOf('.pf-root .reveal.visible{') !== -1, 'standalone export can reveal on scroll');
    let inlineOk = true, inlineMsg = '';
    try {
        new Function(sg.slice(sg.indexOf('<script>') + 8, sg.lastIndexOf('</script>')));
    } catch (e) { inlineOk = false; inlineMsg = e.message; }
    ok(inlineOk, 'standalone export script is valid JavaScript' + (inlineMsg ? ' (' + inlineMsg + ')' : ''));

    /* ---------- structured layout: skills categories + ordered cards ---------- */
    const titledSections = parsed.sections.filter((s) => s.original);
    const expected = STRUCTURE[S.file] || {};
    Object.keys(expected).forEach((title) => {
        const idx = titledSections.findIndex((s) => s.original === title);
        ok(idx !== -1, 'layout: "' + title + '" section present');
        if (idx === -1) return;
        const chunk = sectionChunk(html, sectionId(idx, title));
        ok(chunk !== '', 'layout: "' + title + '" has its own anchored section');
        const exp = expected[title];
        if (exp.entries !== undefined) {
            ok(countIn(chunk, /class="pf-entry reveal/g) === exp.entries,
                'layout: "' + title + '" renders ' + exp.entries + ' card(s) in resume order');
        }
        if (exp.subs !== undefined) {
            ok(countIn(chunk, /class="pf-entry-sub"/g) === exp.subs,
                'layout: "' + title + '" shows ' + exp.subs + ' subtitle(s)');
        }
        if (exp.metas !== undefined) {
            ok(countIn(chunk, /class="pf-entry-meta"/g) === exp.metas,
                'layout: "' + title + '" shows ' + exp.metas + ' date/score badge(s)');
        }
        if (exp.items !== undefined) {
            ok(countIn(chunk, /<li class="reveal/g) === exp.items,
                'layout: "' + title + '" turns ' + exp.items + ' lines into highlight list items');
        }
        if (exp.texts !== undefined) {
            ok(countIn(chunk, /class="pf-entry-text"/g) === exp.texts,
                'layout: "' + title + '" wraps descriptions in ' + exp.texts + ' paragraph(s)');
        }
        if (exp.grids !== undefined) {
            ok(countIn(chunk, /class="pf-entries-grid"/g) === exp.grids,
                'layout: "' + title + '" uses a compact card grid');
        }
        if (exp.skillGroups !== undefined) {
            ok(countIn(chunk, /class="pf-skill-group reveal"/g) === exp.skillGroups,
                'layout: "' + title + '" builds ' + exp.skillGroups + ' skill category group(s)');
        }
        if (exp.chips !== undefined) {
            ok(countIn(chunk, /class="pf-chip reveal"/g) === exp.chips,
                'layout: "' + title + '" shows ' + exp.chips + ' chip(s)');
        }
        if (exp.labels) {
            const found = (chunk.match(/pf-skill-group-label">([^<]*)</g) || [])
                .map((m) => m.replace('pf-skill-group-label">', '').replace(/<$/, ''));
            ok(JSON.stringify(found) === JSON.stringify(exp.labels.map(esc)),
                'layout: "' + title + '" keeps the category labels in resume order');
        }
    });

    /* labelled skill lines keep their category AND every single value */
    parsed.sections.filter((s) => s.type === 'skills').forEach((sec) => {
        sec.lines.forEach((line) => {
            const m = line.match(/^([A-Za-z][^:,;|]{1,34}?)\s*:\s*(\S.*)$/);
            if (!m) return;
            const label = m[1].trim();
            ok(html.indexOf(esc(label)) !== -1, 'skills: category "' + clip(label) + '" preserved');
            splitValuesLike(m[2]).forEach((v) => {
                ok(html.indexOf(esc(v)) !== -1, 'skills: value "' + clip(v) + '" preserved');
            });
        });
    });
});

head('Project presentation regressions');
const projectResume = RA.analyze([
    'RAVI KUMAR', 'Projects', 'Smart Health Monitor',
    'Built a live dashboard', 'for patient monitoring.',
    'Technologies: Arduino, Node.js, AWS (EC2, S3)',
    '- JWT Authentication', '- Delivered alerts in under two seconds',
    'with SMS notifications.', 'Source: https://github.com/ravi/health', '',
    'campus voting portal', 'Created a secure voting portal.',
    'Tech stack: React, PostgreSQL', '',
    'Certifications', 'Cloud Practitioner', 'Skills', 'Languages: Java, Python'
].join('\n'), 'projects.txt');
const projectOutput = PG.render(projectResume, {});
const cards = projectOutput.match(/<article class="pf-entry reveal pf-project"[\s\S]*?<\/article>/g) || [];
ok(cards.length === 2, 'projects: two cards, including a lowercase title after a blank separator');
ok(projectResume.sections[0].breakBefore.length === 1, 'analyzer retains project boundary metadata');
ok(cards[0] && cards[0].includes('<h3 class="pf-entry-title">Smart Health Monitor</h3>'), 'projects: semantic project heading');
ok(cards[0] && cards[0].includes('<p class="pf-entry-text">Built a live dashboard for patient monitoring.</p>'), 'projects: short descriptions remain paragraphs, not subtitles');
ok(cards[0] && cards[0].includes('<li>JWT Authentication</li>'), 'projects: title-case bullet is a highlight, not a new card');
ok(cards[0] && cards[0].includes('Delivered alerts in under two seconds with SMS notifications.</li>'), 'projects: wrapped bullet remains one highlight');
ok(cards[0] && cards[0].includes('<dt>Technologies</dt>') && cards[0].includes('>AWS (EC2, S3)</span>'), 'projects: explicit technology labels and bracketed values preserved');
ok(cards[0] && cards[0].includes('href="https://github.com/ravi/health" target="_blank" rel="noopener noreferrer"'), 'projects: source URL is clickable with safe external-link attributes');
ok(cards[1] && cards[1].includes('campus voting portal') && !cards[1].includes('Arduino'), 'projects: descriptions and stacks stay with their project');
ok(projectOutput.indexOf('>Certifications</h2>') > projectOutput.lastIndexOf('</article>'), 'remaining sections stay separate and follow resume order');
const oldData = JSON.parse(JSON.stringify(projectResume));
delete oldData.sections[0].breakBefore;
oldData.sections[0].lines = ['1. First Project', 'Built a website.', '2. Second Project', 'Created a quiz.'];
ok((PG.render(oldData, {}).match(/<article /g) || []).length === 2, 'projects: older saved data without boundary metadata still renders');
const unsafe = JSON.parse(JSON.stringify(oldData));
unsafe.sections[0].lines = ['Example Project', 'Built <script>alert(1)</script> safely.', 'URL: javascript:alert(1)'];
const safeHtml = PG.render(unsafe, {});
ok(safeHtml.includes('&lt;script&gt;') && !safeHtml.includes('href="javascript:'), 'projects: uploaded markup is escaped and script URLs are not linked');
const projectExport = PG.buildStandalone(projectResume, { theme: 'dark' });
const sharedStyle = projectOutput.match(/<style>([\s\S]*?)<\/style>/)[1];
ok(projectExport.includes(sharedStyle), 'preview and export share identical layout refinements');
ok(sharedStyle.includes('@media(max-width:640px)') && sharedStyle.includes('grid-template-columns: minmax(0, 1fr)'), 'layout includes single-column mobile cards');
ok(sharedStyle.includes('@media(prefers-reduced-motion:reduce)') && sharedStyle.includes('@media print'), 'layout supports reduced motion and visible printed content');

head('TEMPLATE GALLERY + TEMPLATE / COLOR REGISTRIES');
const TPL = sandbox.Templates;
const tplIds = PG.templateIds;
const tplParsed = RA.analyze(fs.readFileSync(path.join(__dirname, 'samples/resumeA.txt'), 'utf8'), 'resumeA.txt');

ok(PG.templates.length >= 10 && PG.templates.length <= 15,
    'template registry lists 10-15 unique designs (' + PG.templates.length + ')');
ok(PG.colors.length >= 10 && PG.colors.length <= 20,
    'accent registry offers a full palette set (' + PG.colors.length + ' colors)');
ok(new Set(PG.colorIds).size === PG.colorIds.length, 'accent color ids are unique');
ok(PG.colors.every((c) => c.name && /^#[0-9a-f]{6}$/i.test(c.accent) && /^#[0-9a-f]{6}$/i.test(c.accent2)),
    'every accent color defines a name plus both accent stops');
ok(PG.featuredIds.length === 3, 'the sidebar is limited to the 3 best templates');
ok(PG.featuredIds.every((id) => tplIds.indexOf(id) !== -1), 'the featured three are real registered templates');

/* every registered color must ship a rule for BOTH themes, or the swatch
   would look dead (this is the bug that made colors appear to do nothing) */
const themeCss = PG.layoutCss();
ok(PG.colors.every((c) => themeCss.indexOf('.pf-root.pf-' + c.id + '{--pf-accent:' + c.accent + ';') !== -1),
    'every accent color ships its own variable rule');
ok(PG.colors.every((c) => themeCss.indexOf('.pf-root.pf-dark.pf-' + c.id + '{--pf-accent-soft:') !== -1),
    'every accent color keeps a stronger tint in dark mode');
ok(PG.colorIds.every((c) => PG.buildStandalone(tplParsed, { theme: 'dark', color: c, layout: 'modern' })
        .indexOf('.pf-root.pf-' + c + '{--pf-accent:') !== -1),
    'every accent color travels into the exported HTML');

/* the sidebar controls are generated from the registries */
PG.buildPicker();
const sidebarTpl = els.templateOptions.innerHTML;
const sidebarColor = els.colorOptions.innerHTML;
ok((sidebarTpl.match(/name="layout"/g) || []).length === 3, 'sidebar renders exactly the 3 featured template tiles');
ok(PG.featuredIds.every((id) => sidebarTpl.indexOf('value="' + id + '"') !== -1),
    'sidebar tiles are the featured designs');
ok(tplIds.filter((id) => PG.featuredIds.indexOf(id) === -1)
        .every((id) => sidebarTpl.indexOf('value="' + id + '"') === -1),
    'non-featured designs are never offered in the sidebar');
ok((sidebarColor.match(/name="color"/g) || []).length === PG.colors.length,
    'sidebar renders one swatch per registered accent color');
ok(PG.colorIds.every((id) => sidebarColor.indexOf('value="' + id + '"') !== -1),
    'every registered accent color is offered in the sidebar');
ok(PG.colors.every((c) => sidebarColor.indexOf(c.accent) !== -1),
    'each swatch paints its own accent color');
ok(new Set(tplIds).size === tplIds.length, 'template ids are unique');
ok(PG.templates.every((t) => t.id && t.name && t.tagline && t.blurb && (t.tags || []).length),
    'every template describes itself (name, tagline, blurb, tags)');

/* one shared stylesheet: preview and export, every design included.
   "modern" is the base design, so it needs no extra rule of its own. */
const designCss = PG.render(tplParsed, {}).match(/<style>([\s\S]*?)<\/style>/)[1];
tplIds.forEach((id) => {
    const styled = id === 'modern' || designCss.indexOf('.pf-root.pf-' + id + ' ') !== -1;
    ok(styled, 'design CSS shipped for "' + id + '"' + (id === 'modern' ? ' (base design)' : ''));
});
ok(designCss.indexOf('@keyframes pfSpin') !== -1, 'creative template ships its spinning ring keyframes');
ok(PG.templates.every((t) => t.tags.length >= 2), 'every template lists at least two feature tags for the gallery');

/* a template must only change the ROOT CLASS - never the resume markup */
const htmlFor = (id) => PG.render(tplParsed, { layout: id });
const stripRoot = (html) => html.replace(/^<div class="pf-root[^"]*">/, '');
ok(new Set(tplIds.map((id) => htmlFor(id).match(/^<div class="(pf-root[^"]*)"/)[1])).size === tplIds.length,
    'each template renders a distinct appearance class');
ok(tplIds.every((id) => stripRoot(htmlFor(id)) === stripRoot(htmlFor('modern'))),
    'no template alters a single line of resume markup - only the root class changes');
ok(tplIds.every((id) => PG.buildStandalone(tplParsed, { theme: 'dark', color: 'amber', layout: id })
        .indexOf('.pf-root.pf-' + id + ' ') !== -1),
    'every template travels into the exported HTML');
ok(PG.appearanceClasses({ theme: 'dark', color: 'rose', layout: 'creative' }) === 'pf-root pf-dark pf-rose pf-creative',
    'appearance class builder accepts every registered template');
ok(PG.appearanceClasses({ layout: 'nonsense' }) === 'pf-root pf-light pf-indigo pf-modern',
    'an unknown template falls back to the default instead of breaking the render');

/* the gallery page itself */
TPL.render();
const gallery = els.templateGallery.innerHTML;
ok((gallery.match(/class="tpl-pick"/g) || []).length === tplIds.length,
    'gallery renders exactly one choose button per template');
ok((gallery.match(/<style>/g) || []).length === 1,
    'gallery injects the shared stylesheet once instead of once per card');
ok((gallery.match(/<div class="pf-root /g) || []).length === tplIds.length,
    'every gallery card embeds a real generated portfolio preview');
const galleryCards = gallery.split('<article class="tpl-card').slice(1);
ok(galleryCards.length === tplIds.length, 'gallery contains one card per template');
ok(galleryCards.every((card, i) => card.indexOf('pf-' + tplIds[i] + '"') !== -1),
    'each gallery card previews its own template design, not the currently selected one');
ok(tplIds.every((id) => gallery.indexOf('data-template="' + id + '"') !== -1),
    'gallery cards are wired to their template id');
ok(PG.templates.every((t) => gallery.indexOf(esc(t.name)) !== -1 && gallery.indexOf(esc(t.blurb)) !== -1),
    'gallery shows every template name and description');
ok(gallery.indexOf('aria-pressed="true"') !== -1 && gallery.indexOf('aria-pressed="false"') !== -1,
    'gallery marks the active template for assistive tech');
ok(els.templateCurrent.textContent.indexOf('Currently using:') === 0,
    'gallery reports the currently applied template');

/* choosing from the gallery persists the choice (no resume = stay on home) */
sandbox.App.clearData();
TPL.choose('creative');
ok(sandbox.App.getCustom().layout === 'creative', 'choosing a template saves it as the active template');
TPL.choose('not-a-template');
ok(sandbox.App.getCustom().layout === 'creative', 'an unknown template id never corrupts the saved choice');

head('RESULT');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
if (failed.length) { console.log('\nFailed assertions:'); failed.forEach((f) => console.log('   - ' + f)); process.exit(1); }
console.log('  ALL CHECKS GREEN — every sample line preserved, no fake data, order intact.');

