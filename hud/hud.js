// ==========================================================
// HUD window management (renderer side)
// ==========================================================

const HudWindow = {
  el: null,
  isLinked: false,
  autoHideTimer: null,

  init() {
    this.el = document.getElementById('hud');

    if (window.electronAPI) {
      window.electronAPI.onHudShow(() => this.setVisible(true));
      window.electronAPI.onHudHide(() => this.setVisible(false));
    }

    // ESC hides HUD only after it is linked
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isLinked) {
        e.preventDefault();
        this.requestHide();
      }
    });
  },

  setVisible(visible) {
    if (!this.el) return;
    if (visible) {
      this.el.classList.add('visible');
    } else {
      this.el.classList.remove('visible');
    }
  },

  requestHide() {
    if (window.electronAPI) {
      window.electronAPI.hideHud();
    }
  },

  requestShow() {
    if (window.electronAPI) {
      window.electronAPI.showHud();
    }
  },

  /**
   * Called after link state is known on startup.
   * - Not linked: keep HUD open until user enters code
   * - Linked: show briefly then auto-hide after 3 seconds
   */
  onReady(linked) {
    this.isLinked = linked;
    this.clearAutoHide();

    if (!linked) {
      this.requestShow();
      return;
    }

    this.requestShow();
    this.autoHideTimer = setTimeout(() => {
      this.requestHide();
      this.autoHideTimer = null;
    }, 3000);
  },

  setLinked(linked) {
    this.isLinked = linked;
    if (linked) {
      this.clearAutoHide();
    }
  },

  clearAutoHide() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }
};

// Expose globally for hud-listener.js
window.HudWindow = HudWindow;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => HudWindow.init());
} else {
  HudWindow.init();
}
