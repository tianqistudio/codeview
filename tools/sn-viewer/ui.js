(() => {
 const paths={upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',saveNext:'M8 3v11m-4-4 4 4 4-4M3 18v3h10m3-12 4 4-4 4m-3-4h7',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6',help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3h.01',detect:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8',play:'m9 5 10 7-10 7Z'};
 function icon(id,key,label,text=''){const e=document.getElementById(id);e.innerHTML='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[key]+'"/></svg>'+(text?'<span>'+text+'</span>':'');e.title=label;e.setAttribute('aria-label',label);}
 icon('pickFile','upload','选择 Excel 或文本文件','选择文件');icon('emptyImport','upload','选择 Excel 或文本文件','选择文件');icon('autoDetect','detect','重新识别 SN 列','自动识别');icon('apply','play','确认预览并开始显示','开始');
 icon('prev','left','上一张 · ←');icon('next','right','下一张 · 空格 / →');icon('save','download','保存 PNG');icon('saveNext','saveNext','保存并下一张');icon('focus','expand','大屏模式');icon('jump','right','跳转');icon('settings','settings','导入与设置');icon('help','help','使用说明');
 document.getElementById('emptyImport').onclick=()=>document.getElementById('file').click();
 document.getElementById('settings').onclick=()=>{document.body.classList.remove('focus');const collapsed=document.body.classList.toggle('viewing');document.getElementById('settings').setAttribute('aria-expanded',String(!collapsed));if(!collapsed)document.getElementById('sidebar').scrollIntoView({block:'start'});};
 document.getElementById('help').onclick=()=>{document.body.classList.remove('viewing','focus');document.getElementById('settings').setAttribute('aria-expanded','true');const d=document.getElementById('helpDetails');d.open=!d.open;if(d.open)d.scrollIntoView({block:'nearest'});};
})();

for(const side of ['left','right'])$(side+'Lock').onclick=()=>{
 const locked=neighborLocked[side]=!neighborLocked[side],label=side==='left'?'左侧':'右侧';
 const button=$(side+'Lock');button.setAttribute('aria-pressed',String(locked));
 button.title=locked?'已锁定：切换行时保留':'锁定：切换行时保留';
 button.setAttribute('aria-label',(locked?'解锁':'锁定')+label+'列条形码');
 button.querySelector('path').setAttribute('d',locked?'M8 10V7a4 4 0 0 1 8 0v3M6 10h12v11H6z':'M8 10V7a4 4 0 0 1 8 0M6 10h12v11H6z');
};

for(const side of ['left','right'])$(side+'Notify').onchange=()=>{delete neighborChanges[side];showNeighborChanges();};

for(const side of ['left','right']){ $(side+'PrevColumn').onclick=()=>shiftNeighborColumn(side,-1);$(side+'NextColumn').onclick=()=>shiftNeighborColumn(side,1); }

for(const side of ['left','right'])$(side+'ColumnSelect').onchange=e=>selectNeighborColumn(side,e.target.value);
