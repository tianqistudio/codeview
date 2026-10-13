const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const {pathToFileURL}=require('url');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({locale:'zh-CN'});const errors=[];
  const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  const target=process.env.CODEVIEW_TEST_URL || pathToFileURL(path.resolve(__dirname,'../../交付/SN连续出码/SN_连续出码工具_v1.4.html')).href;
  await page.goto(target);
  const fixture=await page.evaluate(async()=>{
    // Use existing independent encoders for the mixed-image input fixture.
    const mix=document.createElement('canvas');mix.width=1700;mix.height=1300;
    const ctx=mix.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,mix.width,mix.height);
    for(const [text,x,y] of [['000001',40,40],['000001',40,410],['TEST-003',40,780]]) {
      const c=document.createElement('canvas');renderBarcode(text,c);ctx.drawImage(c,x,y);
    }
    renderQR('https://example.com/中文?q=1');ctx.drawImage(document.getElementById('canvas'),1000,100);
    return mix.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button',{name:'图片识码',exact:true}).click();
  await page.locator('#scanFiles').setInputFiles({name:'mixed.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden,{},{timeout:60000});
  console.log(await page.locator('#scanStatus').innerText());
  const values=await page.locator('.scan-card pre').allTextContents();console.log(values);
  assert.equal(values.length,4);assert.equal(values.filter(v=>v==='000001').length,2);
  assert.equal(await page.locator('.scan-card img').count(),4);
  const download=page.waitForEvent('download');await page.locator('.scan-card button').first().click();
  assert.equal((await download).suggestedFilename(),'000001.png');
  const titles=await page.locator('.scan-card button').evaluateAll(nodes=>nodes.map(n=>n.title));
  assert(titles.includes('保存 000001 (2).png'));assert(titles.some(t=>t.includes('https___example.com_中文_q=1.png')));
  await page.emulateMedia({colorScheme:'dark'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const evidence=process.argv[2];
  if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'scanner-dark-mobile.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});
  if(evidence)await page.screenshot({path:path.join(evidence,'scanner-light.png'),fullPage:true});
  await page.getByRole('button',{name:'清空',exact:true}).click();assert.equal(await page.locator('.scan-card').count(),0);
  await page.locator('#scanFiles').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden);
  assert((await page.locator('#scanStatus').innerText()).includes('1 张源图处理失败'));
  await page.getByRole('button',{name:'清空',exact:true}).click();
  const many=await page.evaluate(()=>{
    const mix=document.createElement('canvas');mix.width=2200;mix.height=2400;
    const ctx=mix.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,mix.width,mix.height);
    for(let i=0;i<24;i++){
      const c=document.createElement('canvas');renderBarcode('BATCH-'+String(i).padStart(3,'0'),c);
      ctx.drawImage(c,30+(i%4)*550,30+Math.floor(i/4)*400,500,260);
    }
    return mix.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#scanFiles').setInputFiles([{name:'many.png',mimeType:'image/png',buffer:Buffer.from(many,'base64')},{name:'mixed.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')}]);
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden,{},{timeout:60000});
  assert.equal(await page.locator('.scan-card img').count(),28);
  await page.locator('#scanFiles').setInputFiles({name:'many.png',mimeType:'image/png',buffer:Buffer.from(many,'base64')});
  await page.getByRole('button',{name:'取消',exact:true}).click();
  assert((await page.locator('#scanStatus').innerText()).startsWith('已取消'));
  await page.getByRole('button',{name:'清空',exact:true}).click();
  await page.locator('#scanFiles').setInputFiles({name:'mixed.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
  await page.waitForFunction(()=>document.getElementById('scanCancel').hidden,{},{timeout:60000});
  assert.equal(await page.locator('.scan-card img').count(),4);
  assert.deepEqual(requests.filter(url=>url!==target),[]);
  assert.deepEqual(errors,[]);
  await browser.close();console.log('PASS: offline mixed 4 codes, duplicate positions, Unicode, regenerated roundtrip, download names, narrow dark layout, clear, invalid file, 24-code image, multi-file batch, cancel and retry, zero HTTP requests');
})().catch(e=>{console.error(e);process.exit(1);});
