// ==========================================================
// Web UI — uses shared SyncController
// ==========================================================

const uniquePin = SyncController.generatePin();
document.getElementById('pinDisplay').textContent = uniquePin;

const statusText = document.getElementById('statusText');

// When HUD announces it is linked
SyncController.onStatus((payload) => {
  if (payload && payload.linked) {
    statusText.textContent = '✅ HUD Linked & Active!';
    statusText.classList.add('connected');
  }
});

SyncController.onSubscribe((status, pin) => {
  if (status === 'SUBSCRIBED') {
    console.log(`Subscribed to room: hud-room-${pin}`);
  }
});

// Connect as web controller
SyncController.connect(uniquePin, { presenceKey: 'web-controller' }).catch((err) => {
  console.error(err);
  statusText.textContent = 'Connection failed';
});

// Backward-compatible alias used by inline scripts
const HudAPI = {
  broadcast: (action, data) => SyncController.broadcast(action, data),
  sendText: (message, priority) => SyncController.sendText(message, priority),
  updateMetric: (name, value, unit) => SyncController.updateMetric(name, value, unit),
  sendNumbers: (a, b) => SyncController.sendNumbers(a, b),
  sendCommand: (name, params) => SyncController.sendCommand(name, params)
};
window.HudAPI = HudAPI;

// Wire UI
document.getElementById('btnSendText').addEventListener('click', () => {
  const text = document.getElementById('hudMessage').value;
  HudAPI.sendText(text, 'normal');
});

document.getElementById('hudMessage').addEventListener('input', (e) => {
  HudAPI.sendText(e.target.value, 'live-typing');
});

document.getElementById('hudMetric').addEventListener('input', (e) => {
  HudAPI.updateMetric('Power Level', Number(e.target.value), '%');
});

document.getElementById('btnAlert').addEventListener('click', () => {
  HudAPI.sendCommand('FLASH_ALERT', { level: 'critical', text: '⚠️ SYSTEM WARNING' });
});

document.getElementById('btnClear').addEventListener('click', () => {
  HudAPI.sendCommand('CLEAR_HUD');
});
