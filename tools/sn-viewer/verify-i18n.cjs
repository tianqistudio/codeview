const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');

function syntheticWorkbook() {
  const rows=[['产品名称','SN','状态'],['等待图片','0000123','条形码'],['原始中文','0000123','Ready'],['中文字段','中文编码','保留原文']];
  const files={
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="原始表头" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,i)=>`<row r="${i+1}">`+row.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>'
  };
  // A small stored ZIP keeps the test independent of spreadsheet libraries.
  const local=[],central=[];let offset=0;
  for(const [name,xml] of Object.entries(files)) {
    const data=Buffer.from(xml),filename=Buffer.from(name);let crc=0xffffffff;
    for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    crc=(crc^0xffffffff)>>>0;
    const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt32LE(crc,14);l.writeUInt32LE(data.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(filename.length,26);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
    local.push(l,filename,data);central.push(c,filename);offset+=l.length+filename.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(3,8);end.writeUInt16LE(3,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const target = process.env.CODEVIEW_TEST_URL || pathToFileURL(path.resolve(__dirname,'../../交付/SN连续出码/SN_连续出码工具_v1.4.html')).href;
  const evidence = path.resolve(__dirname,'../../qa/i18n-1.4');
  fs.mkdirSync(evidence,{recursive:true});
  const page = await browser.newPage({locale:'en-US'});
  const errors = [], requests = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()) && r.url()!==target)requests.push(r.url());});
  await page.goto(target);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#pickFile').innerText(),'Choose file');
  await page.locator('#language').selectOption('zh-CN');
  assert.equal(await page.locator('#pickFile').innerText(),'选择文件');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  await page.locator('#language').selectOption('en');
  // Synthetic XLSX: duplicate SN, leading zeros, Chinese data equal to UI labels.
  await page.locator('#file').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:syntheticWorkbook()});
  await page.waitForFunction(()=>!document.getElementById('apply').disabled);
  assert.match(await page.locator('#mappingWarning').innerText(),/1 duplicate/);
  await page.locator('#apply').click();
  assert.equal(await page.locator('#currentSN').innerText(),'0000123');
  assert.equal(await page.locator('#leftValue').innerText(),'等待图片');
  assert.equal(await page.locator('#rightValue').innerText(),'条形码');
  await page.locator('#leftCodes').check();
  await page.locator('#leftLock').click();
  await page.locator('#next').click();
  const before = await page.locator('#canvas').evaluate(c=>c.toDataURL());
  await page.locator('#language').selectOption('zh-CN');
  assert.equal(await page.locator('#currentNo').innerText(),'2');
  assert.equal(await page.locator('#leftLock').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#canvas').evaluate(c=>c.toDataURL()),before);
  await page.locator('#language').selectOption('en');
  assert.match(await page.locator('#leftLock').getAttribute('title'),/Kept enabled/);
  await page.locator('#next').click();
  assert.match(await page.locator('#renderError').innerText(),/printable ASCII/);
  await page.locator('#format').selectOption('qr');
  assert.equal(await page.locator('#currentSN').innerText(),'中文编码');
  const download = page.waitForEvent('download');
  await page.locator('#save').click();
  assert.equal((await download).suggestedFilename(),'0003_中文编码_qr.png');
  for(const [width,scheme] of [[1440,'light'],[390,'dark']]) {
    await page.setViewportSize({width,height:950});await page.emulateMedia({colorScheme:scheme});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(evidence,`en-list-${scheme}.png`),fullPage:true});
  }
  // Localized scanner controls and result names survive a language change.
  const image = await page.locator('#canvas').evaluate(c=>c.toDataURL().split(',')[1]);
  await page.locator('#scanMode').click();
  assert(await page.locator('#language').isVisible());
  await page.locator('#scanFiles').setInputFiles({name:'原始文件.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden);
  assert.equal(await page.locator('.scan-card pre').innerText(),'中文编码');
  assert.match(await page.locator('#scanStatus').innerText(),/Detected 1 codes/);
  assert.equal(await page.locator('.scan-card button').getAttribute('title'),'Save 中文编码.png');
  await page.locator('#language').selectOption('zh-CN');
  assert.equal(await page.locator('.scan-card button').getAttribute('title'),'保存 中文编码.png');
  await page.locator('#language').selectOption('en');
  await page.screenshot({path:path.join(evidence,'en-scan-dark.png'),fullPage:true});
  await page.locator('#scanFiles').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden);
  assert.equal(await page.locator('.scan-card pre').last().innerText(),'Image processing failed');
  await page.locator('#language').selectOption('zh-CN');
  assert.equal(await page.locator('.scan-card pre').last().innerText(),'图片处理失败');
  // Storage denial must not prevent startup or manual switching.
  const denied = await browser.newPage({locale:'fr-FR'});
  await denied.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});});
  await denied.goto(target);
  assert.equal(await denied.locator('html').getAttribute('lang'),'en');
  await denied.locator('#language').selectOption('zh-CN');
  assert.equal(await denied.locator('html').getAttribute('lang'),'zh-CN');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await browser.close();
  console.log('PASS: locale detection, persistence, denied storage, XLSX import, duplicate/zero/Unicode preservation, in-place switching, locked field, QR download, scanner errors, light/dark narrow layouts, no page errors or external requests');
})().catch(e=>{console.error(e);process.exit(1);});
