let neighborColumns={left:null,right:null};
function neighborColumn(record,side){return neighborColumns[side]??(record.colIndex+(side==='left'?-1:1));}
function nextNeighborColumn(record,side,delta){
 const current=neighborColumn(record,side);let next=current+delta;
 if(next===record.colIndex)next+=delta;
 return next>=0&&next<record.maxCols?next:current;
}
function syncNeighborSelect(record,side){
 const select=$(side+'ColumnSelect');select.disabled=busy||!record||record.maxCols<=1;
 if(!record)return;
 if(select.columnHeaders!==record.headers||select.columnCount!==record.maxCols||select.snColumn!==record.colIndex){
  select.replaceChildren(new Option('选择列',''));
  for(let c=0;c<record.maxCols;c++)if(c!==record.colIndex)select.add(new Option(colName(c)+' · '+(txt(record.headers[c]?.v).trim()||'无表头'),String(c)));
  select.columnHeaders=record.headers;select.columnCount=record.maxCols;select.snColumn=record.colIndex;
 }
 const col=neighborColumn(record,side);select.value=col>=0&&col<record.maxCols?String(col):'';
 select.title=col>=0&&col<record.maxCols?colName(col)+' · '+(txt(record.headers[col]?.v).trim()||'无表头'):'选择表头定位列';
}
function selectNeighborColumn(side,col){
 if(busy||!items.length||col==='')return;
 const record=items[index],next=Number(col);
 if(!Number.isInteger(next)||next<0||next>=record.maxCols||next===record.colIndex||next===neighborColumn(record,side))return;
 neighborColumns[side]=next;delete neighborChanges[side];renderRowContext(record);
}
function syncNeighborArrows(record){
 for(const side of ['left','right'])syncNeighborSelect(record,side);
 for(const side of ['left','right'])for(const [suffix,delta] of [['Prev',-1],['Next',1]]){
  $(side+suffix+'Column').disabled=busy||!record||nextNeighborColumn(record,side,delta)===neighborColumn(record,side);
 }
}
function shiftNeighborColumn(side,delta){
 if(busy||!items.length)return;
 const record=items[index],next=nextNeighborColumn(record,side,delta);
 if(next===neighborColumn(record,side))return;
 selectNeighborColumn(side,next);
}
let neighborLocked={left:false,right:false},lastNeighborRecord=null;
let neighborChanges={};
function showNeighborChanges(){
 const messages=[];
 for(const side of ['left','right'])if($(side+'Notify').checked&&neighborChanges[side])messages.push(neighborChanges[side]);
 $('neighborAlert').textContent=messages.join('\n');$('neighborAlert').hidden=!messages.length;
}
function syncNeighborRow(record){
 if(lastNeighborRecord&&!items.includes(lastNeighborRecord))neighborColumns={left:null,right:null};
 syncNeighborArrows(record);
 for(const side of ['left','right']){
  const col=neighborColumn(record,side),info=cellInfo(record,col),header=txt(record.headers[col]?.v).trim();
  $(side+'NotifyLabel').textContent='改变'+(header?'【'+header+'】':'')+'时通知我';
  $(side+'Notify').disabled=!info.exists;
 }
 if(record!==lastNeighborRecord){
  neighborChanges={};
  if(lastNeighborRecord&&items.includes(lastNeighborRecord))for(const side of ['left','right']){
   const col=neighborColumn(record,side),oldCol=neighborColumn(lastNeighborRecord,side);
   const now=cellInfo(record,col),old=cellInfo(lastNeighborRecord,oldCol);
   if(now.exists&&old.exists&&txt(record.cells[col]?.v)!==txt(lastNeighborRecord.cells[oldCol]?.v)){
    const header=txt(record.headers[col]?.v).trim(),name=header?'【'+header+'】':(side==='left'?'左侧列':'右侧列');
    neighborChanges[side]=name+'发生变化（'+old.value+' → '+now.value+'）';
   }
  }
 }
 showNeighborChanges();
 for(const side of ['left','right'])if(record!==lastNeighborRecord&&!neighborLocked[side])$(side+'Codes').checked=false;
 lastNeighborRecord=record;
}
function renderNeighborBarcode(record,col,side){
 const wrap=$(side+'BarcodeWrap'),canvas=$(side+'Barcode'),hint=$(side+'BarcodeHint');
 wrap.hidden=true;hint.hidden=true;hint.textContent='';canvas.width=0;canvas.height=0;canvas.removeAttribute('aria-label');
 if(!$(side+'Codes').checked)return;
 const info=cellInfo(record,col),cell=record.cells[col];
 if(!info.exists||info.empty)return;
 const value=txt(cell?.v);
 if(cell?.type==='error'){hint.textContent='单元格错误，无法出码';hint.hidden=false;return;}
 if(!/^[\x20-\x7e]{1,80}$/.test(value)){hint.textContent='仅支持 1–80 位英文、数字或符号';hint.hidden=false;return;}
 renderBarcode(value,canvas);canvas.setAttribute('aria-label',`${side==='left'?'左侧':'右侧'}条形码：${value}`);wrap.hidden=false;
}
