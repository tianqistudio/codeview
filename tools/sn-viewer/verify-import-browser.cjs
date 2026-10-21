// Real Chrome integration tests. All inputs are generated synthetic fixtures.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const targetPath = path.resolve(root, process.argv[2] || process.env.CODEVIEW_TEST_HTML || require('./test-html.cjs').defaultHtmlPath());
const targetUrl = process.env.CODEVIEW_TEST_URL || pathToFileURL(targetPath).href;
const evidence = path.resolve(process.env.CODEVIEW_EVIDENCE_DIR || path.join(root, 'qa/import-browser-'+new Date().toISOString().replace(/[:.]/g,'-')));
const baseline = process.argv.includes('--baseline');

(async () => {
  fs.mkdirSync(evidence, {recursive:true});
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({locale:'zh-CN', viewport:{width:1280,height:900}});
  const errors=[], requests=[], checks=[], benchmarks=[];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url()!==targetUrl) requests.push(request.url()); });
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    window.__heldReads=[];
    Blob.prototype.arrayBuffer = async function () {
      const bytes = await read.call(this);
      const holdAtChunk = Number.isInteger(window.__readsUntilHold) && window.__readsUntilHold-- === 0;
      if (window.__holdReads || holdAtChunk) await new Promise((resolve,reject) => window.__heldReads.push({resolve,reject}));
      return bytes;
    };
    window.__benchmark=null;
    new PerformanceObserver(list => {
      if (window.__benchmark) window.__benchmark.longTasks.push(...list.getEntries().filter(entry=>entry.startTime>=window.__benchmark.start).map(entry=>entry.duration));
    }).observe({type:'longtask'});
    let previous=performance.now();
    document.addEventListener('change', event => {
      if (event.target.id==='file' && window.__benchmarkArmed) {
        previous=performance.now();
        window.__benchmark={start:previous,maxTimerGapMs:0,maxObservedHeapBytes:0,longTasks:[]};
        window.__benchmarkArmed=false;
      }
    },true);
    setInterval(() => {
      const now=performance.now();
      if (window.__benchmark) {
        window.__benchmark.maxTimerGapMs=Math.max(window.__benchmark.maxTimerGapMs, now-previous);
        window.__benchmark.maxObservedHeapBytes=Math.max(window.__benchmark.maxObservedHeapBytes, performance.memory?.usedJSHeapSize || 0);
      }
      previous=now;
    }, 16);
  });
  const input = async (name, data) => page.locator('#file').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.isBuffer(data)?data:Buffer.from(data)});
  const ready = async (count) => page.waitForFunction(n=>!document.getElementById('apply').disabled && candidates.length===n, count, {timeout:30000});
  const reject = async (name, data, fragment) => {
    await input(name,data);
    await page.waitForFunction(text=>document.getElementById('importMessage').textContent.includes(text), fragment);
    const applyDisabled=await page.locator('#apply').isDisabled();
    if (!baseline) assert.equal(applyDisabled,true);
    checks.push({name,applyDisabled});
  };
  try {
    await page.goto(targetUrl);
    const fidelity='\uFEFF产品,SN,备注\r\n"前导零,商品",0000123,"中文\r\n双行"\r\n"含""引号",0000123,重复\r\n空格, SN:0004 ,尾空格 \r\n长数字,12345678901234567890,文本\r\n';
    await input('fidelity.csv',fidelity); await ready(4);
    const actual=await page.evaluate(()=>candidates.map(r=>({sn:r.sn,row:r.row,values:r.cells.map(c=>c.v)})));
    assert.deepEqual(actual,[
      {sn:'0000123',row:2,values:['前导零,商品','0000123','中文\r\n双行']},
      {sn:'0000123',row:3,values:['含"引号','0000123','重复']},
      {sn:' SN:0004 ',row:4,values:['空格',' SN:0004 ','尾空格 ']},
      {sn:'12345678901234567890',row:5,values:['长数字','12345678901234567890','文本']}
    ]);
    await page.locator('#apply').click();
    assert.equal(await page.locator('#currentSN').textContent(),'0000123');
    await page.locator('#next').click();
    assert.equal(await page.locator('#currentSN').textContent(),'0000123');
    checks.push('UTF-8 BOM, quoted delimiters/newlines/quotes, leading zeros, duplicates, spaces, long text numbers, source rows');
    for (const [name,separator] of [['semicolon.csv',';'],['tabs.tsv','\t'],['tabs.txt','\t']]) {
      await input(name,['名称','SN','备注'].join(separator)+'\n'+['商品','00007','保留'].join(separator)); await ready(1);
      assert.equal(await page.evaluate(()=>candidates[0].sn),'00007');
    }
    checks.push('CSV semicolon, TSV and TXT delimiters');
    for (const [count,note] of [[1000,'合成数据'],[10000,'合成数据'],[10000,'X'.repeat(800)]]) {
      const data='产品,SN,备注\n'+Array.from({length:count},(_,i)=>`商品${i},SN${String(i).padStart(8,'0')},${note}`).join('\n');
      await page.evaluate(()=>window.__benchmarkArmed=true);
      await input('benchmark-'+count+'.csv',data); await ready(count);
      await page.evaluate(()=>window.__benchmark.readyAt=performance.now());
      // Flush timer/PerformanceObserver delivery after the final synchronous preview work.
      await page.waitForTimeout(60);
      benchmarks.push(await page.evaluate(({n,bytes})=>{
        const b=window.__benchmark; window.__benchmark=null;
        return {rows:n,bytes,elapsedMs:b.readyAt-b.start,maxTimerGapMs:b.maxTimerGapMs,maxObservedHeapBytes:b.maxObservedHeapBytes,longTaskCount:b.longTasks.length,maxLongTaskMs:Math.max(0,...b.longTasks)};
      },{n:count,bytes:Buffer.byteLength(data)}));
    }
    checks.push('1,000 and 10,000 SN preview ready');
    await reject('invalid-utf8.csv',Buffer.from([0x53,0x4e,0x0a,0xff]),'UTF-8');
    await reject('unclosed.csv','SN\n"BROKEN','双引号');
    await reject('too-many-rows.csv','SN\n'+'A\n'.repeat(20000),'20,000');
    await reject('too-many-columns.csv',Array.from({length:513},(_,i)=>i===1?'SN':'字段'+i).join(',')+'\nX,Y','512');
    await reject('too-large.csv',Buffer.alloc(10*1024*1024+1,65),'10 MB');
    await input('too-many-sn.csv','SN\n'+'A\n'.repeat(10001));
    await page.waitForFunction(()=>document.getElementById('mappingWarning').textContent.includes('10,000'));
    assert.equal(await page.locator('#apply').isDisabled(),true); checks.push('10,001 SN blocked');
    await input('row-limit.csv','SN\n'+'A\n'.repeat(10000)+'\n'.repeat(9999)); await ready(10000);
    assert.equal(await page.evaluate(()=>sourceRows.length),20000); checks.push('20,000 source rows accepted');
    if (!baseline) {
      await page.evaluate(()=>window.__readsUntilHold=1);
      await input('paused.csv','SN,备注\n'+('OLD,'+'X'.repeat(80)+'\n').repeat(5000));
      await page.waitForFunction(()=>window.__heldReads.length>0);
      assert.equal(await page.locator('#importCancel').isVisible(),true);
      assert.equal(Number(await page.locator('#importProgress').getAttribute('value')),65536);
      await page.screenshot({path:path.join(evidence,'import-progress.png'),fullPage:true});
      await page.locator('#language').selectOption('en');
      assert.match(await page.locator('#importPhase').textContent(),/Reading list/);
      assert.match(await page.locator('#importCancel').textContent(),/Cancel/);
      await page.locator('#importCancel').click();
      assert.equal(await page.locator('#importActivity').isHidden(),true);
      assert.equal(await page.locator('#apply').isDisabled(),true);
      assert.match(await page.locator('#importMessage').textContent(),/cancelled/i);
      await page.evaluate(()=>window.__holdReads=false);
      await input('after-cancel.csv','SN\nNEW0001'); await ready(1);
      await page.evaluate(()=>window.__heldReads.splice(0).forEach(p=>p.resolve()));
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(()=>candidates[0].sn),'NEW0001');
      checks.push('Cancel is immediate; late successful read cannot overwrite next import; progress translates');
      await page.evaluate(()=>window.__holdReads=true);
      await input('late-failure.csv','SN\nOLD0002');
      await page.waitForFunction(()=>window.__heldReads.length>0);
      await page.evaluate(()=>window.__holdReads=false);
      await input('newer.csv','SN\nNEW0002'); await ready(1);
      await page.evaluate(()=>window.__heldReads.splice(0).forEach(p=>p.reject(new Error('synthetic late read failure'))));
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(()=>candidates[0].sn),'NEW0002');
      assert(!/synthetic/.test(await page.locator('#importMessage').textContent()));
      checks.push('New file supersedes old read; late failure cannot replace new mapping');
      await page.evaluate(()=>window.__holdReads=true);
      await input('paste-race.csv','SN\nOLD0003');
      await page.waitForFunction(()=>window.__heldReads.length>0);
      await page.locator('#pastePanel > summary').click();
      await page.locator('#paste').fill('SN\nPASTE0003');
      await page.locator('#loadPaste').click(); await ready(1);
      await page.evaluate(()=>{window.__holdReads=false;window.__heldReads.splice(0).forEach(p=>p.resolve());});
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(()=>candidates[0].sn),'PASTE0003');
      checks.push('Paste supersedes in-flight file');
      await page.locator('#language').selectOption('zh-CN');
    }
    await input('final.csv','产品,SN,备注\n合成商品,0000123,验收'); await ready(1);
    await page.locator('#apply').click();
    await page.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({colorScheme:'dark'});
    await page.screenshot({path:path.join(evidence,'mobile-dark.png'),fullPage:true});
    assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
    const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
    const report={ok:true,baseline,verifiedAt:new Date().toISOString(),target:process.env.CODEVIEW_TEST_URL || targetPath,sha256:process.env.CODEVIEW_TEST_URL ? undefined : sourceHash,sourceSha256:sourceHash,browser:browser.version(),checks,benchmarks,measurementScope:'Single browser run starting at file change; excludes Playwright file-transfer setup. Sampled JS heap is coarse, not process peak memory. Timer gaps and long tasks include UI work.',pageErrors:errors,externalRequests:requests};
    fs.writeFileSync(path.join(evidence,'verification.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } catch(error) {
    await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});
    fs.writeFileSync(path.join(evidence,'failure.json'),JSON.stringify({error:error.stack,checks,benchmarks,errors,requests},null,2));
    throw error;
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
