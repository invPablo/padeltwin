// Metro's web export ("output": "single") doesn't apply app/+html.tsx, so the
// PWA <link rel="manifest"> tag never makes it into dist/index.html on its
// own. This is a one-off personal admin tool (not the player-facing app
// shipped via EAS), so a tiny post-build patch is simpler than fighting the
// web export pipeline.
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('rel="manifest"')) {
  html = html.replace(
    '</head>',
    '<link rel="manifest" href="/manifest.json" /><link rel="apple-touch-icon" href="/icon-192.png" /></head>'
  );
  fs.writeFileSync(indexPath, html);
  console.log('Injected PWA manifest link into dist/index.html');
}
