# CodeView

[简体中文](./README.md) | **English**

Scan images, generate individual codes, and review serial numbers alongside their original row fields. CodeView runs as a self-contained HTML file with no installation.

[Open online](https://tianqistudio.com/tools/CodeView) · [Alternative URL](https://tianqistudio.com/work/CodeView) · [Source](https://github.com/tianqistudio/codeview)

Previously named SNView. The former online URLs redirect to CodeView.

## Features

- Import Excel, CSV, TXT or TSV, or paste consecutive table columns.
- Detect common SN headers and choose manually when multiple candidates exist.
- Generate Code 128 barcodes, QR codes or text images.
- Preserve original SN text, leading zeros, order, duplicates and surrounding spaces.
- Review fields from the same row. Choose side columns with arrows or header menus, enable separate barcodes, and receive field-change notifications.
- Scan multiple images, including multiple codes per image, and regenerate each detected code as a separate PNG in its original format.
- Switch between Simplified Chinese and English without losing current data or progress. The initial language follows the browser; manual choices are remembered when browser storage is available.
- Follow the system light or dark theme while keeping code images white.
- Process data locally without changing source files. No network connection is required after downloading the HTML.

## Getting started

1. Open the online tool, or download the [single HTML file](./交付/SN连续出码/SN_连续出码工具_v1.4.html) and open it in a modern browser.
2. Choose your interface language from the menu at the top right.
3. Import a file or expand **Paste table** and paste your table.
4. Check the sheet, SN column, header row, first data row and preview; select **Start**.
5. Step through records and compare the side fields. Use the download button to save the current SN as a PNG.

To scan existing codes, select **Scan images** and choose multiple images, or paste or drop images onto that panel. Check the decoded contents and use each result's download button to save it. Duplicate labels are retained separately. Filenames use the decoded text with invalid characters replaced, long names shortened and duplicates numbered; encoded contents stay unchanged.

## Development and testing

Build from the project root with Python 3. Python and Node.js are not required to use the generated HTML.

```sh
python tools/sn-viewer/refine.py
```

The output is `交付/SN连续出码/SN_连续出码工具_v1.4.html`. The preserved baseline is in `source/`; the generator, interface code, translation catalog and bundled scanner are in `tools/sn-viewer/`.

Browser checks require Node.js, Playwright and Google Chrome:

```sh
node tools/sn-viewer/verify-i18n.cjs
node tools/sn-viewer/verify-scanner.cjs
```

## Usage limits

Use a recent browser with WebAssembly and Worker support. Excel import also requires `DecompressionStream` support. Standard unencrypted `.xlsx` and UTF-8 CSV / TXT / TSV are supported; legacy `.xls`, password-protected and macro-enabled workbooks are not.

Table limits are 10 MB, 20,000 source rows, 512 columns and 10,000 serial numbers. Store serial numbers as text in Excel: leading zeros and digits already lost through numeric conversion cannot be recovered. Code 128 B requires 1–80 printable ASCII characters; QR and text images support up to 512 characters.

Image scanning accepts up to 50 MB, 24 megapixels and 255 detected codes per image. Blurred, obscured or very small codes may be missed. Regenerated codes are decoded again and compared with the original bytes; failures are shown rather than offered as verified images. Check the detected count and crop images when needed.

Changing interface language does not translate serial numbers, source headers, row fields or decoded text. Imported data and progress are cleared when the page is refreshed or closed. Moving to the next code does not confirm a successful scan; verify completion in your receiving system before continuing.

## Third-party licenses

Embedded third-party copyright and license notices are retained in the HTML. Image decoding and regeneration use the bundled [ZXing WASM](https://github.com/Sec-ant/zxing-wasm) 3.1.4 engine.

Made by [tianqistudio](https://tianqistudio.com/home).
