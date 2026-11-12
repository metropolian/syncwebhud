# IronNest HUD

Cross-device heads-up display controlled by a static website over the internet.

- **Web** (`web/`) — static controller UI; generates a 6-digit Link Code and broadcasts data
- **HUD** (`hud/`) — Electron pulldown overlay; links with the code and displays live data
- **Sync** — shared `controller.js` (`SyncController`) used identically on both sides via Supabase Realtime broadcast

---

## Project structure

```
ironnesthud/
├── README.md
├── web/
│   ├── index.html          # Controller UI
│   ├── style.css
│   ├── controller.js       # SyncController (identical to hud/controller.js)
│   └── app.js              # Web UI wiring
└── hud/
    ├── package.json
    ├── main.js             # Electron main: window, tray, hotkey, IPC
    ├── preload.js          # contextBridge → electronAPI
    ├── hud.html
    ├── style.css
    ├── controller.js       # SyncController (keep identical to web/)
    ├── hud.js              # Renderer window manager (show/hide, ESC, startup)
    ├── hud-listener.js     # Link UI + data display
    └── icon.png            # Tray icon
```

**Important:** `web/controller.js` and `hud/controller.js` must stay **identical**. Edit one, copy to the other.

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Put **Project URL** and **anon key** into both `controller.js` files:

```js
const SUPABASE_URL = https://YOUR_PROJECT.supabase.co;
const SUPABASE_ANON_KEY = YOUR_ANON_KEY;
```

Realtime broadcast does not require a database table.

### 2. Web controller

Open `web/index.html` in a browser (or host the `web/` folder).

### 3. Electron HUD

```bash
cd hud
npm install
npm start
```

### 4. Link flow

1. Website shows a **6-digit Link Code**
2. HUD asks for that code (or loads the last saved code)
3. Both join Supabase channel `hud-room-{pin}`
4. Web sends updates; HUD renders them

---

## Runtime behavior

| Action | Behavior |
|--------|----------|
| Hotkey **F7** | Toggle HUD |
| Tray click | Toggle HUD |
| **ESC** (when linked) | Hide HUD |
| First run (no pin) | HUD stays open until user enters Link Code |
| Pin already saved | HUD shows ~3 seconds, then auto-hides |
| Change pin | Disconnects, clears storage, shows link screen |

---

## SyncController API

Global: `window.SyncController` (after loading `controller.js`).

Requires Supabase JS SDK loaded first:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="controller.js"></script>
```

### Pin helpers

```js
SyncController.generatePin()     // "100000"–"999999"
SyncController.validatePin(pin)  // true if exactly 6 digits
```

### Connection

```js
// Join room
await SyncController.connect(pin, {
  presenceKey: web-controller // or electron-hud
});

await SyncController.disconnect();

SyncController.getPin()       // current pin or null
SyncController.isConnected()  // boolean
```

Room name: `hud-room-{pin}`.

### Listeners

Each returns an **unsubscribe** function.

```js
// Data messages from the other side
// payload: { action, data, timestamp }
const offUpdate = SyncController.onUpdate((payload) => {
  const { action, data } = payload;
  // handle action
});

// Status / handshake
// payload: e.g. { linked: true }
const offStatus = SyncController.onStatus((payload) => { /* ... */ });

// Channel subscribe lifecycle
// status: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | ...
const offSub = SyncController.onSubscribe((status, pin) => { /* ... */ });

offUpdate(); // remove handler
```

### Broadcast / send

```js
// Low-level
await SyncController.broadcast(actionType, dataPayload);
// → event "hud-update", payload { action, data, timestamp }

// Handshake (HUD → web)
await SyncController.sendStatus({ linked: true });
// → event "hud-status"

// High-level helpers
await SyncController.sendText(message, priority = normal);
// action: UPDATE_TEXT, data: { message, priority }

await SyncController.updateMetric(metricName, value, unit = %);
// action: UPDATE_METRIC, data: { metricName, value, unit }

await SyncController.sendNumbers(a, b);
// action: UPDATE_NUMBERS, data: { a, b, sum }

await SyncController.sendCommand(commandName, params = {});
// action: EXECUTE_COMMAND, data: { commandName, params }
```

### Message protocol

| `action` | Typical `data` | Used for |
|----------|----------------|----------|
| `UPDATE_TEXT` | `{ message, priority }` | Notifications / live typing |
| `UPDATE_METRIC` | `{ metricName, value, unit }` | Sliders / gauges |
| `UPDATE_NUMBERS` | `{ a, b, sum }` | Two-number demo |
| `EXECUTE_COMMAND` | `{ commandName, params }` | Alerts, clear, custom cmds |

Built-in commands on HUD:

| `commandName` | Effect |
|---------------|--------|
| `FLASH_ALERT` | Flash HUD + show `params.text` |
| `CLEAR_HUD` | Reset displayed values |

### Extending protocol

**Sender (web):**

```js
SyncController.broadcast(UPDATE_SCORE, { team: A, score: 12 });
// or add a helper inside controller.js and copy to both sides
```

**Receiver (HUD):** in `hud-listener.js` → `handleUpdate`:

```js
case UPDATE_SCORE:
  // update DOM
  break;
```

---

## Web side (`web/app.js`)

- Generates pin → shows in UI
- `connect(pin, { presenceKey: web-controller })`
- `onStatus` → shows “HUD Linked”
- Exposes thin alias `HudAPI` (same send methods) for inline HTML handlers

```js
HudAPI.sendNumbers(a, b);
HudAPI.sendText(msg);
HudAPI.updateMetric(name, value, unit);
HudAPI.sendCommand(name, params);
```

---

## HUD Electron main (`hud/main.js`)

| Function | Role |
|----------|------|
| `createHUD()` | Frameless always-on-top window, full primary width, height 320 |
| `showHUD()` | Position y=0, show, focus, IPC `hud-show` |
| `hideHUD()` | IPC `hud-hide`, then move off-screen and hide |
| `toggleHUD()` | Show ↔ hide |
| `createTray()` | Tray from `icon.png`, menu Toggle / Quit |

IPC (renderer → main):

| Channel | Effect |
|---------|--------|
| `show-hud` | `showHUD()` |
| `hide-hud` | `hideHUD()` |
| `toggle-hud` | `toggleHUD()` |

Main → renderer:

| Channel | Effect |
|---------|--------|
| `hud-show` | Add `.visible` animation class |
| `hud-hide` | Remove `.visible` |

Global shortcut: **F7** (change in `main.js`).

---

## HUD preload (`hud/preload.js`)

```js
window.electronAPI = {
  onHudShow(cb),
  onHudHide(cb),
  showHud(),
  hideHud(),
  toggleHud()
}
```

---

## HUD window manager (`hud/hud.js` → `HudWindow`)

| Method | Role |
|--------|------|
| `init()` | Bind IPC show/hide + ESC |
| `setVisible(bool)` | Toggle CSS `.visible` |
| `requestShow()` / `requestHide()` | IPC to main |
| `onReady(linked)` | Startup: keep open if not linked; else show 3s then hide |
| `setLinked(bool)` | Enables ESC hide when linked |
| `clearAutoHide()` | Cancel 3s timer |

ESC hides only when `isLinked === true`.

---

## HUD listener (`hud/hud-listener.js`)

- Link screen validation + `SyncController.connect`
- Saves pin in `localStorage` key `hud_link_pin`
- `onUpdate` → `handleUpdate` switches on `action`
- On `SUBSCRIBED` → `sendStatus({ linked: true })`
- Boot: restore pin or show link screen + `HudWindow.onReady(...)`

---

## Development checklist

1. Change Supabase keys in **both** `controller.js` files (or edit one and copy).
2. Add new message types via `broadcast` + matching `handleUpdate` case.
3. Prefer new helpers on `SyncController` for shared send logic.
4. Keep presence keys distinct: `web-controller` vs `electron-hud`.
5. Test link: open web → note pin → enter on HUD → send numbers/text.
6. Test startup: clear `localStorage.hud_link_pin` → HUD should stay open for linking.
7. Test ESC and F7 after linked.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| No messages | Same pin on both sides; Supabase URL/key; browser console / Electron DevTools |
| Subscribe fails | Network; Realtime enabled on project; valid anon key |
| Tray icon missing | `hud/icon.png` present (16×16 or 32×32 PNG) |
| ESC does nothing | Must be linked first |
| Hotkey fails | Another app owns F7; change accelerator in `main.js` |
| `SyncController is not defined` | Load order: supabase-js → controller.js → app / hud-listener |

---

## License

Private / project use unless stated otherwise.
