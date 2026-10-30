import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const target = path.resolve('public', 'og.png');

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; }
      body {
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: #034d41;
        color: #f8fafc;
        overflow: hidden;
        position: relative;
      }
      .glow-teal {
        position: absolute; width: 620px; height: 620px; border-radius: 50%;
        background: #0d9488; opacity: 0.42; filter: blur(10px);
        top: -240px; right: -140px;
      }
      .glow-orange {
        position: absolute; width: 520px; height: 520px; border-radius: 50%;
        background: #f97316; opacity: 0.18; filter: blur(6px);
        bottom: -300px; right: 120px;
      }
      .grid {
        position: absolute; inset: 0;
        background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(circle at 25% 40%, black, transparent 78%);
      }
      .content { position: relative; padding: 76px 84px; height: 100%; display: flex; flex-direction: column; }
      .brand { display: flex; align-items: center; gap: 26px; }
      .mark { width: 108px; height: 108px; flex: none; }
      .name { font-size: 92px; font-weight: 800; letter-spacing: 4px; line-height: 1; }
      .tagline { margin-top: 44px; font-size: 42px; font-weight: 600; color: #99f6e4; letter-spacing: 0.5px; }
      .sub { margin-top: 18px; font-size: 26px; color: #cbd5e1; max-width: 780px; line-height: 1.45; }
      .chips { margin-top: auto; display: flex; gap: 14px; }
      .chip {
        font-size: 22px; font-weight: 600; color: #ecfdf5;
        border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08);
        padding: 12px 22px; border-radius: 999px;
      }
      .route { position: absolute; right: 96px; bottom: 118px; width: 340px; height: 220px; opacity: 0.9; }
      .footer { position: absolute; right: 84px; bottom: 56px; font-size: 20px; color: #94a3b8; letter-spacing: 1px; }
      .bar { position: absolute; left: 0; top: 0; width: 100%; height: 10px; background: linear-gradient(90deg, #0d9488, #f97316); }
    </style>
  </head>
  <body>
    <div class="bar"></div>
    <div class="grid"></div>
    <div class="glow-teal"></div>
    <div class="glow-orange"></div>
    <div class="content">
      <div class="brand">
        <svg class="mark" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="POTHIK logo">
          <rect width="96" height="96" rx="26" fill="#ffffff" fill-opacity="0.12" stroke="rgba(255,255,255,0.25)" />
          <path d="M30 70 V26 h20 c12 0 20 7 20 18 s-8 18 -20 18 h-9 v8 z" fill="#ffffff" />
          <path d="M41 39 h8 c4 0 7 2 7 6 s-3 6 -7 6 h-8 z" fill="#0d9488" />
          <path d="M20 70 h56" stroke="#f97316" stroke-width="6" stroke-linecap="round" />
          <circle cx="70" cy="24" r="7" fill="#f97316" />
        </svg>
        <span class="name">POTHIK</span>
      </div>
      <p class="tagline">Bangladesh, planned properly.</p>
      <p class="sub">Hotels, transport, guides and custom trips — priced on the server, confirmed by verified providers.</p>
      <div class="chips">
        <span class="chip">Hotels</span>
        <span class="chip">Transport</span>
        <span class="chip">Guides</span>
        <span class="chip">Custom trips</span>
      </div>
    </div>
    <svg class="route" viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 196 C90 150 88 74 176 72 S300 34 326 22" fill="none" stroke="#99f6e4" stroke-width="4" stroke-dasharray="10 10" stroke-linecap="round" opacity="0.75" />
      <circle cx="14" cy="196" r="9" fill="#f97316" />
      <circle cx="326" cy="22" r="12" fill="none" stroke="#f97316" stroke-width="4" />
      <circle cx="326" cy="22" r="4" fill="#f97316" />
    </svg>
    <span class="footer">pothik · bangladesh travel</span>
  </body>
</html>`;

await mkdir(path.dirname(target), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: target, type: 'png' });
await browser.close();

console.log(`OG image written to ${path.relative(process.cwd(), target)} (1200x630)`);
