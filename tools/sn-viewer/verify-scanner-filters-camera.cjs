const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

// Every camera request is intercepted before application startup. These tests
// exercise browser video/canvas capture without accessing a physical camera.
function installCameraFixture() {
  const state = window.__cameraTest = {mode:'allow',calls:[],streams:[],pending:[],fixture:null};
  function createStream(constraints) {
    const canvas = document.createElement('canvas');
    canvas.width = state.fixture.width; canvas.height = state.fixture.height;
    const context = canvas.getContext('2d');
    const paint = () => context.drawImage(state.fixture,0,0);
    paint();
    const stream = canvas.captureStream(12);
    const track = stream.getVideoTracks()[0];
    const deviceId = constraints.video.deviceId?.exact || 'rear-test-camera';
    track.getSettings = () => ({deviceId,width:canvas.width,height:canvas.height});
    state.streams.push(stream);
    const timer = setInterval(()=>{
      if(track.readyState==='ended')clearInterval(timer);
      else paint();
    },80);
    return stream;
  }
  const mediaDevices = navigator.mediaDevices || {};
  if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{value:mediaDevices});
  mediaDevices.enumerateDevices = async () => [
    {kind:'videoinput',deviceId:'rear-test-camera',groupId:'test',label:'Rear test camera'},
    {kind:'videoinput',deviceId:'front-test-camera',groupId:'test',label:'Front test camera'},
  ];
  mediaDevices.getUserMedia = async constraints => {
    state.calls.push(constraints);
    if(state.mode==='deny')throw new DOMException('Camera permission denied','NotAllowedError');
    if(state.mode==='missing')throw new DOMException('No camera available','NotFoundError');
    if(state.mode==='defer')return new Promise((resolve,reject)=>state.pending.push({constraints,resolve,reject}));
    return createStream(constraints);
  };
  state.resolvePending = () => {
    const pending = state.pending.shift();
    if(!pending)throw new Error('No pending camera request');
    pending.resolve(createStream(pending.constraints));
  };
  state.activeTracks = () => state.streams.flatMap(stream=>stream.getTracks()).filter(track=>track.readyState==='live').length;
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1000}});
    const errors = [], requests = [];
    const target = process.env.CODEVIEW_TEST_URL || pathToFileURL(require('./test-html.cjs').defaultHtmlPath()).href;
    const evidence = process.env.CODEVIEW_EVIDENCE_DIR || process.argv[2];
    if(evidence)fs.mkdirSync(evidence,{recursive:true});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url()) && request.url()!==target)requests.push(request.url());});
    await page.addInitScript(installCameraFixture);
    await page.goto(target);
    assert.equal(await page.evaluate(()=>window.__cameraTest.calls.length),0,'Camera must require an explicit click');
    const values = ['6912345678901','0SN001A','ALPHA','SN-001'];
    const fixture = await page.evaluate(values=>{
      const canvas = document.createElement('canvas');canvas.width=1700;canvas.height=1600;
      const context = canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
      for(const [index,text] of values.entries()) {
        const barcode=document.createElement('canvas');renderBarcode(text,barcode);
        context.drawImage(barcode,40,40+index*370);
      }
      window.__cameraTest.fixture=canvas;
      return canvas.toDataURL('image/png').split(',')[1];
    },values);
    const source = {name:'labels.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')};
    const waitScan = () => page.waitForFunction(()=>!window.CodeViewScanner.isBusy(),{},{timeout:60000});
    const visible = () => page.locator('.scan-card:not([hidden]) pre').allTextContents();
    const setPosition = value => page.locator('#scanFilterPosition').fill(value);
    const reset = () => page.locator('#scanFilterReset').click();
    const startCamera = async () => {
      await page.locator('#scanCamera').click();
      await page.waitForFunction(()=>!document.getElementById('scanCameraCapture').disabled,{},{timeout:15000});
      assert.equal(await page.evaluate(()=>window.__cameraTest.activeTracks()),1);
    };
    const stopped = () => page.waitForFunction(()=>window.__cameraTest.activeTracks()===0);

    await page.locator('#scanMode').click();
    assert.equal(await page.locator('#scanFilterType').inputValue(),'sn','SN should be the initial filter');
    assert.deepEqual(await page.locator('#scanFilterType option').evaluateAll(options=>options.map(option=>option.value)),['sn','digits','all']);
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'false');
    // Identical source filenames must still form two independent image groups.
    await page.locator('#scanFiles').setInputFiles([source,source]);
    await waitScan();
    assert.deepEqual(await visible(),[values[1],values[1]],'File import should show SN by default, preserving duplicates and the leading zero');
    assert.equal(await page.locator('.scan-card img').count(),8);
    await page.locator('#scanFilter69').click();
    assert.equal(await page.locator('#scanFilterType').inputValue(),'all');
    assert.equal(await page.locator('#scanFilterPrefix').inputValue(),'69');
    assert.equal(await page.locator('#scanFilterPosition').inputValue(),'');
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await visible(),[values[0],values[0]],'69 preset should switch away from the default SN filter');
    await setPosition('2');assert.deepEqual(await visible(),[]);
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'false');
    await page.locator('#scanFilter69').click();
    assert.equal(await page.locator('#scanFilterPosition').inputValue(),'','69 preset should clear a previous image position');
    assert.deepEqual(await visible(),[values[0],values[0]]);
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'true');
    await page.locator('#scanFilterPrefix').fill('069');assert.deepEqual(await visible(),[],'Prefix matching must preserve literal leading zeroes');
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'false');
    await page.locator('#scanFilterPrefix').fill('69.');assert.deepEqual(await visible(),[],'Prefix punctuation must remain literal');
    await page.locator('#scanFilterPrefix').fill('0');assert.deepEqual(await visible(),[values[1],values[1]]);
    await reset();
    assert.equal(await page.locator('#scanFilterType').inputValue(),'all');
    assert.equal(await page.locator('#scanFilterPrefix').inputValue(),'');
    assert.equal(await page.locator('#scanFilter69').getAttribute('aria-pressed'),'false');
    assert.deepEqual(await visible(),[...values,...values]);
    await setPosition('1');assert.deepEqual(await visible(),[values[0],values[0]]);
    await setPosition('2');assert.deepEqual(await visible(),[values[1],values[1]]);
    await setPosition('3');assert.deepEqual(await visible(),[values[2],values[2]]);
    await setPosition('4');assert.deepEqual(await visible(),[values[3],values[3]]);
    await setPosition('255');assert.deepEqual(await visible(),[]);
    await setPosition('0');assert.deepEqual(await visible(),[]);
    assert.match(await page.locator('#scanFilterStatus').innerText(),/整数/);
    await setPosition('1.5');assert.deepEqual(await visible(),[]);
    await setPosition('');
    await page.locator('#scanFilterPrefix').fill('69');assert.deepEqual(await visible(),[values[0],values[0]]);
    await page.locator('#scanFilterType').selectOption('sn');assert.deepEqual(await visible(),[]);
    await page.locator('#scanFilterPrefix').fill('');assert.deepEqual(await visible(),[values[1],values[1]]);
    // The ordinal refers to the original image order, before other filters.
    await setPosition('1');assert.deepEqual(await visible(),[]);
    await setPosition('2');assert.deepEqual(await visible(),[values[1],values[1]]);
    await page.locator('#scanFilterPrefix').fill('0');assert.deepEqual(await visible(),[values[1],values[1]]);
    const download=page.waitForEvent('download');await page.locator('.scan-card:not([hidden]) button').first().click();
    assert.equal((await download).suggestedFilename(),'0SN001A.png');
    assert.match(await page.locator('.scan-card:not([hidden]) button').last().getAttribute('title'),/0SN001A \(2\)\.png/);
    await reset();
    await page.locator('#scanFilterType').selectOption('digits');assert.deepEqual(await visible(),[values[0],values[0]]);
    await page.locator('#scanFilterPrefix').fill('does-not-exist');assert.deepEqual(await visible(),[]);
    assert.equal(await page.locator('.scan-card').count(),8,'Filtering must retain original decoded cards');
    assert((await page.locator('#scanFilterStatus').innerText()).length>0,'Empty results need a visible status');
    await reset();assert.deepEqual(await visible(),[...values,...values]);

    await page.locator('#scanFilterType').selectOption('sn');
    await page.locator('#language').selectOption('en');
    assert.deepEqual(await visible(),[values[1],values[1]]);
    assert.match(await page.locator('#scanCamera').innerText(),/camera/i);
    assert(!/[\u4e00-\u9fff]/.test(await page.locator('#scanFilterStatus').innerText()),'Filter status should translate');
    for(const locale of ['zh-CN','en']) {
      await page.locator('#language').selectOption(locale);
      for(const width of [320,390,720,1440])for(const scheme of ['light','dark']) {
        await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:scheme});
        await page.evaluate(()=>window.scrollTo(0,0));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${locale} ${width}px ${scheme}`);
        if(width===320) {
          const controls=await page.locator('#scanCamera,#scanPick,#scanClear').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().top));
          assert(Math.max(...controls)-Math.min(...controls)<1,`Camera, image and clear controls should share one row at ${locale} 320px`);
          assert.equal(await page.getByRole('button',{name:locale==='zh-CN'?'选择图片':'Choose images',exact:true}).getAttribute('id'),'scanPick','The image button must retain an accessible name when its text is hidden');
        }
        if(evidence)await page.screenshot({path:path.join(evidence,`scanner-filter-${locale}-${width}-${scheme}.png`)});
      }
    }
    await page.locator('#language').selectOption('zh-CN');
    await page.locator('#scanFilterPrefix').fill('does-not-exist');
    await page.locator('#scanFiles').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
    await waitScan();
    assert.match((await visible()).join(' '),/图片处理失败/,'Errors must remain visible when results are filtered');
    await reset();await page.locator('#scanClear').click();

    // Slightly staggered labels in one visual row still read left to right.
    const staggered = await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=1700;canvas.height=850;
      const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
      for(const [text,x,y] of [['LEFT001',40,100],['RIGHT002',650,80],['LOWER003',40,450]]) {
        const barcode=document.createElement('canvas');renderBarcode(text,barcode);context.drawImage(barcode,x,y);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#scanFiles').setInputFiles({name:'staggered-row.png',mimeType:'image/png',buffer:Buffer.from(staggered,'base64')});
    await waitScan();
    assert.deepEqual(await visible(),['LEFT001','RIGHT002','LOWER003']);
    await setPosition('1');assert.deepEqual(await visible(),['LEFT001']);
    await setPosition('2');assert.deepEqual(await visible(),['RIGHT002']);
    await setPosition('3');assert.deepEqual(await visible(),['LOWER003']);
    await reset();await page.locator('#scanClear').click();

    // A fresh page must apply the same default SN filter to camera captures.
    await page.reload();await page.locator('#scanMode').click();
    assert.equal(await page.locator('#scanFilterType').inputValue(),'sn');
    await page.evaluate(async fixture=>{
      const image=new Image();image.src=`data:image/png;base64,${fixture}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      canvas.getContext('2d').drawImage(image,0,0);window.__cameraTest.fixture=canvas;
    },fixture);
    await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});
    await startCamera();
    assert.equal(await page.evaluate(()=>window.__cameraTest.calls[0].audio),false);
    assert.equal(await page.evaluate(()=>window.__cameraTest.calls[0].video.facingMode.ideal),'environment');
    assert(await page.locator('#scanCameraVideo').evaluate(video=>video.muted && video.playsInline));
    if(evidence)await page.screenshot({path:path.join(evidence,'camera-preview.png'),fullPage:true});
    await page.locator('#scanCameraCapture').click();await stopped();await waitScan();
    assert.deepEqual(await visible(),[values[1]],'Camera results must honor the active filters');
    assert.equal(await page.locator('.scan-card img').count(),4);
    await reset();assert.deepEqual(await visible(),values,'Camera frame should decode the same payloads as file import');
    assert(await page.locator('#scanCameraPanel').isHidden());

    await startCamera();
    await page.locator('#scanCameraDevice').selectOption('front-test-camera');
    await page.waitForFunction(()=>window.__cameraTest.calls.at(-1).video.deviceId?.exact==='front-test-camera' && !document.getElementById('scanCameraCapture').disabled);
    assert.equal(await page.evaluate(()=>window.__cameraTest.activeTracks()),1,'Switching devices must release the previous stream');
    await page.locator('#scanCameraClose').click();await stopped();

    await page.evaluate(()=>{window.__cameraTest.mode='defer';});
    await page.locator('#scanCamera').click();
    await page.waitForFunction(()=>window.__cameraTest.pending.length===1);
    await page.locator('#scanCameraClose').click();
    await page.evaluate(()=>window.__cameraTest.resolvePending());
    await stopped();assert(await page.locator('#scanCameraPanel').isHidden(),'A late permission result must not reopen the camera');

    await page.evaluate(()=>{window.__cameraTest.mode='deny';});
    await page.locator('#scanCamera').click();
    await page.waitForFunction(()=>!document.getElementById('scanCameraFallback').hidden);
    assert.match(await page.locator('#scanCameraStatus').innerText(),/权限|允许|拒绝/);
    await stopped();
    await page.evaluate(()=>{window.__cameraTest.mode='missing';});
    await page.locator('#scanCamera').click();
    await page.waitForFunction(()=>!document.getElementById('scanCameraFallback').hidden);
    assert.match(await page.locator('#scanCameraStatus').innerText(),/相机|摄像头/);
    assert.equal(await page.locator('#scanCameraFile').getAttribute('capture'),'environment');
    await page.locator('#scanClear').click();
    await page.locator('#scanCameraFile').setInputFiles(source);await waitScan();
    assert.deepEqual(await visible(),values,'Native camera/file fallback should use the same decoding pipeline');

    await page.evaluate(()=>{window.__cameraTest.mode='allow';});
    await startCamera();await page.locator('#tableMode').click();await stopped();
    assert(await page.locator('#scanCameraPanel').isHidden());
    await page.locator('#scanMode').click();
    assert.equal(await page.evaluate(()=>window.__cameraTest.activeTracks()),0,'Returning to the scanner must require a fresh camera click');
    await startCamera();await page.locator('#scanClear').click();await stopped();
    assert.equal(await page.locator('.scan-card').count(),0);
    await startCamera();
    await page.locator('#scanFiles').setInputFiles(source);await waitScan();await stopped();
    assert.deepEqual(await visible(),values,'File import should close a live camera and still decode');
    await startCamera();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await stopped();
    // HTTP pages without a secure context must offer fallback without requesting media.
    const insecure=await browser.newPage({locale:'zh-CN'});
    await insecure.addInitScript(installCameraFixture);
    await insecure.addInitScript(()=>Object.defineProperty(window,'isSecureContext',{value:false}));
    insecure.on('pageerror',error=>errors.push(error.message));
    await insecure.goto(target);await insecure.locator('#scanMode').click();
    await insecure.locator('#scanCamera').click();
    assert.equal(await insecure.evaluate(()=>window.__cameraTest.calls.length),0);
    assert.match(await insecure.locator('#scanCameraStatus').innerText(),/HTTPS/);
    assert(await insecure.locator('#scanCameraFallback').isVisible());
    await insecure.locator('#scanCameraFile').setInputFiles(source);
    await insecure.waitForFunction(()=>!window.CodeViewScanner.isBusy(),{},{timeout:60000});
    assert.deepEqual(await insecure.locator('.scan-card pre').allTextContents(),values);
    await insecure.close();
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('PASS: default SN for file and camera input, 69 preset clears position and switches filter, literal prefixes and zero/duplicate preservation; per-image positions including staggered-row left-to-right order, combined filters, retained originals, download names, no-match/error visibility, Chinese/English at 320/390/720/1440px in light/dark; simulated camera capture/decode, switch, denied/missing cameras, late permission cancellation, stream cleanup, native-file and insecure-context fallback; no physical camera or external requests');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
