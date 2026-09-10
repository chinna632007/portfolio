/* =========================================================
   pdfParser.js - extracts COMPLETE text from PDF resumes
   Local PDF.js only (lib/pdf.min.js + lib/pdf.worker.min.js).
   Works offline, over http:// and file://.
   Exposes: window.PdfParser.parse(file) -> Promise<string>
   ========================================================= */
'use strict';

var PdfParser = (function () {
  var GAP = 2;

  function workerUrl() {
    try {
      var href = String(window.location.href || '');
      return href.slice(0, href.lastIndexOf('/') + 1) + 'lib/pdf.worker.min.js?v=20260909';
    } catch (e) { return 'lib/pdf.worker.min.js?v=20260909'; }
  }

  function preloadWorkerMainThread(url) {
    return new Promise(function (resolve) {
      try {
        if (window.pdfjsWorker && window.pdfjsWorker.WorkerMessageHandler) { resolve(true); return; }
      } catch (e) {}
      var s = document.createElement('script');
      s.src = url; s.async = false;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      (document.head || document.body).appendChild(s);
    });
  }

  function openDocument(lib, buffer) {
    var wUrl = workerUrl();
    try { if (lib && lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = wUrl; } catch (e) {}
    return preloadWorkerMainThread(wUrl).then(function () {
      var task = null;
      try {
        task = lib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
      } catch (e) {
        throw new Error('Could not open this PDF. It may be corrupted or password-protected.');
      }
      var p = (task && task.promise !== undefined) ? task.promise : task;
      return Promise.resolve(p).then(function (doc) {
        if (!doc || typeof doc.getPage !== 'function') throw new Error('Could not open this PDF. It may be corrupted.');
        return doc;
      }, function (e) {
        var msg = String((e && e.message) || e || '');
        if (/password|encrypt/i.test(msg)) throw new Error('This PDF is password-protected. Please upload an unlocked copy.');
        throw new Error('Could not open this PDF. It may be corrupted. (' + msg.slice(0, 120) + ')');
      });
    });
  }

  function pageToText(page) {
    return page.getTextContent().then(function (content) {
      var items = (content && Array.isArray(content.items)) ? content.items : [];
      var rows = [];
      var current = null, currentY = null;
      items.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        var t = item.transform;
        var x = (t && t.length > 4) ? t[4] : 0;
        var y = (t && t.length > 5) ? t[5] : 0;
        var str = String(item.str == null ? '' : item.str).split(' ').join(' ');
        if (!str.trim() && (!item.hasEOL)) {
          if (current === null || Math.abs(y - currentY) > GAP) {
            current = { y: y, parts: [[x, ' ']] }; currentY = y; rows.push(current);
          } else { current.parts.push([x, ' ']); }
          return;
        }
        if (current === null || Math.abs(y - currentY) > GAP) {
          current = { y: y, parts: [[x, str]] }; currentY = y; rows.push(current);
        } else { current.parts.push([x, str]); }
      });
      rows.sort(function (a, b) { return b.y - a.y; });
      var out = '';
      rows.forEach(function (row) {
        row.parts.sort(function (a, b) { return a[0] - b[0]; });
        var joined = row.parts.map(function (pt) { return pt[1]; }).join(' ');
        joined = joined.replace(/[ \t]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1');
        out += joined + '\n';
      });
      return out;
    });
  }

  function parse(file) {
    var lib = window.pdfjsLib || window.pdfjs || window['pdfjs-dist/build/pdf'];
    if (!lib || typeof lib.getDocument !== 'function') {
      return Promise.reject(new Error('PDF reader failed to load (lib/pdf.min.js missing?). Hard-refresh (Ctrl+Shift+R).'));
    }
    return file.arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      if (!(bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        throw new Error('This file is not a valid PDF (missing %PDF header). If you renamed a DOCX to .pdf, rename it back to .docx.');
      }
      return openDocument(lib, buffer).then(function (doc) {
        var pageCount = (typeof doc.numPages === 'number' && doc.numPages > 0) ? doc.numPages : 1;
        var chain = Promise.resolve([]);
        var _loop = function (p) {
          chain = chain.then(function (acc) {
            return doc.getPage(p).then(pageToText, function () { return ''; }).then(function (t) {
              if (t && t.trim()) acc.push(t.trim());
              return acc;
            });
          });
        };
        for (var p = 1; p <= pageCount; p++) _loop(p);
        return chain.then(function (pages) {
          try { if (doc && typeof doc.destroy === 'function') doc.destroy(); } catch (e) {}
          var result = pages.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          if (!result) throw new Error('This PDF has no selectable text (scanned / image-only). Upload a text PDF, DOCX, TXT, or paste the resume text.');
          return result;
        });
      });
    });
  }

  return { parse: parse };
})();

if (typeof window !== 'undefined') window.PdfParser = PdfParser;
