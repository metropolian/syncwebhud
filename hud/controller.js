// ==========================================================
// controller.js — Shared Supabase connection + broadcast/listen
// Identical file used by both WEB and HUD
// ==========================================================

const SyncController = (() => {
  // ---- Config ----
  const SUPABASE_URL = 'https://eyizuleglpyniflctajn.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_PzsCTjtoKtoZiVm69ZH_YQ_15QzwVOj';

  let client = null;
  let channel = null;
  let currentPin = null;

  const updateHandlers = [];
  const statusHandlers = [];
  const subscribeHandlers = [];

  function getClient() {
    if (!client) {
      if (typeof supabase === 'undefined') {
        throw new Error('Supabase SDK not loaded. Include @supabase/supabase-js before controller.js');
      }
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  function roomName(pin) {
    return `hud-room-${pin}`;
  }

  // ---- Pin helpers ----
  function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function validatePin(pin) {
    return typeof pin === 'string' && /^\d{6}$/.test(pin.trim());
  }

  // ---- Connection ----
  /**
   * Connect to a room by pin.
   * @param {string} pin - 6-digit link code
   * @param {object} [options]
   * @param {string} [options.presenceKey='client'] - 'web-controller' | 'electron-hud'
   * @returns {Promise<void>}
   */
  async function connect(pin, options = {}) {
    const cleanPin = String(pin).trim();
    if (!validatePin(cleanPin)) {
      throw new Error('Invalid pin. Expected 6 digits.');
    }

    await disconnect();

    currentPin = cleanPin;
    const presenceKey = options.presenceKey || 'client';
    const sb = getClient();

    channel = sb.channel(roomName(cleanPin), {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKey }
      }
    });

    channel.on('broadcast', { event: 'hud-update' }, ({ payload }) => {
      updateHandlers.forEach((fn) => {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    });

    channel.on('broadcast', { event: 'hud-status' }, ({ payload }) => {
      statusHandlers.forEach((fn) => {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    });

    return new Promise((resolve, reject) => {
      channel.subscribe((status) => {
        subscribeHandlers.forEach((fn) => {
          try { fn(status, cleanPin); } catch (e) { console.error(e); }
        });

        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Channel subscribe failed: ${status}`));
        }
      });
    });
  }

  async function disconnect() {
    if (channel && client) {
      await client.removeChannel(channel);
    }
    channel = null;
    currentPin = null;
  }

  function getPin() {
    return currentPin;
  }

  function isConnected() {
    return !!channel && !!currentPin;
  }

  // ---- Listeners ----
  /** payload: { action, data, timestamp } */
  function onUpdate(handler) {
    if (typeof handler === 'function') updateHandlers.push(handler);
    return () => {
      const i = updateHandlers.indexOf(handler);
      if (i >= 0) updateHandlers.splice(i, 1);
    };
  }

  /** payload: e.g. { linked: true } */
  function onStatus(handler) {
    if (typeof handler === 'function') statusHandlers.push(handler);
    return () => {
      const i = statusHandlers.indexOf(handler);
      if (i >= 0) statusHandlers.splice(i, 1);
    };
  }

  /** status: SUBSCRIBED | CHANNEL_ERROR | ... */
  function onSubscribe(handler) {
    if (typeof handler === 'function') subscribeHandlers.push(handler);
    return () => {
      const i = subscribeHandlers.indexOf(handler);
      if (i >= 0) subscribeHandlers.splice(i, 1);
    };
  }

  // ---- Broadcast / send ----
  async function broadcast(actionType, dataPayload) {
    if (!channel) {
      console.warn('SyncController.broadcast: not connected');
      return;
    }
    return channel.send({
      type: 'broadcast',
      event: 'hud-update',
      payload: {
        action: actionType,
        data: dataPayload,
        timestamp: Date.now()
      }
    });
  }

  async function sendStatus(payload) {
    if (!channel) return;
    return channel.send({
      type: 'broadcast',
      event: 'hud-status',
      payload
    });
  }

  function sendText(message, priority = 'normal') {
    return broadcast('UPDATE_TEXT', { message, priority });
  }

  function updateMetric(metricName, value, unit = '%') {
    return broadcast('UPDATE_METRIC', { metricName, value, unit });
  }

  function sendNumbers(a, b) {
    return broadcast('UPDATE_NUMBERS', {
      a: Number(a),
      b: Number(b),
      sum: Number(a) + Number(b)
    });
  }

  function sendCommand(commandName, params = {}) {
    return broadcast('EXECUTE_COMMAND', { commandName, params });
  }

  // Public API
  return {
    generatePin,
    validatePin,
    connect,
    disconnect,
    getPin,
    isConnected,
    onUpdate,
    onStatus,
    onSubscribe,
    broadcast,
    sendStatus,
    sendText,
    updateMetric,
    sendNumbers,
    sendCommand
  };
})();

// Global for browser script tags
if (typeof window !== 'undefined') {
  window.SyncController = SyncController;
}
