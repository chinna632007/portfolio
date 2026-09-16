/* Verify the main headings of the local resume using the real PDF pipeline.
   Usage: node tests/pdf-headings.js <absolute-path-to-my_resume.pdf>
   Stores headings only (not resume personal details) in the OS temp directory. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const os = require('os');
const root = path.resolve(__dirname, '..');
const file = process.argv[2];
if (!file || !path.isAbsolute(file)) throw new Error('Provide the absolute path to the resume PDF.');
const pdf = require(path.join(root, 'lib/pdf.min.js'));
const context = {
    console, Uint8Array, Promise,
    document: { addEventListener() {} },
    location: { href: 'file:///resume/index.html' },
    pdfjsWorker: { WorkerMessageHandler: {} },
    pdfjsLib: {
        GlobalWorkerOptions: {},
        getDocument(options) {
            pdf.GlobalWorkerOptions.workerSrc = path.join(root, 'lib/pdf.worker.min.js');
            return pdf.getDocument(options);
        }
    }
};
context.window = context;
vm.createContext(context);
['app.js', 'pdfParser.js', 'resumeAnalyzer.js', 'portfolioGenerator.js'].forEach(name => {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context, { filename: name });
});
(async function () {
    const bytes = fs.readFileSync(file);
    const text = await context.PdfParser.parse({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    // Independently transcribed from the PDF, not obtained from the classifier.
    const expected = ['Career Objective', 'Education', 'Technical Skills', 'Projects',
        'Internship Experience', 'Certifications and Achievements', 'Soft Skills', 'Personal Details', 'Declaration'];
    const extracted = text.split('\n').map(line => line.trim()).filter(line => expected.includes(line));
    const parsed = context.ResumeAnalyzer.analyze(text, path.basename(file));
    const html = context.PortfolioGenerator.render(parsed, {});
    const generated = Array.from(html.matchAll(/<h2 class="pf-section-title">([^<]*)<\/h2>/g), match => match[1]);
    const rows = ['PDF MAIN HEADING                         | PORTFOLIO MAIN HEADING'];
    for (let i = 0; i < Math.max(extracted.length, generated.length); i++) {
        rows.push((extracted[i] || '(missing)').padEnd(40) + '| ' + (generated[i] || '(missing)'));
    }
    const report = path.join(os.tmpdir(), 'portfolio-heading-comparison.txt');
    fs.writeFileSync(report, rows.join('\n') + '\n');
    console.log(rows.join('\n'));
    console.log('\nSaved: ' + report);
    assert.deepStrictEqual(extracted, expected, 'PDF extraction must contain all independently identified headings in order');
    assert.deepStrictEqual(generated, extracted, 'Portfolio main headings must exactly match the PDF');
    const projects = parsed.sections.find(section => section.type === 'projects');
    assert(projects && !projects.lines.some(line => expected.slice(4).includes(line)), 'Later headings must not leak into Projects');
    assert.strictEqual((html.match(/<article class="pf-entry reveal pf-project"/g) || []).length, 3, 'The PDF has three projects');
    console.log('PASS: all 9 main headings match in order; later sections stay outside the 3 project cards.');
})().catch(error => { console.error(error); process.exitCode = 1; });
