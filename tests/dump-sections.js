/* Dump the analyzed sections (type + lines) of a resume file for layout work.
   Usage: node tests/dump-sections.js <absolute-path-to-resume> */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const file = process.argv[2];
if (!file || !path.isAbsolute(file)) throw new Error('Provide the absolute path to the resume file.');
const isPdf = /\.pdf$/i.test(file);
const context = { console, Uint8Array, Promise, document: { addEventListener() {} }, location: { href: 'file:///resume/index.html' } };
if (isPdf) {
    const pdf = require(path.join(root, 'lib/pdf.min.js'));
    context.pdfjsWorker = { WorkerMessageHandler: {} };
    context.pdfjsLib = {
        GlobalWorkerOptions: {},
        getDocument(options) {
            pdf.GlobalWorkerOptions.workerSrc = path.join(root, 'lib/pdf.worker.min.js');
            return pdf.getDocument(options);
        }
    };
}
context.window = context;
vm.createContext(context);
['app.js', 'pdfParser.js', 'docxParser.js', 'resumeAnalyzer.js'].forEach(name => {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context, { filename: name });
});
(async function () {
    const bytes = fs.readFileSync(file);
    const payload = isPdf
        ? { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
        : { text: bytes.toString('utf8') };
    const parser = isPdf ? context.PdfParser : context.DocxParser;
    const text = await parser.parse(payload);
    const parsed = context.ResumeAnalyzer.analyze(text, path.basename(file));
    parsed.sections.forEach(section => {
        console.log('\n== ' + (section.original || '(untitled)') + '  [type: ' + section.type + ']');
        section.lines.forEach(line => console.log('   | ' + JSON.stringify(line)));
    });
})().catch(error => { console.error(error); process.exitCode = 1; });
