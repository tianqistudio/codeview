const tableImportGate = CodeViewImport.createTaskGate();
let tableImportPhase = null;

function renderTableImportPhase() {
  if (!tableImportPhase) return;
  const {phase, loaded, total} = tableImportPhase;
  const progress = $('importProgress');
  let message;
  if (phase === 'reading') {
    const percent = total ? Math.floor(loaded * 100 / total) : 0;
    message = cvT(() => `读取清单… ${percent}%`, () => `Reading list… ${percent}%`);
    progress.max = total || 1;
    progress.value = loaded;
  } else {
    progress.removeAttribute('value');
    message = phase === 'workbook'
      ? cvT(() => '解析工作簿…', () => 'Parsing workbook…')
      : phase === 'sheet'
        ? cvT(() => '解析工作表…', () => 'Parsing worksheet…')
        : cvT(() => '准备预览…', () => 'Preparing preview…');
  }
  $('importPhase').textContent = message;
  progress.setAttribute('aria-label', message);
}

function setTableImportPhase(task, phase, loaded = 0, total = 0) {
  if (!tableImportGate.isCurrent(task)) return;
  tableImportPhase = {phase, loaded, total};
  $('importActivity').hidden = false;
  renderTableImportPhase();
}

function finishTableImport(task) {
  if (!tableImportGate.isCurrent(task)) return;
  tableImportGate.finish(task);
  tableImportPhase = null;
  $('importActivity').hidden = true;
}

function cancelTableImport(notify = true) {
  tableImportGate.cancel();
  loadToken++;
  tableImportPhase = null;
  $('importActivity').hidden = true;
  mappingReady = false;
  mappingCanApply = false;
  selectionConfirmed = false;
  source = null;
  sourceRows = [];
  sourceMaxCols = 0;
  candidates = [];
  $('mapping').hidden = true;
  setMappingLock();
  if (notify) showMessage('importMessage', cvT(() => '已取消导入。可以重新选择文件。', () => 'Import cancelled. Choose a file to try again.'));
}

function tableImportError(error) {
  const messages = {
    UTF8: () => '请把文本另存为 UTF-8 编码后再导入，或直接复制 Excel 中的多列后粘贴。',
    ROW_LIMIT: () => '行数超过 20,000，请拆分清单。',
    COLUMN_LIMIT: () => '已读取范围超过 512 列，请只保留所需列后重新导入。',
    UNCLOSED_QUOTE: () => '文本中存在未闭合的双引号，请检查 CSV 格式。'
  };
  return messages[error.code] ? messages[error.code]() : error.message || String(error);
}

async function loadFile(file) {
  if (!file || busy) return;
  const task = tableImportGate.start();
  loadToken++;
  resetViewer();
  mappingReady = false;
  mappingCanApply = false;
  selectionConfirmed = false;
  $('mapping').hidden = true;
  source = null;
  sourceRows = [];
  sourceMaxCols = 0;
  candidates = [];
  setMappingLock();
  showMessage('importMessage', '');
  $('fileName').textContent = file.name;
  try {
    if (file.size > MAX_FILE) throw Error('文件超过 10 MB。请只保留需要的表格范围后重试。');
    let imported;
    if (/\.xlsx$/i.test(file.name)) {
      setTableImportPhase(task, 'workbook');
      // Allow the stage and cancellation control to paint before the existing parser runs.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (!tableImportGate.isCurrent(task)) return;
      imported = await readXlsx(file);
    } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      setTableImportPhase(task, 'reading', 0, file.size);
      const rows = await CodeViewImport.readTextFile(file, {
        signal: task.signal, maxRows: MAX_ROWS, maxColumns: 512,
        onProgress: (loaded, total) => setTableImportPhase(task, 'reading', loaded, total)
      });
      imported = {name: file.name, sheets: [{name: file.name}], rows: async () => rows};
    } else throw Error('请选择 .xlsx、CSV、TXT 或 TSV；旧式 .xls 请先另存为 .xlsx。');
    if (!tableImportGate.isCurrent(task)) return;
    source = imported;
    setSourceControls();
    await chooseSheet(task);
  } catch (error) {
    if (tableImportGate.isCurrent(task)) {
      mappingReady = false;
      setMappingLock();
      showMessage('importMessage', tableImportError(error), 'error');
    }
  } finally { finishTableImport(task); }
}

async function chooseSheet(existingTask = null) {
  if (!source) return;
  const task = existingTask || tableImportGate.start();
  const token = ++loadToken, localSource = source, sheetIndex = Number($('sheet').value);
  const current = () => tableImportGate.isCurrent(task) && token === loadToken;
  mappingReady = false;
  mappingCanApply = false;
  selectionConfirmed = false;
  sourceRows = [];
  sourceMaxCols = 0;
  setMappingLock();
  clearChoices();
  showMessage('detectionMessage', '');
  showMessage('importMessage', '');
  setTableImportPhase(task, /\.xlsx$/i.test(localSource.name) ? 'sheet' : 'preview');
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!current()) return;
    const rows = await localSource.rows(sheetIndex);
    if (!current()) return;
    setTableImportPhase(task, 'preview');
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!current()) return;
    let maxColumns = 0;
    for (const row of rows) if (row) maxColumns = Math.max(maxColumns, row.length);
    if (maxColumns > 512) throw Error('已读取范围超过 512 列，请只保留所需列后重新导入。');
    if (!maxColumns) throw Error('所选工作表没有可用数据。');
    sourceRows = rows;
    sourceMaxCols = maxColumns;
    $('column').replaceChildren(new Option('请选择 SN 所在列', ''));
    for (let c = 0; c < sourceMaxCols; c++) $('column').add(new Option(`${colName(c)} 列（第 ${c+1} 列）`, String(c)));
    $('columnNumber').max = String(sourceMaxCols);
    $('columnNumber').value = '';
    $('headerRow').value = '0';
    $('startRow').value = String(firstDataRow()+1);
    $('ackNumeric').checked = false;
    mappingReady = true;
    setMappingLock();
    autoDetectSN();
  } catch (error) {
    if (current()) {
      mappingReady = false;
      setMappingLock();
      showMessage('importMessage', tableImportError(error), 'error');
    }
  } finally { finishTableImport(task); }
}

$('importCancel').onclick = () => cancelTableImport();
window.addEventListener('codeview-language', renderTableImportPhase);
