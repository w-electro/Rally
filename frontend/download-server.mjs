import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.resolve(__dirname, 'public/downloads');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/downloads/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const fileName = path.basename(url.pathname);
  const filePath = path.join(DOWNLOADS_DIR, fileName);

  // Prevent directory traversal
  if (!filePath.startsWith(DOWNLOADS_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(3002, () => {
  console.log('Download server running on http://localhost:3002');
  console.log('Files served from:', DOWNLOADS_DIR);
});
