(() => {
  const scanMessages = {empty:'SCAN_EMPTY',retry:'SCAN_RETRY',failed:'SCAN_FAILED'};
  const el = id => document.getElementById(id);
  let worker, busy = false, generation = 0, cancelPending;
  const urls = new Set(), names = new Set();
  function filename(text) {
    let base = Array.from(text.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_')).slice(0,100).join('').replace(/[. ]+$/g,'') || '未命名';
    if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(base)) base = '_' + base;
    let name = base, n = 2;
    while(names.has(name.toLowerCase())) name = `${base} (${n++})`;
    names.add(name.toLowerCase());
    return name + '.png';
  }
  function mode(scan) {
    document.body.classList.toggle('scanning-mode',scan);
    el('scanner').hidden = !scan;
    el('tableMode').setAttribute('aria-pressed',String(!scan));
    el('scanMode').setAttribute('aria-pressed',String(scan));
  }
  el('tableMode').onclick = () => mode(false);
  el('scanMode').onclick = () => mode(true);
  function setBusy(value) {
    busy=value; el('scanPick').disabled=value; el('scanCancel').hidden=!value;
    el('scanner').setAttribute('aria-busy',String(value));
  }
  function stop() { generation++; if(cancelPending)cancelPending(new Error('已取消'));cancelPending=null;if(worker) worker.terminate(); worker=null; setBusy(false); }
  el('scanCancel').onclick=()=>{stop();el('scanStatus').textContent='已取消，已生成的图片仍可保存';};
  el('scanClear').onclick=()=>{stop();urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();names.clear();el('scanResults').replaceChildren();el('scanStatus').textContent='等待图片';};
  function card(result, source) {
    const box=document.createElement('article');box.className='scan-card';
    const text=document.createElement('pre');text.textContent=result.text;
    if(result.image) {
      const url=URL.createObjectURL(result.image);urls.add(url);
      const img=document.createElement('img');img.src=url;img.alt=`${result.format}：${result.text}`;box.append(img);
      const footer=document.createElement('footer'), label=document.createElement('small'), button=document.createElement('button');
      const name=filename(result.text);label.textContent=`${source} · ${result.format}`;
      button.textContent='↓';
      const refresh=()=>{button.title=`保存 ${name}`;button.setAttribute('aria-label',`保存 ${name}`);};refresh();
      box.refreshLanguage=refresh;
      button.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=name;a.click();};
      footer.append(label,button);box.append(text,footer);
    } else {
      const note=document.createElement('small');
      const refresh=()=>{text.textContent=result.uiError?cvI18n.error(result.text):result.text;note.textContent=`${source} · ${result.format} · ${cvI18n.error(result.error)}`;};refresh();
      box.refreshLanguage=refresh;box.append(text,note);
    }
    el('scanResults').append(box);
  }
  window.addEventListener('codeview-language',()=>{for(const box of el('scanResults').children)box.refreshLanguage?.();});
  async function run(files) {
    if(busy || !files.length)return;
    mode(true);setBusy(true);const token=++generation;
    let count=0, saved=0, failed=0;
    try {
      const source=atob(el('scannerWorker').textContent.trim());
      const workerUrl=URL.createObjectURL(new Blob([Uint8Array.from(source,c=>c.charCodeAt(0))],{type:'text/javascript'}));
      try {worker=new Worker(workerUrl);} finally {URL.revokeObjectURL(workerUrl);}
      let wasm=Uint8Array.from(atob(el('scannerWasm').textContent.trim()),c=>c.charCodeAt(0));
      for(let i=0;i<files.length;i++) {
        if(token!==generation)return;
        const file=files[i];el('scanStatus').textContent=`识别 ${i+1}/${files.length}：${file.name || '粘贴图片'}`;
        let bitmap;
        try {
          if(file.size>50*1024*1024)throw new Error('图片超过 50 MB');
          bitmap=await createImageBitmap(file);
          if(token!==generation)return;
          if(bitmap.width*bitmap.height>24000000)throw new Error('图片超过 2400 万像素，请裁剪后导入');
          const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
          const image=ctx.getImageData(0,0,canvas.width,canvas.height);canvas.width=canvas.height=0;
          await new Promise((resolve,reject)=>{
            cancelPending=reject;
            worker.onerror=()=>reject(new Error('识别引擎无法运行，请使用新版 Chrome 或 Edge'));
            worker.onmessage=({data})=>{
              if(token!==generation)return;
              if(data.kind==='result'){count++;if(data.image)saved++;card(data,file.name || '粘贴图片');}
              else if(data.kind==='done'){if(!data.count)card({text:scanMessages.empty,uiError:true,format:'',error:scanMessages.retry},file.name || '粘贴图片');resolve();}
              else if(data.kind==='error')reject(new Error(data.error));
            };
            const transfers=[image.data.buffer];if(wasm)transfers.push(wasm.buffer);
            worker.postMessage({image,wasm},transfers);wasm=null;
          });
        } catch(e) {if(token!==generation)return;failed++;card({text:scanMessages.failed,uiError:true,format:'',error:e.message},file.name || '粘贴图片');}
        finally {if(token===generation)cancelPending=null;if(bitmap)bitmap.close();}
      }
      el('scanStatus').textContent=`识别到 ${count} 个码，生成 ${saved} 张图片${failed?`，${failed} 张源图处理失败`:''}。请核对是否有遗漏。`;
    } catch(e) {el('scanStatus').textContent=`无法启动识别：${e.message}`;}
    finally {if(token===generation){if(worker)worker.terminate();worker=null;setBusy(false);}}
  }
  el('scanPick').onclick=()=>el('scanFiles').click();
  el('scanFiles').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';run(files);};
  el('scanner').ondragover=e=>{e.preventDefault();el('scanner').classList.add('dragging');};
  el('scanner').ondragleave=()=>el('scanner').classList.remove('dragging');
  el('scanner').ondrop=e=>{e.preventDefault();el('scanner').classList.remove('dragging');run(Array.from(e.dataTransfer.files));};
  window.addEventListener('paste',e=>{if(el('scanner').hidden)return;const files=Array.from(e.clipboardData.items).filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();run(files);}});
})();
