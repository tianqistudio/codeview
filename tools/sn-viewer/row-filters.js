const rowFilters = new Map();
let filterTotal = 0;
const filterText = (zh, en) => cvI18n.language === 'en' ? en : zh;

function matchesRowFilters(row) {
  for (const [column, values] of rowFilters) {
    if (!values.has(txt(row?.[column]?.v))) return false;
  }
  return true;
}

function filterButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = action;
  return button;
}

function applyRowFilters() {
  const viewing = document.body.classList.contains('viewing') || document.body.classList.contains('focus');
  resetViewer(filterText('筛选已更新，请核对后开始出码。', 'Filter updated. Review the preview and start.'));
  $('ackNumeric').checked = false;
  updatePreview();
  if (viewing && !$('apply').disabled) applyData();
}

function editRowFilter(column, trigger, panel) {
  document.querySelectorAll('.filter-editor:popover-open').forEach(menu => menu.hidePopover());
  panel.replaceChildren();
  const values = new Set();
  const sn = Number($('column').value);
  for (let r = Number($('startRow').value) - 1; r < sourceRows.length; r++) {
    const row = sourceRows[r];
    const cell = row?.[sn];
    if (txt(cell?.v).trim() || cell?.type === 'formula' || cell?.type === 'error') {
      values.add(txt(row?.[column]?.v));
    }
  }
  const activeValues = rowFilters.get(column);
  const chosen = new Set(Array.from(values).filter(value => !activeValues || activeValues.has(value)));
  const list = document.createElement('div');
  list.className = 'filter-values';
  function option(label, checked, action) {
    const line = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.onchange = () => action(box.checked);
    line.append(box, document.createTextNode(label));
    return line;
  }
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = filterText('搜索', 'Search');
  search.setAttribute('aria-label', search.placeholder);
  let visible = Array.from(values);
  const all = option(filterText('（全选）', '(Select all)'), false, checked => {
    for (const value of visible) {
      if (checked) chosen.add(value); else chosen.delete(value);
    }
    for (const box of list.querySelectorAll('input')) box.checked = checked;
  });
  function syncAll() {
    const count = visible.filter(value => chosen.has(value)).length;
    all.firstChild.checked = count > 0 && count === visible.length;
    all.firstChild.indeterminate = count > 0 && count < visible.length;
  }
  function drawList() {
   list.replaceChildren();
   const query = search.value.trim().toLocaleLowerCase();
   visible = Array.from(values).filter(value => (value || filterText('（空白）', '(Blank)')).toLocaleLowerCase().includes(query));
   for (const value of visible) {
    list.append(option(value || filterText('（空白）', '(Blank)'), chosen.has(value), checked => {
      if (checked) chosen.add(value);
      else chosen.delete(value);
      syncAll();
    }));
   }
   syncAll();
  }
  search.oninput = drawList;
  drawList();
  const clear = filterButton(filterText('清除此列筛选', 'Clear column filter'), () => {
    rowFilters.delete(column);
    applyRowFilters();
  });
  clear.disabled = !activeValues;
  panel.append(clear, search, all, list,
    filterButton(filterText('确定', 'OK'), () => {
      const selected = search.value.trim() ? new Set(visible.filter(value => chosen.has(value))) : chosen;
      if (selected.size === values.size) rowFilters.delete(column);
      else rowFilters.set(column, selected);
      applyRowFilters();
    }),
    filterButton(filterText('取消', 'Cancel'), () => { panel.hidePopover(); trigger.focus(); }));
  panel.hidden = false;
  panel.popover = 'auto';
  panel.showPopover();
  const rect = trigger.getBoundingClientRect();
  panel.style.left = Math.max(4, Math.min(rect.left, innerWidth - panel.offsetWidth - 4)) + 'px';
  panel.style.top = Math.max(4, Math.min(rect.bottom, innerHeight - panel.offsetHeight - 4)) + 'px';
  panel.onkeydown = event => event.stopPropagation();
  search.focus();
}

function renderFilterPreview(pre) {
  const toolbar = $('rowFilterControls');
  $('stageFilter').hidden = !filterTotal;
  const stage = $('stageFilter');
  stage.replaceChildren();
  toolbar.replaceChildren();
  if (!filterTotal) return;
  const panel = document.createElement('div');
  panel.hidden = true;
  panel.className = 'filter-editor';
  const picker = document.createElement('select');
  const header = sourceRows[Number($('headerRow').value) - 1];
  picker.add(new Option(filterText('按列筛选…', 'Filter by column…'), ''));
  picker.setAttribute('aria-label', picker.options[0].text);
  for (let col = 0; col < sourceMaxCols; col++) {
    picker.add(new Option(colName(col) + ' · ' + (txt(header?.[col]?.v) || colName(col)), String(col)));
  }
  picker.onchange = () => {
    if (picker.value === '') { panel.hidden = true; return; }
    editRowFilter(Number(picker.value), picker, panel);
  };
  toolbar.append(picker);
  const stagePanel = document.createElement('div');
  stagePanel.className = panel.className;
  stagePanel.hidden = true;
  stage.append(stagePanel);
  toolbar.append(panel);
  if (rowFilters.size) {
    const status = document.createElement('div');
    status.textContent = filterText('筛选后', 'Filtered') + ' ' + candidates.length + ' / ' + filterTotal;
    status.append(' ', filterButton(filterText('清除全部筛选', 'Clear all filters'), () => {
      rowFilters.clear();
      applyRowFilters();
    }));
    toolbar.append(status);
    stage.append(filterButton(status.firstChild.textContent + ' · ' + filterText('清除筛选', 'Clear filters'), () => {
      rowFilters.clear();
      applyRowFilters();
    }));
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  head.insertCell().textContent = filterText('源行', 'Row');
  for (let col = 0; col < sourceMaxCols; col++) {
    const title = txt(header?.[col]?.v);
    const label = (title || colName(col)) + (rowFilters.has(col) ? ' ✓ ▾' : ' ▾');
    const button = filterButton(label, () => editRowFilter(col, button, panel));
    const stageButton = filterButton(label, () => editRowFilter(col, stageButton, stagePanel));
    stageButton.classList.toggle('filter-active', rowFilters.has(col));
    stage.append(stageButton);
    button.classList.toggle('filter-active', rowFilters.has(col));
    const th = document.createElement('th');
    th.append(button);
    head.append(th);
  }
  const body = table.createTBody();
  for (const record of candidates.slice(0, 4)) {
    const row = body.insertRow();
    row.insertCell().textContent = record.row;
    for (let col = 0; col < sourceMaxCols; col++) {
      const cell = row.insertCell();
      cell.textContent = cellInfo(record, col).value;
      if (col === record.colIndex) cell.className = 'selected-col';
    }
  }
  const scroll = document.createElement('div');
  scroll.className = 'filter-table';
  scroll.append(table);
  pre.append(scroll);
}
