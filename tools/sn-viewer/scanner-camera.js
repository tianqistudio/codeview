(() => {
  const el = id => document.getElementById(id);
  const video = el('scanCameraVideo');
  let stream = null, request = 0, opening = false, capturing = false, captureCount = 0;
  let message = '', showFallback = false;

  function showMessage(key, fallback = false) {
    message = key;
    showFallback = fallback;
    el('scanCameraStatus').textContent = key ? cvI18n.error(key) : '';
    el('scanCameraStatus').hidden = !key;
    el('scanCameraFallback').hidden = !fallback;
  }
  function syncButtons() {
    const busy = window.CodeViewScanner.isBusy();
    el('scanCamera').disabled = busy || opening || !!stream;
    el('scanCameraFallback').disabled = busy;
    el('scanCameraDevice').disabled = busy || opening || capturing;
    el('scanCameraCapture').disabled = busy || opening || capturing || !stream || video.readyState < 2 || !video.videoWidth || !video.videoHeight;
  }
  function releaseStream() {
    const previous = stream;
    stream = null;
    video.pause();
    video.srcObject = null;
    if (previous) for (const track of previous.getTracks()) track.stop();
  }
  function close() {
    request++;
    opening = capturing = false;
    releaseStream();
    el('scanCameraPanel').hidden = true;
    el('scanCameraDeviceLabel').hidden = true;
    showMessage('');
    syncButtons();
  }
  function cameraError(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return '相机权限被拒绝，请在浏览器设置中允许相机后重试，或选择照片。';
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return '未找到相机，请连接摄像头后重试，或选择照片。';
    if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return '相机无法使用，请关闭其他占用相机的应用后重试，或选择照片。';
    if (error?.name === 'OverconstrainedError') return '所选相机无法使用，请重新打开相机，或选择照片。';
    return '无法打开相机，请重试或选择照片。';
  }
  async function refreshDevices(token) {
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
      if (token !== request || !stream) return;
      const selected = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
      const select = el('scanCameraDevice');
      select.replaceChildren();
      devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.dataset.fallback = device.label ? '' : String(index + 1);
        option.textContent = device.label || `${cvI18n.error('相机')} ${index + 1}`;
        select.append(option);
      });
      if (selected && devices.some(device => device.deviceId === selected)) select.value = selected;
      el('scanCameraDeviceLabel').hidden = devices.length < 2;
    } catch { /* Preview remains usable when device enumeration is unavailable. */ }
  }
  async function open(deviceId) {
    if (window.CodeViewScanner.isBusy() || opening) return;
    close();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showMessage('此浏览器无法直接调用相机，请通过 HTTPS 打开页面，或选择照片／系统相机。', true);
      return;
    }
    const token = ++request;
    opening = true;
    el('scanCameraPanel').hidden = false;
    showMessage('正在打开相机，请允许浏览器使用相机。');
    syncButtons();
    try {
      const current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 }, height: { ideal: 1080 }
        }
      });
      if (token !== request) {
        for (const track of current.getTracks()) track.stop();
        return;
      }
      stream = current;
      video.srcObject = current;
      for (const track of current.getVideoTracks()) track.addEventListener('ended', () => {
        if (token !== request) return;
        close();
        showMessage('相机已断开，请重新打开相机，或选择照片。', true);
      }, { once: true });
      await video.play();
      if (token !== request) return;
      opening = false;
      showMessage('');
      syncButtons();
      await refreshDevices(token);
    } catch (error) {
      if (token !== request) return;
      close();
      showMessage(cameraError(error), true);
    }
  }
  async function capture() {
    if (el('scanCameraCapture').disabled) return;
    const token = request;
    capturing = true;
    syncButtons();
    const canvas = document.createElement('canvas');
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (token !== request) return;
      if (!blob) throw new Error('CAPTURE_FAILED');
      const file = new File([blob], `camera-${++captureCount}.png`, { type: 'image/png' });
      close();
      await window.CodeViewScanner.run([file]);
    } catch {
      if (token !== request) return;
      showMessage('拍照失败，请重试，或选择照片。', true);
    } finally {
      canvas.width = canvas.height = 0;
      if (token === request) {
        capturing = false;
        syncButtons();
      }
    }
  }
  el('scanCamera').onclick = () => open();
  el('scanCameraClose').onclick = close;
  el('scanCameraCapture').onclick = capture;
  el('scanCameraDevice').onchange = event => open(event.target.value);
  el('scanCameraFallback').onclick = () => el('scanCameraFile').click();
  el('scanCameraFile').onchange = event => {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length || window.CodeViewScanner.isBusy()) return;
    close();
    window.CodeViewScanner.run(files);
  };
  video.addEventListener('loadeddata', syncButtons);
  window.addEventListener('codeview-scan-mode', event => { if (!event.detail) close(); });
  window.addEventListener('codeview-scan-clear', close);
  window.addEventListener('codeview-scan-busy', event => { if (event.detail) close(); else syncButtons(); });
  window.addEventListener('pagehide', close);
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
  window.addEventListener('codeview-language', () => {
    showMessage(message, showFallback);
    for (const option of el('scanCameraDevice').options) {
      if (option.dataset.fallback) option.textContent = `${cvI18n.error('相机')} ${option.dataset.fallback}`;
    }
  });
  window.CodeViewCamera = { close };
  syncButtons();
})();
