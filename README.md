# 码映 · CodeView

**简体中文** | [English](./README.en.md)

识别图片，独立出码；导入清单，逐条核对。无需安装的单文件网页工具，支持批量识别二维码和条形码、生成码图，以及核对 SN 同行字段。

[在线使用](https://tianqistudio.com/tools/CodeView) · [备用入口](https://tianqistudio.com/work/CodeView) · [源码](https://github.com/tianqistudio/codeview)

原「序映 SNView」入口自动跳转到新地址。

<a id="功能"></a>

## 主要功能

- 自动识别常见 SN 表头；多个候选列可手动选择。
- 提供 Code 128 条形码、二维码和纯文字图片。
- 保留 SN 原文、前导零、顺序和重复项，不自动补号。
- 左右字段可通过箭头或表头下拉框选择，支持独立条码和字段变化提醒。
- 简体中文、英文界面；首次跟随浏览器语言，可随时切换并记住选择，切换时保留当前数据与进度。
- 跟随系统浅色、深色主题；条码区域保持白底。
- 导入数据在浏览器本地处理，不回写源表。
- CSV、TXT、TSV 分块导入，显示读取进度，支持取消和重新选择文件。
- 批量导入、拖入或粘贴图片，识别同图中的多个二维码和条形码，按原码制生成独立 PNG；每张图右下角可保存，以码内文本命名。

<a id="使用"></a>

## 安装与使用

1. 在线打开工具，或下载仓库中的 [v1.4.1 单文件 HTML](./交付/SN连续出码/SN_连续出码工具_v1.4.1.html) 后用浏览器打开。
2. 导入 Excel、CSV、TXT、TSV，或粘贴表格内容。
3. 核对工作表、SN 列与数据起始行，点击「开始」。
4. 逐条切换条码，结合左右字段核对；需要时下载当前 SN 的 PNG 图片。

识别图片时，切换到「图片识码」并选择图片（支持多选）。核对识别结果后，点击各码图右下角的保存按钮。相同内容的不同标签分别保留，重名文件追加序号；文件名非法字符会替换，过长文件名会截短，码内内容不变。

<a id="构建"></a>

## 开发与测试

构建需要 Python 3，核心测试需要 Node.js 18 或更新版本。以下命令在项目根目录运行；使用生成的网页不需要 Python 或 Node.js。

```sh
python -B tools/sn-viewer/refine.py --output "交付/SN连续出码/SN_连续出码工具_v1.4.1-candidate.html"
node --test tools/sn-viewer/test-import-core.cjs
python -B tools/sn-viewer/test-build-output.py
```

生成器默认输出独立的 `v1.4.1-candidate.html`，也可用 `--output` 指定构建路径；正式交付文件和 `source/` 基线受保护。`tools/sn-viewer/` 保存生成器、样式、图标和交互代码；修改后重新构建。

浏览器检查需要 Node.js、Playwright 和 Google Chrome：

```sh
node tools/sn-viewer/verify-headers.cjs
node tools/sn-viewer/verify-neighbors.cjs
node tools/sn-viewer/verify-import-browser.cjs
node tools/sn-viewer/verify-i18n.cjs
node tools/sn-viewer/verify-scanner.cjs
```

<a id="注意事项"></a>

## 使用边界

清单上限为 10 MB、20,000 个源行、512 列和 10,000 条 SN。UTF-8 文本支持 BOM、带引号字段和字段内换行；作为 SN 的字段仍须通过原有内容校验。

XLSX 显示工作簿、工作表和预览阶段，取消后忽略旧结果；同步 XML 解析期间需等待当前步骤结束才响应点击。分块读取仍保留完整表格供随机访问。

Excel 中以数值保存的长编号可能已丢失精度，工具无法恢复原始数字。建议源表将 SN 保存为文本。切换页面不代表扫码成功，请确认上一条处理完成后再继续。

图片识码需要支持 WebAssembly 和 Worker 的现代浏览器。单张图片上限 50 MB、2400 万像素，每张最多识别 255 个码；模糊、遮挡、过小的码可能漏识别。生成码图会重新解码核对原始内容，无法正确重建时显示原因。请核对识别数量，必要时裁剪原图重试。

界面支持简体中文和英文；语言菜单位于右上角。SN、源表表头、同行字段和识别文本不随界面语言翻译。语言偏好保存在当前浏览器，文件与粘贴内容不持久化；浏览器禁止本地存储时仍可切换语言。

## 第三方许可

内嵌第三方代码的版权与许可说明保留在 HTML 中。
图片识别与重建使用 [ZXing WASM](https://github.com/Sec-ant/zxing-wasm) 3.1.4，依赖内嵌，可离线运行。

由 [tianqistudio](https://tianqistudio.com/home) 制作。
