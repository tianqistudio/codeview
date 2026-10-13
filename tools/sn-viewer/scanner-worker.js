let ready;
self.onmessage = async ({data}) => {
  try {
    if (data.wasm) {
      ready = ZXingWASM.prepareZXingModule({overrides:{wasmBinary:data.wasm},fireImmediately:true});
    }
    await ready;
    const results = await ZXingWASM.readBarcodes(data.image, {tryHarder:true,tryRotate:true,tryInvert:true,maxNumberOfSymbols:255,textMode:'Plain'});
    results.sort((a,b)=>a.position.topLeft.y-b.position.topLeft.y || a.position.topLeft.x-b.position.topLeft.x);
    for (const result of results) {
      let image = null, error = '';
      try {
        const output = await ZXingWASM.writeBarcode(result.bytes, {format:result.format,scale:3,addQuietZones:true,options:result.contentType==='GS1'?'gs1':''});
        if (output.error || !output.image) throw new Error('此码暂不能按原格式生成');
        const check = await ZXingWASM.readBarcodes(output.image, {textMode:'Plain'});
        if (!check.some(r=>r.format===result.format && r.bytes.length===result.bytes.length && r.bytes.every((v,i)=>v===result.bytes[i]))) throw new Error('生成结果未通过内容核对');
        image = output.image;
      } catch (e) { error = e.message; }
      self.postMessage({kind:'result',text:result.text,format:result.format,image,error});
    }
    self.postMessage({kind:'done',count:results.length});
  } catch (e) { self.postMessage({kind:'error',error:e.message || '识别失败'}); }
};
