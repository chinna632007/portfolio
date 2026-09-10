/* =========================================================
   server.js - zero-dependency static server for the app
   ---------------------------------------------------------
   Run:      node server.js
   or:       npm start
   then open http://localhost:8000

   Serves the project folder with correct MIME types and
   no-cache headers (so updates always show after refresh).
   ========================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf'
};

http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
    }
    if (urlPath === '/' ) urlPath = '/index.html';

    const file = path.normalize(path.join(ROOT, urlPath));
    const rootNorm = path.normalize(ROOT).toLowerCase();
    const fileNorm = file.toLowerCase();

    if (fileNorm !== rootNorm && !fileNorm.startsWith(rootNorm + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found: ' + urlPath);
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log('Resume -> Portfolio generator running at:');
    console.log('  http://localhost:' + PORT);
    console.log('Press Ctrl+C to stop.');
});