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
    var m = window.mammoth;
    var viaMammoth = Promise.resolve('');
    if(m && typeof m.extractRawText === 'function'){
      viaMammoth = file.arrayBuffer().then(function(buf){
        return m.extractRawText({arrayBuffer:buf}).then(function(r){
          return String(r && r.value ? r.value : '');
        });
      });
  function readU16(d,o){return (d[o]|(d[o+1]<<8))&0xffff;}
  function readU32(d,o){return (d[o]|(d[o+1]<<8)|(d[o+2]<<16)|(d[o+3]<<24))>>>0;}
  function bytesToAscii(bytes,off,len){ var s=''; for(var i=0;i<len;i++) s+=String.fromCharCode(bytes[off+i]&0x7f); return s; }
  function findEOCD(bytes){ var n=bytes.length; if(n<22) return null; var maxScan=Math.min(n-22,0x10000+22); for(var i=n-22; i>=n-22-maxScan && i>=0; i--){ if(readU32(bytes,i)===0x06054b50){ var total=readU16(bytes,i+10); var cdSize=readU32(bytes,i+12); var cdOff=readU32(bytes,i+16); if(cdOff+cdSize<=n) return {totalEntries:total, cdOffset:cdOff}; } } return null; }
  function readCentralEntry(bytes,off){ if(off+46>bytes.length) return null; if(readU32(bytes,off)!==0x02014b50) return null; var method=readU16(bytes,off+10); var compSize=readU32(bytes,off+20); var uncompSize=readU32(bytes,off+24); var nameLen=readU16(bytes,off+28); var extraLen=readU16(bytes,off+30); var commentLen=readU16(bytes,off+32); var headerOff=readU32(bytes,off+42); var name=bytesToAscii(bytes,off+46,nameLen); return { method:method, compSize:compSize, uncompSize:uncompSize, headerOffset:headerOff, name:name, nextOff:off+46+nameLen+extraLen+commentLen }; }
  function getLocalFile(bytes,headerOff){ if(readU32(bytes,headerOff)!==0x04034b50) return null; var method=readU16(bytes,headerOff+8); var compSize=readU32(bytes,headerOff+18); var nameLen=readU16(bytes,headerOff+26); var extraLen=readU16(bytes,headerOff+28); var start=headerOff+30+nameLen+extraLen; return {method:method, data:bytes.slice(start,start+compSize)}; }

    }
