/* =========================================================
   upload.js - drag & drop, validation, extraction pipeline
   Resume To Portfolio Generator
   ---------------------------------------------------------
   Flow: drop/browse -> validate -> extract full text
   (PDF via PdfParser, DOCX via DocxParser, TXT natively)
   -> ResumeAnalyzer.analyze -> App.saveData
   -> PortfolioGenerator.initPreviewPage -> show preview.
   The portfolio is generated automatically after upload;
   the "Generate Portfolio" button re-runs the same flow.
   ========================================================= */
'use strict';

(function () {
  'use strict';

  var MAX_BYTES = 15 * 1024 * 1024; /* 15 MB */
  var SUPPORTED = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT' };

  var state = {
    file: null,
    text: null,
    busy: false
  };

  function $(id) { return document.getElementById(id); }

  /* ---------- tiny UI helpers ---------- */
  function setError(msg) {
    var e = $('uploadError');
    if (!e) return;
    e.textContent = msg || '';
    if (msg) e.classList.add('show'); else e.classList.remove('show');
  }

  function toast(msg, type) {
    try { if (window.App && App.toast) { App.toast(msg, type); return; } } catch (e) {}
    try { window.alert(msg); } catch (e) {}
  }

  function bytesToSize(n) {
    n = n >>> 0;
    var u = ['B', 'KB', 'MB', 'GB'], i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v + ' B' : v.toFixed(1) + ' ' + u[i]);
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function setFileMeta(name, size) {
    var m = $('fileMeta');
    if (!m) return;
    if (!name) { m.innerHTML = ''; m.style.display = 'none'; return; }
    m.innerHTML = escAttr(name) + ' <span class="fileMeta-size">' + bytesToSize(size) + '</span>';
    m.style.display = 'inline-block';
  }

  function setGenerating(on) {
    state.busy = !!on;
    var g = $('generateBtn');
    if (g) { g.disabled = !!on || !state.text; }
    var dz = $('dropzone');
    if (dz) dz.classList[on ? 'add' : 'remove']('busy');
  }

  /* ---------- processing overlay (5 steps) ---------- */
  function showOverlay(show) {
    var o = $('processingOverlay');
    if (!o) return;
    o.hidden = !show;
    o.setAttribute('hidden', show ? '' : 'hidden');
    if (show) o.removeAttribute('hidden');
  }

  function setStep(n) {
    var steps = document.querySelectorAll('#processingSteps .step-item');
    for (var i = 0; i < steps.length; i++) {
      var s = Number(steps[i].getAttribute('data-step')) || (i + 1);
      steps[i].classList.toggle('active', s === n);
      steps[i].classList.toggle('done', s < n);
    }
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- extraction ---------- */
  function extractTxt(file) {
    return Promise.resolve(file.arrayBuffer ? file.arrayBuffer() : file).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var out;
      try { out = new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
      catch (e) {
        out = '';
        for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      }
      if (out.charCodeAt(0) === 0xFEFF) out = out.slice(1);
      /* UTF-16 detection: many NUL bytes in the first chunk */
      var nulls = 0;
      for (var j = 0; j < Math.min(bytes.length, 512); j++) { if (bytes[j] === 0) nulls++; }
      if (nulls > 100) {
        var le = (bytes[0] === 0xFF && bytes[1] === 0xFE) || bytes[1] === 0x00;
        var u16 = '';
        for (var k = le ? 2 : 0; k + 1 < bytes.length; k += 2) {
          var code = le ? (bytes[k] | (bytes[k + 1] << 8)) : ((bytes[k] << 8) | bytes[k + 1]);
          if (code) u16 += String.fromCharCode(code);
        }
        if (u16.replace(/\s+/g, '').length > out.replace(/\s+/g, '').length) out = u16;
      }
      return out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    });
  }

  function extract(file) {
    var ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') {
      if (!window.PdfParser || typeof window.PdfParser.parse !== 'function') {
        return Promise.reject(new Error('PDF reader failed to load. Hard-refresh the page (Ctrl+Shift+R).'));
      }
      return window.PdfParser.parse(file);
    }
    if (ext === 'docx') {
      if (!window.DocxParser || typeof window.DocxParser.parse !== 'function') {
        return Promise.reject(new Error('DOCX reader failed to load. Hard-refresh the page (Ctrl+Shift+R).'));
      }
      return window.DocxParser.parse(file);
    }
    if (ext === 'txt' || ext === 'md') return extractTxt(file);
    return Promise.reject(new Error('Unsupported file type ".' + ext + '". Please upload a PDF, DOCX or TXT resume.'));
  }

  /* ---------- file handling ---------- */
  function validateFile(file) {
    if (!file) return 'No file selected.';
    var ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
    if (!SUPPORTED[ext]) return 'Unsupported file type ".' + ext + '". Supported: PDF, DOCX, TXT.';
    if (file.size > MAX_BYTES) return 'File is too large (' + bytesToSize(file.size) + '). Maximum is 15 MB.';
    if (file.size === 0) return 'This file is empty.';
    return null;
  }

  function handleFile(file) {
    var err = validateFile(file);
    if (err) { setError(err); toast(err, 'error'); return; }
    setError('');
    state.file = file;
    state.text = null;
    setFileMeta(file.name, file.size);
    var rm = $('removeBtn');
    if (rm) rm.classList.remove('hidden');
    setGenerating(false);

    setStep(2); /* Reading */
    showOverlay(true);
    extract(file).then(function (text) {
      setStep(3); /* Extracting */
      return wait(180).then(function () {
        if (!text || !text.replace(/\s+/g, '').length) {
          throw new Error('No readable text found in this file. It may be scanned/image-only. Upload a text-based PDF, DOCX or TXT.');
        }
        state.text = text;
        setFileMeta(file.name, file.size);
        showOverlay(false);
        setGenerating(false);
        toast('Resume read successfully — generating your portfolio…', 'success');
        generate(); /* AUTO-GENERATE on upload */
      });
    }).catch(function (e) {
      showOverlay(false);
      var msg = (e && e.message) ? e.message : 'Could not read this file.';
      setError(msg);
      toast(msg, 'error');
      state.file = null;
      state.text = null;
      setGenerating(false);
    });
  }

  /* ---------- generation ---------- */
  function generate() {
    if (state.busy) return;
    if (!state.text) { setError('Please upload a resume first.'); return; }
    setGenerating(true);
    setError('');
    showOverlay(true);
    setStep(4); /* Identifying */

    wait(250).then(function () {
      var fileName = (state.file && state.file.name) || 'resume.txt';
      var parsed = ResumeAnalyzer.analyze(state.text, fileName);
      if (!parsed || !parsed.sections || !parsed.sections.length) {
        throw new Error('Could not identify any sections in this resume. Try a clearer PDF/DOCX/TXT export of your resume.');
      }
      setStep(5); /* Generating */
      return wait(250).then(function () {
        App.saveData(parsed);
        App.show('view-preview');
        PortfolioGenerator.initPreviewPage();
        showOverlay(false);
        setGenerating(false);
        toast('Portfolio generated — ' + parsed.sections.length + ' sections preserved!', 'success');
      });
    }).catch(function (e) {
      showOverlay(false);
      setGenerating(false);
      var msg = (e && e.message) ? e.message : 'Portfolio generation failed.';
      setError(msg);
      toast(msg, 'error');
    });
  }

  function reset() {
    state.file = null;
    state.text = null;
    setError('');
    setFileMeta('', 0);
    var fi = $('fileInput');
    if (fi) fi.value = '';
    var rm = $('removeBtn');
    if (rm) rm.classList.add('hidden');
    setGenerating(false);
  }

  /* ---------- init / event binding ---------- */
  function init() {
    var dz = $('dropzone');
    var fi = $('fileInput');
    var gen = $('generateBtn');
    var rm = $('removeBtn');

    if (dz && fi) {
      dz.addEventListener('click', function () { fi.click(); });
      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
      });
      dz.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
    }

    if (fi) {
      fi.addEventListener('change', function () {
        if (fi.files && fi.files[0]) handleFile(fi.files[0]);
      });
    }

    if (gen) gen.addEventListener('click', generate);
    if (rm) rm.addEventListener('click', reset);

    window.Upload = {
      init: init,
      handleFile: handleFile,
      generate: generate,
      reset: reset,
      getText: function () { return state.text; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
