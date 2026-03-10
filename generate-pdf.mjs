/**
 * 生成中文、英文简历 PDF（需先 npm install，再 npm run pdf）
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function serve(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(root, req.url === '/' ? '/index.html' : req.url);
      const ext = path.extname(p);
      if (!ext) p = path.join(p, 'index.html');
      fs.readFile(p, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const port = 18628;
  const server = await serve(port);
  const base = `http://127.0.0.1:${port}`;

  const puppeteer = await import('puppeteer');
  const possibleChrome = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].find(Boolean);
  const launchOpts = { headless: 'new' };
  if (possibleChrome && fs.existsSync(possibleChrome)) {
    launchOpts.executablePath = possibleChrome;
  }
  const browser = await puppeteer.default.launch(launchOpts);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 }); // A4-ish at 96dpi

    // 中文简历：index.html（无 hash）
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(
      () => document.getElementById('name') && document.getElementById('name').textContent.trim() !== '',
      { timeout: 5000 }
    );
    await page.pdf({
      path: path.join(root, 'resume-zh.pdf'),
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    console.log('已生成 resume-zh.pdf');
    await page.close();

    // 英文简历：新开页面并直接加载 #en，否则同页改 hash 不会重新执行 JS
    const pageEn = await browser.newPage();
    await pageEn.setViewport({ width: 794, height: 1123 });
    await pageEn.goto(`${base}/index.html#en`, { waitUntil: 'networkidle0' });
    await pageEn.waitForFunction(
      () => document.getElementById('name') && document.getElementById('name').textContent.trim() !== '',
      { timeout: 5000 }
    );
    await pageEn.waitForFunction(
      () => document.getElementById('name').textContent.includes('Xie'),
      { timeout: 3000 }
    );
    await pageEn.pdf({
      path: path.join(root, 'resume-en.pdf'),
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    console.log('已生成 resume-en.pdf');
    await pageEn.close();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
