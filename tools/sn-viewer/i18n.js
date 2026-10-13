// Only authored UI strings enter this catalog. Raw user data never does.
const cvI18n = (() => {
  const catalog = /* CATALOG */;
  let language = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  try { const saved = localStorage.getItem('codeview.language'); if (['zh-CN', 'en'].includes(saved)) language = saved; } catch {}
  const bindings = [], messages = new Map();
  function text(zh, en) {
    const active=language;let pair;
    try { language='zh-CN';const original=zh();language='en';pair=[original,en()]; }
    finally { language=active; }
    // Bound the cache to the current session's UI messages, not source records.
    if (messages.size > 2000) messages.clear();
    messages.set(pair[0], pair); messages.set(pair[1], pair);
    return pair[language === 'en' ? 1 : 0];
  }
  function capture() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('script,style,#language')) continue;
      const key = node.textContent.trim();
      if (Object.hasOwn(catalog, key)) bindings.push({node, key, original: node.textContent});
    }
    for (const node of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
      for (const attr of ['title','aria-label','placeholder']) {
        const key = node.getAttribute(attr);
        if (Object.hasOwn(catalog, key)) bindings.push({node, key, attr});
      }
    }
    applyStatic();
  }
  function applyStatic() {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'CodeView · Scan and generate codes' : '码映 CodeView · 识码与出码';
    for (const b of bindings) {
      if (!b.node.isConnected) continue;
      const value = language === 'en' ? catalog[b.key] : b.key;
      if (b.attr) {
        if (b.last !== undefined && b.node.getAttribute(b.attr) !== b.last) continue;
        b.node.setAttribute(b.attr, value); b.last = value;
      }
      else b.node.textContent = b.original.replace(b.key, value);
    }
  }
  function refreshMessage(node, attr) {
    const value = attr ? node.getAttribute(attr) : node.textContent;
    const key = Object.hasOwn(catalog,value) ? value : Object.keys(catalog).find(key=>catalog[key]===value);
    const pair = messages.get(value) || (key ? [key,catalog[key]] : null);
    if (pair) { if (attr) node.setAttribute(attr, pair[language === 'en' ? 1 : 0]); else node.textContent = pair[language === 'en' ? 1 : 0]; }
  }
  function start() {
    const select = document.getElementById('language'); select.value = language;
    select.onchange = () => {
      language = select.value;
      try { localStorage.setItem('codeview.language', language); } catch {}
      applyStatic();
      // Explicit UI-only targets: no data cells, filenames, headers or decoded text.
      for (const id of ['status','importMessage','detectionMessage','scanStatus']) refreshMessage(document.getElementById(id));
      for (const node of document.querySelectorAll('.top-actions button span,#pickFile span,#emptyImport span,#autoDetect span,#apply span,#detectionChoices button,#column option[value=""]')) refreshMessage(node);
      for (const node of document.querySelectorAll('button,[role="img"]')) {
        for (const attr of ['title','aria-label']) refreshMessage(node, attr);
      }
      refreshCodeViewLanguage();
      window.dispatchEvent(new Event('codeview-language'));
    };
  }
  function error(value) {
    const codes={SCAN_EMPTY:'未识别到码',SCAN_RETRY:'请检查清晰度，或裁剪后重试',SCAN_FAILED:'图片处理失败'};
    const key=codes[value] || Object.keys(catalog).find(key=>key===value || catalog[key]===value);
    const pair=messages.get(value);
    return key ? (language==='en'?catalog[key]:key) : pair ? pair[language==='en'?1:0] : value;
  }
  return {text, capture, start, error, get language() { return language; }};
})();
function cvT(zh, en) { return cvI18n.text(zh, en); }
