const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createDelimitedParser, createTaskGate, readTextFile} = require('./import-core.js');

function file(text, name = 'list.csv') {
  return Object.assign(new Blob([text]), {name});
}
function values(rows) { return rows.map(row => row.map(cell => cell.v)); }
const noWait = async () => {};

test('every byte split preserves UTF-8, BOM, quoted delimiters, CRLF, spaces and duplicate values', async () => {
  const text = '\uFEFFSN,商品,备注\r\n000001,相机📷,"第一行\r\n第二行"\r\n000001," A,B ","他说""好"""\r\n12345678901234567890,,尾部\r\n';
  const expected = [['SN', '商品', '备注'], ['000001', '相机📷', '第一行\r\n第二行'],
    ['000001', ' A,B ', '他说"好"'], ['12345678901234567890', '', '尾部']];
  for (let chunkSize = 1; chunkSize <= Buffer.byteLength(text); chunkSize++) {
    const rows = await readTextFile(file(text), {chunkSize, yieldControl: noWait});
    assert.deepEqual(values(rows), expected, `chunk size ${chunkSize}`);
    assert(rows.flat().every(cell => cell.type === 'text'));
  }
});

test('separator detection spans quoted header newlines and escaped quotes', async () => {
  const text = '"SN";"标题,\r\n含""引号""";备注\r\n0001;商品; x ';
  for (const chunkSize of [1, 2, 3, 8, 64]) {
    assert.deepEqual(values(await readTextFile(file(text), {chunkSize, yieldControl: noWait})),
      [['SN', '标题,\r\n含"引号"', '备注'], ['0001', '商品', ' x ']]);
  }
});

test('TSV and TXT retain blank records, embedded tabs, CR/LF and empty quoted cells', async () => {
  const text = '\uFEFFSN\t备注\r0001\t"a\tb"\n\n0002\t""';
  for (const name of ['list.tsv', 'list.txt']) {
    assert.deepEqual(values(await readTextFile(file(text, name), {chunkSize: 1, yieldControl: noWait})),
      [['SN', '备注'], ['0001', 'a\tb'], [''], ['0002', '']]);
  }
  const parser = createDelimitedParser({separator: ','});
  parser.push('""');
  assert.deepEqual(values(parser.finish()), [['']]);
  assert.deepEqual(values(await readTextFile(file(''), {yieldControl: noWait})), []);
});

test('invalid UTF-8, truncated characters and unterminated quoted fields fail explicitly', async () => {
  for (const bytes of [Uint8Array.of(0x53, 0x4e, 0x0a, 0xff), Uint8Array.of(0xe4, 0xb8)]) {
    await assert.rejects(readTextFile(file(bytes), {chunkSize: 1, yieldControl: noWait}), {code: 'UTF8'});
  }
  await assert.rejects(readTextFile(file('SN,备注\n0001,"unfinished'), {chunkSize: 1, yieldControl: noWait}),
    {code: 'UNCLOSED_QUOTE'});
});

test('source row and column limits are enforced without truncation', async () => {
  const accepted = Array.from({length: 20000}, (_, i) => `${i}\tx`).join('\n');
  assert.equal((await readTextFile(file(accepted, 'rows.tsv'), {yieldControl: noWait})).length, 20000);
  await assert.rejects(readTextFile(file(accepted + '\n20000\tx', 'rows.tsv'), {yieldControl: noWait}), {code: 'ROW_LIMIT'});
  assert.equal((await readTextFile(file(Array(512).fill('x').join(',')), {yieldControl: noWait}))[0].length, 512);
  await assert.rejects(readTextFile(file(Array(513).fill('x').join(',')), {yieldControl: noWait}), {code: 'COLUMN_LIMIT'});
});

test('reads use bounded slices and report actual monotonic byte progress', async () => {
  const source = file('SN,备注\n' + '0001,中文\n'.repeat(1000));
  let reads = 0, yields = 0;
  const progress = [];
  const wrapped = {name: source.name, size: source.size,
    arrayBuffer() { throw Error('Whole-file read is forbidden'); },
    slice(start, end) {
      assert(end - start <= 257);
      reads++;
      return source.slice(start, end);
    }};
  await readTextFile(wrapped, {chunkSize: 257, onProgress: (done, total) => progress.push([done, total]),
    yieldControl: async () => { yields++; }});
  assert.equal(reads, Math.ceil(source.size / 257));
  assert.equal(yields, reads);
  assert.deepEqual(progress[0], [0, source.size]);
  assert.deepEqual(progress.at(-1), [source.size, source.size]);
  assert(progress.every(([done, total], i) => total === source.size && (!i || done > progress[i-1][0])));
});

test('cancellation during a pending read rejects before parsing or reporting stale progress', async () => {
  const controller = new AbortController();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const progress = [];
  const source = {name: 'late.csv', size: 3, slice() { return {arrayBuffer: () => pending}; }};
  const result = readTextFile(source, {signal: controller.signal, onProgress: n => progress.push(n)});
  controller.abort();
  release(new TextEncoder().encode('old').buffer);
  await assert.rejects(result, {name: 'AbortError'});
  assert.deepEqual(progress, [0]);
});

test('cancellation after progress prevents remaining chunks and allows a new import', async () => {
  const controller = new AbortController();
  const progress = [];
  await assert.rejects(readTextFile(file('SN\n0001\n0002'), {chunkSize: 3, signal: controller.signal,
    onProgress: done => { progress.push(done); if (done) controller.abort(); }, yieldControl: noWait}), {name: 'AbortError'});
  assert.deepEqual(progress, [0, 3]);
  assert.deepEqual(values(await readTextFile(file('SN\n0003'), {yieldControl: noWait})), [['SN'], ['0003']]);
});

test('task generation isolates late completion, late errors and old cleanup from new imports', async () => {
  const gate = createTaskGate();
  const oldTask = gate.start();
  const newTask = gate.start();
  assert(oldTask.signal.aborted);
  assert(!gate.isCurrent(oldTask));
  gate.finish(oldTask);
  assert(gate.isCurrent(newTask));
  const accepted = [];
  for (const [task, result] of [[oldTask, 'late'], [newTask, 'current']]) {
    if (gate.isCurrent(task)) accepted.push(result);
  }
  assert.deepEqual(accepted, ['current']);
  gate.cancel();
  assert(newTask.signal.aborted);
  assert(!gate.isCurrent(newTask));
});
