import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

let _posBeforeMinimize = null;

export default function TitleBar({ isFullscreen, onFullscreenChange }) {

  // Restore position after minimize → taskbar restore on Linux
  useEffect(() => {
    const onFocus = async () => {
      if (!_posBeforeMinimize) return;
      try {
        await getCurrentWindow().setPosition(_posBeforeMinimize);
        _posBeforeMinimize = null;
      } catch (_) {}
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Direct startDragging — always fresh, no stale state
  const onTitleBarMouseDown = async (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.title-bar-controls')) return;
    e.preventDefault();
    try { await getCurrentWindow().startDragging(); } catch (_) {}
  };

  const handleClose = async () => {
    try { await getCurrentWindow().close(); } catch (_) {}
  };

  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      _posBeforeMinimize = await win.outerPosition();
      await win.minimize();
    } catch (_) {}
  };

  const handleFullscreen = async () => {
    const win = getCurrentWindow();
    try {
      if (isFullscreen) {
        // OS-managed exit — WM restores size/position, drag stays intact
        await win.setFullscreen(false);
        onFullscreenChange(false);
      } else {
        // OS-managed enter — WM handles resize, drag stays intact
        await win.setFullscreen(true);
        onFullscreenChange(true);
      }
    } catch (e) {
      console.error('[fullscreen]', e);
    }
  };

  return (
    <div className="title-bar" onMouseDown={onTitleBarMouseDown}>
      <div className="title-bar-controls">
        <button id="btn-close"
          className="tb-btn tb-btn-close"
          onClick={handleClose}
          onMouseDown={e => e.stopPropagation()}
          title="Close" data-icon="✕" aria-label="Close"
        />
        <button id="btn-minimize"
          className="tb-btn tb-btn-min"
          onClick={handleMinimize}
          onMouseDown={e => e.stopPropagation()}
          title="Minimize" data-icon="–" aria-label="Minimize"
        />
        <button id="btn-fullscreen"
          className="tb-btn tb-btn-max"
          onClick={handleFullscreen}
          onMouseDown={e => e.stopPropagation()}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          data-icon={isFullscreen ? '⤡' : '⤢'}
          style={{ opacity: 1, cursor: 'pointer' }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        />
      </div>

      <span className="title-bar-title" style={{ pointerEvents: 'none' }}>
        Calculator
      </span>

      <div style={{ width: '52px' }} />
    </div>
  );
}
