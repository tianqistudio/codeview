const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'../..');
const {html,main,target}=require('./test-html.cjs').readTestHtml();
const nodes=new Map();function el(id){if(!nodes.has(id))nodes.set(id,{value:'',style:{},classList:{},setAttribute(){}});return nodes.get(id);}
const sandbox={document:{getElementById:el},window:{addEventListener(){}},cvT:zh=>zh(),TextEncoder,TextDecoder,console,assert};vm.createContext(sandbox);vm.runInContext(main,sandbox);
vm.runInContext(`
const labels=['SN','SN 码','商品 SN','商品 SN 码','产品 SN 编码','设备 S/N 号码','ｓｎ 码','商品 ＳＮ 码','  Sn\\n码：','【商品 SN 码】','SN\\u200b码','序列号'];
for(const label of labels){
 assert(snHeader(label),label);
 sourceRows=textCells([['测试表头','',''],['69 码',label,'商品名'],['001234567','TEST000000088','商品 1'],['001234568','TEST000000089','商品 2']]);sourceMaxCols=3;
 const result=analyzeSNColumns();assert.equal(result.kind,'header');assert.equal(result.choices.length,1);const ch=result.choices[0];assert.equal(ch.col,1);assert.equal(ch.header,2);assert.equal(ch.start,3);assert.equal(ch.label,label);
 source={sheets:[{name:'Sheet1'}]};mappingReady=true;selectionConfirmed=true;$('column').value='1';$('headerRow').value='2';$('startRow').value='3';$('sheet').value='0';
 const data=gather();assert.equal(data.blocked.length,0);assert.equal(data.out.length,2);assert.equal(data.out[0].row,3);assert.equal(data.out[0].sn,'TEST000000088');assert.equal(cellInfo(data.out[0],0).label,'69 码');assert.equal(cellInfo(data.out[0],0).value,'001234567');assert.equal(cellInfo(data.out[0],2).label,'商品名');
}
for(const title of ['测试表头','SN','商品 SN 码']){
 sourceRows=textCells([[title,'',''],['副标题','',''],['','',''],['69 码','商品 SN 码','商品名'],['123456789','SN000001','商品']]);sourceMaxCols=3;
 const result=analyzeSNColumns();assert.equal(result.choices.length,1);assert.equal(result.choices[0].col,1);assert.equal(result.choices[0].header,4);assert.equal(result.choices[0].start,5);
}
sourceRows=textCells([['SN'],['DEMO0001'],['DEMO0002']]);sourceMaxCols=1;assert.equal(analyzeSNColumns().choices[0].header,1);
for(const label of ['测试表头','商品名称','69 码','商品条码','SKU','IMEI','SN状态','商品 SN 码清单','SN 备注'])assert(!snHeader(label),label);
sourceRows=textCells([['测试表头','',''],['设备 SN 码','电池 SN 码','商品名'],['DEVICE0001','BATTERY0001','商品']]);sourceMaxCols=3;assert.equal(analyzeSNColumns().choices.length,2);
`,sandbox);
console.log('PASS: 12 header aliases, title skipped, header row 2/data row 3, original labels and values, non-SN headers rejected, multiple SN choices retained');
