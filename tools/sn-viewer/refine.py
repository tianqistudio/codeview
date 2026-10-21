from pathlib import Path
import argparse
import json
import re
import base64
from localize import localize

ROOT = Path(__file__).resolve().parents[2]
arguments = argparse.ArgumentParser(description='Build a standalone CodeView candidate.')
arguments.add_argument('--output', type=Path,
                       default=Path('交付/SN连续出码/SN_连续出码工具_v1.4.1-candidate.html'),
                       help='Candidate HTML path, relative to the project root or absolute.')
options = arguments.parse_args()
output = (ROOT / options.output).resolve()
# Local release metadata is intentionally excluded from public Git checkouts.
protected_outputs = {(ROOT / f'交付/SN连续出码/SN_连续出码工具_v{version}.html').resolve()
                     for version in ('1.4', '1.4.1')}
release_path = ROOT / 'release.json'
if release_path.exists():
    release = json.loads(release_path.read_text(encoding='utf-8-sig'))
    protected_outputs.add((ROOT / release['html']).resolve())
if output in protected_outputs or (ROOT / 'source').resolve() in output.parents:
    arguments.error('The deployed HTML and preserved source baseline cannot be overwritten.')
if output.suffix.lower() != '.html':
    arguments.error('--output must name an HTML file.')
source = ROOT / 'source/SN_连续出码工具_v1.1.html'
html = source.read_text(encoding='utf-8-sig')
css = (Path(__file__).parent / 'theme.css').read_text(encoding='utf-8')
ui = (Path(__file__).parent / 'ui.js').read_text(encoding='utf-8')
icon = (Path(__file__).parent / 'sn-icon.svg').read_bytes()
icon_uri = 'data:image/svg+xml;base64,' + base64.b64encode(icon).decode('ascii')
html = html.replace('</head>', '<link rel="icon" type="image/svg+xml" href="'+icon_uri+'"></head>', 1)
html = html.replace('<div class="brand-icon" aria-hidden="true">SN</div>', '<img class="brand-icon" src="'+icon_uri+'" width="40" height="40" alt="" aria-hidden="true">', 1)
html = html.replace('</style>', css + '\n</style>', 1)
html = html.replace('SN 连续出码 v1.1 · 自动定位与同一行核对', 'SN 连续出码 · Lite')
html = html.replace('SERIAL NUMBER · ROW-AWARE VIEWER', '离线工具')
html = html.replace('class="version-pill">1.1', 'class="version-pill">Lite')
html = html.replace('<span class="badge">● 本地处理 · 无网络请求</span>', '<div class="top-actions"><button id="settings" title="导入与设置" aria-label="导入与设置" aria-expanded="true"></button><button id="help" title="使用说明" aria-label="使用说明"></button></div>')
html = html.replace('<div class="or">或粘贴内容</div>', '<details id="pastePanel"><summary>粘贴表格</summary>')
html = html.replace('<div id="importMessage"', '</details><div id="importMessage"', 1)
import_controls = ('<div id="importActivity" class="import-activity" hidden>'
                   '<div class="import-stage"><span id="importPhase" role="status" aria-live="polite"></span>'
                   '<progress id="importProgress" max="1" value="0" aria-label="读取清单"></progress></div>'
                   '<button id="importCancel" type="button" title="取消导入" aria-label="取消导入">取消</button></div>')
html = html.replace('<div id="importMessage"', import_controls + '<div id="importMessage"', 1)
html = html.replace('<details><summary>数据、识别与扫码注意事项</summary>', '<details id="helpDetails"><summary>使用说明</summary>')
html = html.replace('导入 SN 清单', '导入').replace('01 / SOURCE', '01').replace('定位 SN 与核对范围', '确认 SN 列').replace('02 / MAP', '02')
html = html.replace('选择 Excel / 文本文件', '选择文件').replace('读取粘贴内容', '读取').replace('试用示例', '示例')
html = html.replace('可导入整张表，或复制包含 SN 及左右字段的连续多列。', 'Excel / CSV / TXT / TSV')
html = html.replace('SN 数据在第几列', 'SN 列').replace('工作表 / 数据源', '工作表')
html = html.replace('前 4 条预览：高亮列生成条码，左右列仅用于核对。', '预览').replace('CURRENT / TOTAL', '当前 / 总数')
html = html.replace('<h2>找到 SN，也看清它属于哪一行。</h2><p class="muted">导入整表 → 识别 SN 列 → 按一下，码与左右字段一起切换。</p><p class="small muted" style="margin-top:12px">不用宏 · 不用安装条码字体 · 无需联网</p>', '<h2>导入，开始出码</h2><p class="muted">选择文件 → 确认 SN 列 → 连续切换</p><button id="emptyImport" class="primary">选择文件</button>')
html = html.replace('<span>同一行核对信息</span><span>左右字段不写入码图</span>', '<span>同行字段</span>')
html = html.replace('条形码 · Code 128 B</option>', '条形码</option>').replace('二维码 · QR Code</option>', '二维码</option>')
html = html.replace('切换 ≠ 扫码成功。确认上一条处理完成后再切换。', '切换前，请确认扫码完成。').replace('v1.1 · 离线版', '本地处理')
html = html.replace("$('next').firstChild.textContent=has&&index===items.length-1?'已到最后一条':'下一张 →';", "$('next').title=has&&index===items.length-1?'已到最后一条':'下一张 · 空格 / →';")
html = html.replace("$('focus').textContent=document.body.classList.contains('focus')?'退出大屏':'大屏模式';", "$('focus').setAttribute('aria-pressed',String(document.body.classList.contains('focus')));$('focus').title=document.body.classList.contains('focus')?'退出大屏 · Esc':'大屏模式';")
html = html.replace("function resetViewer(message=", "function resetViewer(message=", 1)
html = html.replace("items=[];index=0;render();$('status').textContent=message;", "items=[];index=0;document.body.classList.remove('viewing');document.body.classList.remove('focus');if($('settings'))$('settings').setAttribute('aria-expanded','true');render();$('status').textContent=message;")
html = html.replace("index=0;render();$('status').textContent=`已载入", "index=0;document.body.classList.add('viewing');$('settings').setAttribute('aria-expanded','false');render();$('status').textContent=`已载入")
html = html.replace('等待导入。可先点击「示例」。', '等待导入')
old_start = '<button id="apply" class="primary full" style="margin-top:13px">开始显示</button>'
old_heading = '<div class="section-title"><h2>确认 SN 列</h2><span class="step">02</span></div>'
assert html.count(old_start) == 1 and html.count(old_heading) == 1
html = html.replace(old_start, '')
html = html.replace(old_heading, '<div class="section-title mapping-heading"><h2>确认 SN 列</h2><button id="apply" class="primary">开始</button></div>')
# Optional adjacent-column barcodes reuse the exact Code 128 renderer.
def neighbor_control(side):
    label = '左侧' if side == 'left' else '右侧'
    return '<div class="neighbor-control '+side+'-control"><label class="neighbor-toggle"><input id="'+side+'Codes" type="checkbox" aria-label="'+label+'列条形码">条形码</label><button id="'+side+'Lock" class="neighbor-lock" aria-label="锁定'+label+'列条形码" title="锁定：切换行时保留" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 8 0M6 10h12v11H6z"/></svg></button></div>'
html = html.replace('<div class="image-wrap" id="imageWrap"', '<div id="neighborAlert" class="neighbor-alert" role="status" aria-live="polite" hidden></div><div class="image-wrap" id="imageWrap"', 1)
html = html.replace('<div id="sourceLine" hidden></div>', '<div id="contextControls" class="context-controls" hidden>'+neighbor_control('left')+'<div id="sourceLine" hidden></div>'+neighbor_control('right')+'</div>', 1)
for side in ('left','right'):
    control = neighbor_control(side)
    notification = '<label class="neighbor-toggle notify-toggle" title="选择保留到刷新"><input id="'+side+'Notify" type="checkbox"><span id="'+side+'NotifyLabel">改变时通知我</span></label>'
    html = html.replace(control, control[:-6]+notification+'</div>', 1)
html = html.replace("renderOK=false;const has=!!items.length;", "renderOK=false;const has=!!items.length;if(!has){lastNeighborRecord=null;neighborChanges={};showNeighborChanges();}", 1)
html = html.replace("$('sourceLine').hidden=!has;", "$('sourceLine').hidden=!has;$('contextControls').hidden=!has;", 1)
for side in ('left', 'right'):
    anchor = '<div id="'+side+'Note" class="cell-note" hidden></div>'
    html = html.replace(anchor, anchor+'<div id="'+side+'BarcodeWrap" class="neighbor-barcode" hidden><canvas id="'+side+'Barcode" role="img"></canvas></div><div id="'+side+'BarcodeHint" class="cell-note" hidden></div>', 1)
html = html.replace('function renderBarcode(sn){', "function renderBarcode(sn,c=$('canvas')){")
html = html.replace("h=272;const c=$('canvas');c.width=w;", 'h=272;c.width=w;', 1)
neighbor = (Path(__file__).parent / 'neighbor.js').read_text(encoding='utf-8')
html = html.replace('function renderRowContext(record){', 'function renderRowContext(record){syncNeighborRow(record);', 1)
html = html.replace('function renderContextCard(record,col,side){', neighbor+'\nfunction renderContextCard(record,col,side){', 1)
html = html.replace("$(side+'Note').hidden=!info.note;", "$(side+'Note').hidden=!info.note;renderNeighborBarcode(record,col,side);", 1)
html = html.replace("$('pickFile').onclick=", "for(const side of ['left','right'])$(side+'Codes').onchange=()=>{if(items.length)renderRowContext(items[index]);};\n$('pickFile').onclick=", 1)
# Header aliases affect matching only; keep displayed labels and SN values original.
old_header = "function snHeader(v){const n=normalizeHeader(v).replace(/[.。\\[\\]【】]/g,'');return SN_HEADERS.has(n)||/^[\\u4e00-\\u9fff]{1,10}(?:sn|序列号)$/.test(n);}"
assert html.count(old_header) == 1
header_code = (Path(__file__).parent / 'sn-header.js').read_text(encoding='utf-8')
html = html.replace(old_header, header_code, 1)
html = html.replace('const headers=new Map();let occupied=0;', 'const headers=new Map(),titleRows=leadingTitleRows();let occupied=0;', 1)
html = html.replace('const row=sourceRows[r];if(!row||!row.some', 'const row=sourceRows[r];if(titleRows.has(r))continue;if(!row||!row.some', 1)

for side in ('left','right'):
    title = '左侧' if side == 'left' else '右侧'
    original = '<h3 id="'+side+'Position">'+title+'列</h3>'
    buttons = ''.join('<button id="'+side+suffix+'Column" class="column-arrow" title="'+title+'字段：'+label+'" aria-label="'+title+'字段：'+label+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg></button>' for suffix,label,path in [('Prev','前一列','m14 6-6 6 6 6'),('Next','后一列','m10 6 6 6-6 6')])
    assert html.count(original) == 1
    html = html.replace(original, '<div class="context-heading">'+original+'<div class="column-arrows"><select id="'+side+'ColumnSelect" class="column-select" aria-label="'+title+'字段：选择表头" title="选择表头定位列"></select>'+buttons+'</div></div>', 1)
html = html.replace("renderContextCard(record,record.colIndex-1,'left');renderContextCard(record,record.colIndex+1,'right');", "renderContextCard(record,neighborColumn(record,'left'),'left');renderContextCard(record,neighborColumn(record,'right'),'right');", 1)
html = html.replace('if(!has){lastNeighborRecord=null;', 'if(!has){neighborColumns={left:null,right:null};lastNeighborRecord=null;', 1)
html = html.replace('function syncButtons(){', 'function syncButtons(){syncNeighborArrows(items[index]);', 1)
# Replace only the live import paths; the original source remains immutable.
import_dir = Path(__file__).parent
import_core = (import_dir / 'import-core.js').read_text(encoding='utf-8')
import_ui = (import_dir / 'import-ui.js').read_text(encoding='utf-8')
import_css = (import_dir / 'import.css').read_text(encoding='utf-8')
html = html.replace('</head>', '<script id="tableImportCore">\n' + import_core + '\n</script></head>', 1)
html = html.replace('</style>', import_css + '\n</style>', 1)
html, replaced = re.subn(r'async function chooseSheet\(\)\{.*?\n\}\n(?=function mappingChanged)',
                         lambda _: import_ui + '\n', html, count=1, flags=re.S)
assert replaced == 1, 'Expected one worksheet import implementation'
html, replaced = re.subn(r'async function loadFile\(file\)\{.*?\n\}\n(?=async function loadPaste)',
                         '', html, count=1, flags=re.S)
assert replaced == 1, 'Expected one legacy file import implementation'
paste_start = "if(busy)return;loadToken++;resetViewer();"
assert html.count(paste_start) == 1
html = html.replace(paste_start, "if(busy)return;cancelTableImport(false);loadToken++;resetViewer();", 1)
html = html.replace("await chooseSheet();if(sample&&source?.name.startsWith('演示')&&!$('apply').disabled)applyData();",
                    "const pastedSource=source;await chooseSheet();if(sample&&source===pastedSource&&mappingReady&&!$('apply').disabled)applyData();", 1)
html = html.replace('</body>', '<script>\n'+ui+'\n</script></body>')
html = html.replace('SN 连续出码 · Lite', '码映 CodeView · 识码与出码')
html = html.replace('SN 连续出码 <span', '码映 CodeView <span')
scanner_dir = Path(__file__).parent
scanner_css = (scanner_dir / 'scanner.css').read_text(encoding='utf-8')
scanner_html = (scanner_dir / 'scanner.html').read_text(encoding='utf-8')
scanner_js = (scanner_dir / 'scanner.js').read_text(encoding='utf-8')
worker = (scanner_dir / 'vendor/zxing.js').read_text(encoding='utf-8') + '\n' + (scanner_dir / 'scanner-worker.js').read_text(encoding='utf-8')
wasm = base64.b64encode((scanner_dir / 'vendor/zxing_full.wasm').read_bytes()).decode('ascii')
license_text = '\n\n'.join((scanner_dir / ('vendor/' + name)).read_text(encoding='utf-8') for name in ('ZXING-LICENSE.txt', 'ZXING-CPP-LICENSE.txt', 'ZINT-LICENSE.txt'))
html = html.replace("script-src 'unsafe-inline';", "script-src 'unsafe-inline' 'wasm-unsafe-eval'; worker-src blob:;")
html = html.replace('</style>', scanner_css + '\n</style>', 1)
html = html.replace('<main class="layout">', scanner_html + '\n<main class="layout">', 1)
html = html.replace('</body>', '<!-- ZXing WASM 3.1.4\n' + license_text.replace('--', '—') + '\n-->\n<script id="scannerWorker" type="text/plain">' + base64.b64encode(worker.encode()).decode('ascii') + '</script><script id="scannerWasm" type="text/plain">' + wasm + '</script><script>\n' + scanner_js + '\n</script></body>')
# Defer nested UI fragments so both translations are evaluated in their own locale.
html = html.replace('const loc=`${colName(choice.col)}', 'const loc=()=>`${colName(choice.col)}')
html = html.replace('const detail=choice.header?', 'const detail=()=>choice.header?')
html = html.replace('${loc}', '${loc()}').replace('${detail}', '${detail()}')
html = localize(html)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf-8')
if not (output.parent / 'SN-icon.svg').exists():
    (output.parent / 'SN-icon.svg').write_bytes(icon)
print(output)
