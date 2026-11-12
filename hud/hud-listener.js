// ==========================================================
// HUD UI — link screen + data display (uses SyncController)
// ==========================================================

const linkScreen = document.getElementById('linkScreen');
const dataScreen = document.getElementById('dataScreen');
const pinInput = document.getElementById('pinInput');
const btnLink = document.getElementById('btnLink');
const linkError = document.getElementById('linkError');
const linkStatus = document.getElementById('linkStatus');
const linkStatusText = document.getElementById('linkStatusText');
const btnChangePin = document.getElementById('btnChangePin');
const messageBox = document.getElementById('messageBox');
const valA = document.getElementById('valA');
const valB = document.getElementById('valB');
const valSum = document.getElementById('valSum');
const valMetric = document.getElementById('valMetric');
const metricName = document.getElementById('metricName');
const hudEl = document.getElementById('hud');

let currentPin = null;

// Incoming data from web
SyncController.onUpdate(handleUpdate);

SyncController.onSubscribe((status, pin) => {
  if (status === 'SUBSCRIBED') {
    linkStatusText.textContent = `Linked · ${pin}`;
    linkStatus.classList.add('linked');
    // Tell website we are online
    SyncController.sendStatus({ linked: true });
  }
});

// ========== LINK SCREEN ==========

function showLinkScreen() {
  linkScreen.classList.remove('hidden');
  dataScreen.classList.remove('active');
  pinInput.value = currentPin || '';
  pinInput.focus();
  linkError.textContent = '';

  if (window.HudWindow) {
    HudWindow.setLinked(false);
    HudWindow.onReady(false);
  }
}

function showDataScreen() {
  linkScreen.classList.add('hidden');
  dataScreen.classList.add('active');
}

async function linkWithPin(pin) {
  linkStatusText.textContent = `Connecting · ${pin}...`;
  linkStatus.classList.remove('linked');

  await SyncController.connect(pin, { presenceKey: 'electron-hud' });
  currentPin = pin;
  localStorage.setItem('hud_link_pin', pin);
  showDataScreen();

  if (window.HudWindow) {
    HudWindow.setLinked(true);
  }
}

btnLink.addEventListener('click', async () => {
  const pin = pinInput.value.trim();

  if (!SyncController.validatePin(pin)) {
    linkError.textContent = 'Please enter a valid 6-digit code';
    return;
  }

  linkError.textContent = '';
  try {
    await linkWithPin(pin);
  } catch (err) {
    console.error(err);
    linkError.textContent = 'Failed to connect. Try again.';
  }
});

pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLink.click();
});

pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
});

btnChangePin.addEventListener('click', async () => {
  await SyncController.disconnect();
  currentPin = null;
  localStorage.removeItem('hud_link_pin');
  resetDataDisplay();
  showLinkScreen();
});

function resetDataDisplay() {
  valA.textContent = '—';
  valB.textContent = '—';
  valSum.textContent = '—';
  valMetric.textContent = '—';
  metricName.textContent = 'Metric';
  messageBox.textContent = 'Waiting for data from website...';
}

// ========== HANDLE DATA ==========

function handleUpdate({ action, data }) {
  console.log('HUD received:', action, data);

  switch (action) {
    case 'UPDATE_NUMBERS':
      valA.textContent = data.a ?? '—';
      valB.textContent = data.b ?? '—';
      valSum.textContent = data.sum ?? '—';
      messageBox.textContent = `Numbers: ${data.a} + ${data.b} = ${data.sum}`;
      break;

    case 'UPDATE_TEXT':
      messageBox.textContent = data.message || '';
      break;

    case 'UPDATE_METRIC':
      metricName.textContent = data.metricName || 'Metric';
      valMetric.textContent = `${data.value}${data.unit || ''}`;
      messageBox.textContent = `${data.metricName}: ${data.value}${data.unit || ''}`;
      break;

    case 'EXECUTE_COMMAND':
      if (data.commandName === 'FLASH_ALERT') {
        messageBox.textContent = data.params?.text || '⚠️ ALERT';
        hudEl.classList.add('alert');
        setTimeout(() => hudEl.classList.remove('alert'), 600);
      }
      if (data.commandName === 'CLEAR_HUD') {
        resetDataDisplay();
        messageBox.textContent = 'HUD cleared';
      }
      break;

    default:
      messageBox.textContent = JSON.stringify(data);
  }
}

// ========== BOOT ==========

const savedPin = localStorage.getItem('hud_link_pin');

if (savedPin && SyncController.validatePin(savedPin)) {
  pinInput.value = savedPin;
  linkWithPin(savedPin)
    .then(() => {
      if (window.HudWindow) HudWindow.onReady(true);
    })
    .catch((err) => {
      console.error(err);
      showLinkScreen();
    });
} else {
  showLinkScreen();
}
