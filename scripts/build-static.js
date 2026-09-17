const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'scripts'), { recursive: true });
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<li><a href="admin\.html"[^>]*>Admin Panel &nearr;<\/a><\/li>/g, '')
    .replace(/<a href="admin\.html"[^>]*>Admin Panel &nearr;<\/a>/g, '');
fs.writeFileSync(path.join(output, 'index.html'), html);
for (const folder of ['assets', 'styles']) fs.cpSync(path.join(root, folder), path.join(output, folder), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts/state-utils.js'), path.join(output, 'scripts/state-utils.js'));
const unavailable = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hiyara administration</title><body style="font-family:system-ui;max-width:650px;margin:15vh auto;padding:24px;color:#222"><h1>Online administration is not connected yet</h1><p>This is the Hiyara storefront preview. Contact the store owner for help.</p><p><a href="/">Return to Hiyara</a></p></body></html>';
fs.writeFileSync(path.join(output, 'admin.html'), unavailable);
fs.writeFileSync(path.join(output, 'admin-login.html'), unavailable);
fs.mkdirSync(path.join(output, 'admin'), {recursive: true});
fs.writeFileSync(path.join(output, 'admin/index.html'), unavailable);
console.log('Static storefront preview built in dist/. Backend and private data are excluded.');
