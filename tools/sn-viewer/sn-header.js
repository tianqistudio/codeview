function snHeader(v){
 const n=normalizeHeader(txt(v).normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'')).replace(/[.。\[\]【】]/g,'');
 return SN_HEADERS.has(n)||/^(?:(?:商品|产品|设备|机身|主机|电池|相机|云台))?sn(?:码|号|编码|号码|序列号)?$/.test(n)||/^[\u4e00-\u9fff]{1,10}(?:sn|序列号)$/.test(n);
}

function leadingTitleRows(){
 // A full field-header row below takes precedence over single-cell title lines.
 let header=-1,occupied=0;
 for(let r=0;r<sourceRows.length&&occupied<HEADER_SCAN_ROWS;r++){
  const cells=(sourceRows[r]||[]).filter(c=>txt(c?.v).trim()!=='');
  if(!cells.length)continue;occupied++;
  if(cells.length>1&&cells.some(c=>c.type!=='formula'&&snHeader(c.v))){header=r;break;}
 }
 const skipped=new Set();
 if(header>0)for(let r=0;r<header;r++)if((sourceRows[r]||[]).filter(c=>txt(c?.v).trim()!=='').length<=1)skipped.add(r);
 return skipped;
}
