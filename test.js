const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(<!DOCTYPE html><div id='app'></div>);
const document = dom.window.document;
const app = document.getElementById('app');
try {
  app.innerHTML = \${(Get-Content "d:\HIYARA WEB\index.html" -Raw) -match '(?s)app.innerHTML = (.*?);' | Out-Null; [1] -replace '', '\'}\;
  console.log(document.getElementById('cartItemsContainer'));
} catch(e) { console.error('Error:', e.message); }
