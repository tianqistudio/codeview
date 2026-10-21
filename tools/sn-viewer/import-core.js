// Pure local-file parsing; no DOM, network or source-data normalization.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CodeViewImport = api;
})(globalThis, function () {
  function failure(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function checkAbort(signal) {
    if (signal?.aborted) {
      const error = new Error('Import cancelled');
      error.name = 'AbortError';
      throw error;
    }
  }

  function createTaskGate() {
    let current = null;
    return {
      start() {
        current?.controller.abort();
        const controller = new AbortController();
        current = {controller, signal: controller.signal};
        return current;
      },
      isCurrent(task) { return current === task && !task.signal.aborted; },
      cancel() { current?.controller.abort(); current = null; },
      finish(task) { if (current === task) current = null; }
    };
  }

  function createDelimitedParser({separator, maxRows = 20000, maxColumns = 512}) {
    const rows = [];
    let row = [], field = '', quoted = false, quotePending = false;
    let atStart = true, firstCharacter = true, pendingCR = false, recordStarted = false;
    function cell() {
      if (row.length >= maxColumns) throw failure('COLUMN_LIMIT');
      row.push({v: field, type: 'text'});
      field = '';
      atStart = true;
    }
    function record() {
      cell();
      if (rows.length >= maxRows) throw failure('ROW_LIMIT');
      rows.push(row);
      row = [];
      recordStarted = false;
    }
    return {
      push(text) {
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (firstCharacter) {
            firstCharacter = false;
            if (ch === '\uFEFF') continue;
          }
          if (pendingCR) {
            pendingCR = false;
            if (ch === '\n') continue;
          }
          if (quoted) {
            if (quotePending) {
              quotePending = false;
              if (ch === '"') { field += '"'; continue; }
              quoted = false;
            } else {
              if (ch === '"') quotePending = true;
              else field += ch;
              continue;
            }
          }
          if (ch === '"' && atStart) {
            quoted = true;
            atStart = false;
            recordStarted = true;
          } else if (ch === separator) {
            cell();
            recordStarted = true;
          } else if (ch === '\r' || ch === '\n') {
            record();
            pendingCR = ch === '\r';
          } else {
            field += ch;
            atStart = false;
            recordStarted = true;
          }
        }
      },
      finish() {
        if (quoted && !quotePending) throw failure('UNCLOSED_QUOTE');
        if (recordStarted || field !== '' || row.length) record();
        return rows;
      }
    };
  }

  function createSeparatorProbe() {
    const counts = {',': 0, ';': 0, '\t': 0};
    let quoted = false, quotePending = false, complete = false;
    return {
      push(text) {
        for (const ch of text) {
          if (complete) break;
          if (quoted) {
            if (quotePending) {
              quotePending = false;
              if (ch === '"') continue;
              quoted = false;
            } else {
              if (ch === '"') quotePending = true;
              continue;
            }
          }
          if (ch === '"') quoted = true;
          else if (ch === '\r' || ch === '\n') complete = true;
          else if (Object.hasOwn(counts, ch)) counts[ch]++;
        }
        return complete;
      },
      separator() { return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; }
    };
  }

  async function readTextFile(file, options = {}) {
    const {signal, onProgress = () => {}, chunkSize = 64 * 1024,
      maxRows = 20000, maxColumns = 512,
      yieldControl = () => new Promise(resolve => setTimeout(resolve, 0))} = options;
    if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new RangeError('Invalid chunk size');
    // Let the parser remove the single initial BOM, including across byte boundaries.
    const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
    const probe = /\.csv$/i.test(file.name) ? createSeparatorProbe() : null;
    let parser = probe ? null : createDelimitedParser({separator: '\t', maxRows, maxColumns});
    let prefix = [];
    async function consume(text, final = false) {
      if (!parser) {
        prefix.push(text);
        if (!probe.push(text) && !final) return;
        parser = createDelimitedParser({separator: probe.separator(), maxRows, maxColumns});
        for (let i = 0; i < prefix.length; i++) {
          checkAbort(signal);
          parser.push(prefix[i]);
          if (i < prefix.length - 1) await yieldControl();
        }
        prefix = [];
      } else parser.push(text);
    }
    function decode(bytes, stream) {
      try { return decoder.decode(bytes, {stream}); }
      catch { throw failure('UTF8'); }
    }
    checkAbort(signal);
    onProgress(0, file.size);
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      checkAbort(signal);
      const end = Math.min(offset + chunkSize, file.size);
      const buffer = await file.slice(offset, end).arrayBuffer();
      checkAbort(signal);
      await consume(decode(buffer, true));
      checkAbort(signal);
      onProgress(end, file.size);
      await yieldControl();
      checkAbort(signal);
    }
    await consume(decode(undefined, false), true);
    checkAbort(signal);
    return parser.finish();
  }

  return {createDelimitedParser, createTaskGate, readTextFile, checkAbort};
});
