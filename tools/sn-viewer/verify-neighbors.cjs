const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
const {html,main,target}=require('./test-html.cjs').readTestHtml();
assert(html.includes('id="neighborAlert"'));
const nodes=new Map();function el(id){if(!nodes.has(id)){const ctx={fillRect(){},measureText(s){return {width:s.length*15}},fillText(s){this.value=s}};nodes.set(id,{options:[],replaceChildren(...args){this.options=args},add(o){this.options.push(o)},checked:false,hidden:true,width:0,height:0,ctx,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},getContext(){return ctx}})}return nodes.get(id)}
const sandbox={document:{getElementById:el},window:{addEventListener(){}},cvT:zh=>zh(),TextEncoder,TextDecoder,console,assert,Option:function(text,value){this.text=text;this.value=value}};vm.createContext(sandbox);vm.runInContext(main,sandbox);
vm.runInContext(`
const r={maxCols:3,colIndex:1,cells:[{v:'0012345',type:'text'},{v:'SN01',type:'text'},{v:'ABC-09',type:'text'}],headers:[]};
syncNeighborRow(r);$('leftCodes').checked=true;syncNeighborRow(r);assert.equal($('leftCodes').checked,true);syncNeighborRow({...r});assert.equal($('leftCodes').checked,false);neighborLocked.left=true;$('leftCodes').checked=true;syncNeighborRow({...r});assert.equal($('leftCodes').checked,true);neighborLocked.left=false;syncNeighborRow(r);assert.equal($('leftCodes').checked,false);$('leftCodes').checked=true;$('rightCodes').checked=true;neighborLocked.right=true;syncNeighborRow({...r});assert.equal($('leftCodes').checked,false);assert.equal($('rightCodes').checked,true);neighborLocked.right=false;$('rightCodes').checked=false;renderBarcode('MAIN');const mainWidth=$('canvas').width;
renderNeighborBarcode(r,0,'left');assert.equal($('leftBarcodeWrap').hidden,true);
$('leftCodes').checked=true;renderNeighborBarcode(r,0,'left');$('rightCodes').checked=true;renderNeighborBarcode(r,2,'right');
assert.equal($('leftBarcode').ctx.value,'0012345');assert.equal($('rightBarcode').ctx.value,'ABC-09');assert.equal($('leftBarcodeWrap').hidden,false);assert.equal($('canvas').width,mainWidth);assert.equal($('canvas').ctx.value,'MAIN');
r.cells[0].v='NEXT02';renderNeighborBarcode(r,0,'left');assert.equal($('leftBarcode').ctx.value,'NEXT02');
for(const value of ['商品 1','A'.repeat(81),'a\\nb']){r.cells[0].v=value;renderNeighborBarcode(r,0,'left');assert.equal($('leftBarcodeWrap').hidden,true);assert.equal($('leftBarcodeHint').hidden,false);assert.equal($('leftBarcode').width,0);}
r.cells[0].v='';renderNeighborBarcode(r,0,'left');assert.equal($('leftBarcodeWrap').hidden,true);assert.equal($('leftBarcodeHint').hidden,true);
renderNeighborBarcode(r,-1,'left');assert.equal($('leftBarcodeWrap').hidden,true);
r.cells[0]={v:'#N/A',type:'error'};renderNeighborBarcode(r,0,'left');assert.equal($('leftBarcodeWrap').hidden,true);
$('rightCodes').checked=false;renderNeighborBarcode(r,2,'right');assert.equal($('rightBarcodeWrap').hidden,true);assert.equal($('rightBarcode').width,0);

const first={...r,cells:[{v:'001',type:'text'},{v:'SN1'},{v:'Same'}],headers:[{v:'69 码'}]};
const second={...first,cells:[{v:'002',type:'text'},{v:'SN2'},{v:'Same'}]};
items=[first,second];lastNeighborRecord=null;$('leftNotify').checked=true;$('rightNotify').checked=true;
syncNeighborRow(first);assert.equal($('neighborAlert').hidden,true);syncNeighborRow(second);
assert.equal($('neighborAlert').textContent,'【69 码】发生变化（001 → 002）');assert.equal($('leftNotify').checked,true);
syncNeighborRow(second);assert.equal($('neighborAlert').hidden,false);syncNeighborRow(first);assert($('neighborAlert').textContent.includes('002 → 001'));
assert.equal($('rightNotifyLabel').textContent,'改变时通知我');
items=[{...first}];syncNeighborRow(items[0]);assert.equal($('neighborAlert').hidden,true);

const row1={maxCols:5,colIndex:2,cells:[{v:'A'},{v:'00123'},{v:'SN0001'},{v:'Product'},{v:'B'}],headers:[{v:'测试左'},{v:'69 码'},{v:'SN'},{v:'商品名'},{v:'测试右'}]};
const row2={...row1,cells:[{v:'A2'},{v:'00124'},{v:'SN0002'},{v:'Product'},{v:'B'}]};
items=[row1,row2];index=0;lastNeighborRecord=null;neighborColumns={left:null,right:null};
const savedRenderRow=renderRowContext;renderRowContext=(r)=>{syncNeighborRow(r);renderNeighborBarcode(r,neighborColumn(r,'left'),'left');renderNeighborBarcode(r,neighborColumn(r,'right'),'right');};
syncNeighborRow(row1);assert.equal(neighborColumn(row1,'left'),1);assert.equal(neighborColumn(row1,'right'),3);
$('leftCodes').checked=true;$('rightCodes').checked=true;shiftNeighborColumn('left',-1);shiftNeighborColumn('right',1);
assert.equal(neighborColumn(row1,'left'),0);assert.equal(neighborColumn(row1,'right'),4);assert.equal($('leftBarcode').ctx.value,'A');assert.equal($('rightBarcode').ctx.value,'B');assert.equal(row1.cells[2].v,'SN0001');assert.equal($('leftPrevColumn').disabled,true);assert.equal($('rightNextColumn').disabled,true);assert.equal($('neighborAlert').hidden,true);
shiftNeighborColumn('left',-1);assert.equal(neighborColumn(row1,'left'),0);
index=1;syncNeighborRow(row2);assert.equal(neighborColumn(row2,'left'),0);assert.equal(neighborColumn(row2,'right'),4);assert($('neighborAlert').textContent.includes('【测试左】'));assert(!$('neighborAlert').textContent.includes('00123'));
shiftNeighborColumn('left',1);assert.equal(neighborColumn(row2,'left'),1);assert.equal(neighborChanges.left,undefined);shiftNeighborColumn('left',1);assert.equal(neighborColumn(row2,'left'),3);
busy=true;shiftNeighborColumn('right',-1);assert.equal(neighborColumn(row2,'right'),4);busy=false;
items=[{...row1}];index=0;syncNeighborRow(items[0]);assert.equal(neighborColumn(items[0],'left'),1);assert.equal(neighborColumn(items[0],'right'),3);
selectNeighborColumn('left','4');assert.equal(neighborColumn(items[0],'left'),4);assert.equal($('leftColumnSelect').value,'4');assert.equal($('leftColumnSelect').options.length,5);assert(!$('leftColumnSelect').options.some(o=>o.value==='2'));selectNeighborColumn('left','2');assert.equal(neighborColumn(items[0],'left'),4);selectNeighborColumn('left','');assert.equal(neighborColumn(items[0],'left'),4);shiftNeighborColumn('left',-1);assert.equal($('leftColumnSelect').value,'3');
items[0].headers=[{v:'重复'},undefined,{v:'SN'},{v:'重复'},{v:'末列'}];syncNeighborArrows(items[0]);assert.equal($('leftColumnSelect').options[1].text,'A · 重复');assert.equal($('leftColumnSelect').options[2].text,'B · 无表头');assert.equal($('leftColumnSelect').options[3].text,'D · 重复');
renderRowContext=savedRenderRow;
`,sandbox);console.log('PASS: syntax, opt-in, both columns, raw leading zeros, row updates, main canvas isolation, unsupported/empty/missing/error values, toggle cleanup');
