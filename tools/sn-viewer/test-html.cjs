const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function defaultHtmlPath() {
  const receipt = path.join(root, 'release.json');
  return path.resolve(root, fs.existsSync(receipt)
    ? JSON.parse(fs.readFileSync(receipt, 'utf8').replace(/^\uFEFF/, '')).html
    : '交付/SN连续出码/SN_连续出码工具_v1.4.1.html');
}

function readTestHtml(explicit = process.argv[2] || process.env.CODEVIEW_TEST_HTML) {
  const target = path.resolve(root, explicit || defaultHtmlPath());
  const html = fs.readFileSync(target, 'utf8');
  const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(m => !/\btype\s*=/.test(m[1] || '') || /\btype\s*=\s*["'](?:text|application)\/javascript["']/.test(m[1]))
    .map(m => m[2]);
  scripts.forEach((script, i) => new vm.Script(script, {filename: `${target}:script-${i}`}));
  const main = scripts.find(script => script.includes('const MAX_FILE='));
  if (!main) throw new Error(`Missing application script in ${target}`);
  const marker = "for(const side of ['left','right'])$(side+'Codes').onchange=";
  if (!main.includes(marker)) throw new Error('Application listener boundary changed; update the test harness.');
  const importCore = scripts.find(script => script.includes('function createTaskGate()')) || '';
  return {target, html, scripts, main: importCore + '\n' + main.split(marker)[0]};
}

module.exports = {readTestHtml, defaultHtmlPath};
