import { BrowserWindow, Menu, nativeImage, screen, Tray } from "electron";
import {
  HIDE_ANIMATION_MS,
  MARGIN_BOTTOM,
  MARGIN_RIGHT,
  PANEL_OFFSET,
  WIN_H,
  WIN_W,
} from "../constants";

let hideTimer: NodeJS.Timeout | null = null;
let settleTimer: NodeJS.Timeout | null = null;
let hasSettledOnce = false;
let lastShow = 0;

export function getTargetPosition() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(x + width - WIN_W - MARGIN_RIGHT),
    y: Math.round(y + height - WIN_H - MARGIN_BOTTOM - PANEL_OFFSET),
  };
}

function placeWindow(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  const { x, y } = getTargetPosition();
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
}

/**
 * Mutter re-centers a window the first time it is shown. Keep re-applying the
 * target position until it sticks, then call onDone.
 */
function settlePosition(win: BrowserWindow, onDone?: () => void) {
  if (settleTimer) clearInterval(settleTimer);

  const MAX_TRIES = 100; // 100 * 10ms = 1s
  const NEEDED_OK = 6; // correct 6 checks in a row (~60ms)
  let tries = 0;
  let okStreak = 0;

  settleTimer = setInterval(() => {
    if (win.isDestroyed()) {
      if (settleTimer) clearInterval(settleTimer);
      return;
    }

    tries++;
    const target = getTargetPosition();
    const b = win.getBounds();

    if (b.x === target.x && b.y === target.y) {
      okStreak++;
    } else {
      okStreak = 0;
      placeWindow(win);
    }

    if (okStreak >= NEEDED_OK || tries >= MAX_TRIES) {
      if (settleTimer) clearInterval(settleTimer);
      hasSettledOnce = true;
      onDone?.();
    }
  }, 10);
}

export function hideWindow(win: BrowserWindow) {
  if (win.isDestroyed() || !win.isVisible() || hideTimer) return;
  win.webContents.send("animate-close");
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (!win.isDestroyed()) win.hide();
  }, HIDE_ANIMATION_MS);
}

export function showWindow(win: BrowserWindow) {
  if (win.isDestroyed()) return;

  // Cancel any pending hide so it can't hide the window right after we show it
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  lastShow = Date.now();
  placeWindow(win);
  win.setAlwaysOnTop(true, "screen-saver");
  win.show();
  win.setSkipTaskbar(true);
  win.focus();

  if (hasSettledOnce) {
    // Mutter remembers the position after the first show: animate right away
    win.webContents.send("animate-open");
    settlePosition(win);
  } else {
    // First show: wait until the position sticks so the jump isn't visible
    settlePosition(win, () => {
      if (!win.isDestroyed()) win.webContents.send("animate-open");
    });
  }
}

export function toggleWindow(win: BrowserWindow) {
  if (win.isVisible()) hideWindow(win);
  else showWindow(win);
}

/** Hide on blur, ignoring the focus bounce that happens right after showing. */
export function handleBlur(win: BrowserWindow) {
  if (Date.now() - lastShow > 250) hideWindow(win);
}

export function createTray(
  iconPath: string,
  onToggle: () => void,
  onQuit: () => void
): Tray {
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon);
  tray.setToolTip("My Custom Electron App");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show / Hide", click: onToggle },
    { type: "separator" },
    { label: "Quit", click: onQuit },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", onToggle);
  return tray;
}