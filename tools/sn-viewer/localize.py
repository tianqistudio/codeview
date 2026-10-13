"""Apply reviewed UI translations; never translate table data or barcode payloads."""
import json
import re
from pathlib import Path


def localize(html):
    root = Path(__file__).parent
    catalog = json.loads((root / 'locales.json').read_text(encoding='utf-8'))
    # Exact source expressions keep interpolated user values outside translation.
    expressions = catalog['expressions']
    pattern = re.compile('|'.join(re.escape(s) for s in sorted(expressions, key=len, reverse=True)))

    def script(match):
        attrs, body = match.group(1), match.group(2)
        if 'text/plain' in attrs:
            return match.group(0)
        aliases = []
        def preserve(m):
            aliases.append(m[0])
            return f'/* HEADER_ALIASES_{len(aliases)-1} */'
        body = re.sub(r'const (?:SN_HEADERS|OTHER_HEADERS)=new Set\(.*?\);', preserve, body)
        body = pattern.sub(lambda m: 'cvT(()=>' + m[0] + ',()=>'+ expressions[m[0]] + ')', body)
        for i, alias in enumerate(aliases):
            body = body.replace(f'/* HEADER_ALIASES_{i} */', alias)
        return '<script' + attrs + '>' + body + '</script>'

    html = re.sub(r'<script([^>]*)>(.*?)</script>', script, html, flags=re.S)
    runtime = (root / 'i18n.js').read_text(encoding='utf-8')
    runtime = runtime.replace('/* CATALOG */', json.dumps(catalog['static'], ensure_ascii=False).replace('</', '<\\/'))
    html = html.replace('</head>', '<script>' + runtime + '</script></head>', 1)
    html = html.replace('<div class="top-actions">', '<div class="top-actions"><select id="language" aria-label="Language / 语言"><option value="zh-CN">简体中文</option><option value="en">English</option></select>', 1)
    # Capture static nodes before application scripts populate any user data.
    html = html.replace('<script>\n', '<script>cvI18n.capture();</script><script>\n', 1)
    html = html.replace('</body>', '<script>cvI18n.start();</script></body>')
    return html
