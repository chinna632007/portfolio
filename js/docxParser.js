/* =========================================================
   docxParser.js - extracts COMPLETE text from DOCX resumes
   Mammoth.js only (lib/mammoth.browser.min.js, vendored).
   Works offline, over http:// and file://.
   Exposes: window.DocxParser.parse(file) -> Promise<string>
   ========================================================= */
'use strict';

var DocxParser = (function () {

  function extractTxtFromBytes(bytes) {
    /* Last-resort fallback: DOCX is a ZIP; word/document.xml holds the
       text. Pull readable runs out of it without any library. */
    try {
      var raw = '';
      for (var i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i] & 0xFF);
      var xmlMatch = raw.match(/word\/document\.xml/i);
      var start = xmlMatch ? xmlMatch.index : raw.indexOf('<w:body');
      if (start === -1) return '';
      var chunk = raw.slice(start, start + 4 * 1024 * 1024);
      /* paragraphs */
      var paras = chunk.split(/<\/w:p>/);
      var lines = [];
      for (var p = 0; p < paras.length; p++) {
        var texts = paras[p].match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (!texts) continue;
        var line = texts.map(function (t) {
          return t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '');
        }).join('');
        line = line.replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        if (line.trim()) lines.push(line);
      }
      return lines.join('\n');
    } catch (e) { return ''; }
  }

  function parse(file) {
    var m = (typeof window !== 'undefined') ? window.mammoth : null;
    var viaMammoth = Promise.resolve('');

    if (m && typeof m.extractRawText === 'function') {
      viaMammoth = Promise.resolve(file.arrayBuffer ? file.arrayBuffer() : file).then(function (buf) {
        return Promise.resolve(m.extractRawText({ arrayBuffer: buf })).then(function (r) {
          var t = (r && typeof r.value === 'string') ? r.value : '';
          if (!t.replace(/\s+/g, '').length) throw new Error('empty');
          return t;
        });
      }).catch(function () { return ''; });
    }

    return viaMammoth.then(function (text) {
      if (text && text.replace(/\s+/g, '').length) {
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      }
      /* fallback path */
      return Promise.resolve(file.arrayBuffer ? file.arrayBuffer() : file).then(function (buf) {
        var bytes = new Uint8Array(buf);
        /* DOCX (ZIP) starts with PK */
        if (!(bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4B)) {
          throw new Error('This is not a valid DOCX file. If it is a .doc, save it as .docx or PDF and re-upload.');
        }
        var fallback = extractTxtFromBytes(bytes);
        if (!fallback.replace(/\s+/g, '').length) {
          throw new Error('Could not read text from this DOCX. Re-save it from Word/Google Docs as .docx and try again, or upload PDF/TXT.');
        }
        return fallback.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      });
    });
  }

  return { parse: parse };
})();

if (typeof window !== 'undefined') window.DocxParser = DocxParser;
