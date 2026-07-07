import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Delete, Clock, Grid, ChevronLeft, ChevronRight } from 'lucide-react';
import Display from './components/Display';
import Button from './components/Button';
import TitleBar from './components/TitleBar';

// Increased height for 6 rows
const CARD_BASE_HEIGHT = 650;
const CARD_BASE_WIDTH = 340;

function getFullscreenScale() {
  const scaleByH = (window.innerHeight * 0.94) / CARD_BASE_HEIGHT;
  const scaleByW = (window.innerWidth  * 0.50) / CARD_BASE_WIDTH;
  return Math.min(scaleByH, scaleByW, 3.0);
}

export default function App() {
  const mfRef = useRef(null);
  
  const [history, setHistory] = useState('');
  const [shouldReset, setShouldReset] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cardScale, setCardScale] = useState(1);
  const [calcHistory, setCalcHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isProMode, setIsProMode] = useState(false);
  const [ansValue, setAnsValue] = useState('0');

  useEffect(() => {
    if (!isFullscreen) { setCardScale(1); return; }
    const update = () => setCardScale(getFullscreenScale());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isFullscreen]);

  const mfInsert = useCallback((cmd, isCommand = false) => {
    if (!mfRef.current) return;
    if (isError || shouldReset) {
      mfRef.current.value = '';
      setIsError(false);
      setShouldReset(false);
    }
    
    if (shouldReset && ['+', '-', '*', '/', '^', '%'].includes(cmd)) {
        mfRef.current.value = ansValue;
    }

    if (isCommand) {
      mfRef.current.executeCommand(cmd);
    } else {
      mfRef.current.insert(cmd);
    }
    mfRef.current.focus();
    setShouldReset(false);
  }, [isError, shouldReset, ansValue]);

  const handleEquals = useCallback(async () => {
    if (!mfRef.current || isError) return;
    
    let asciiExpr = mfRef.current.getValue('ascii-math');
    if (!asciiExpr || !asciiExpr.trim()) return;
    
    const latexStr = mfRef.current.value; 

    setIsLoading(true);
    
    asciiExpr = asciiExpr
      .replace(/Ans/g, `(${ansValue})`)
      .replace(/⋅/g, '*') 
      .replace(/×/g, '*')
      .replace(/∗/g, '*') 
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/arcsin/g, 'asin')
      .replace(/arccos/g, 'acos')
      .replace(/arctan/g, 'atan')
      .replace(/abs/g, 'abs') // Mathlive may output abs(x)
      .replace(/root\(3\)/g, 'cbrt'); // MathLive cbrt output
      
    const historyStr = `$${latexStr}$ =`;

    try {
      const result = await invoke('evaluate_expr', { expr: asciiExpr });
      
      mfRef.current.value = result; 
      setAnsValue(result);
      setHistory(historyStr); 
      setIsError(false);

      setCalcHistory(prev => {
        const entry = { expr: latexStr, result };
        return [entry, ...prev].slice(0, 10);
      });
    } catch (err) {
      mfRef.current.value = typeof err === 'string' ? err : 'Error';
      setHistory(historyStr);
      setIsError(true);
    } finally {
      setIsLoading(false);
      setShouldReset(true);
    }
  }, [isError, ansValue]);

  const handleClear = useCallback(() => {
    if (mfRef.current) mfRef.current.value = '';
    setHistory('');
    setShouldReset(false);
    setIsError(false);
  }, []);

  const handleBackspace = useCallback(() => {
    if (isError || shouldReset) { handleClear(); return; }
    if (mfRef.current) mfRef.current.executeCommand('deleteBackward');
  }, [isError, shouldReset, handleClear]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); handleEquals(); }
      else if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleEquals, handleClear]);

  const acLabel = isError || (mfRef.current && mfRef.current.value.length > 0) ? 'C' : 'AC';

  const buttons = [
    // Row 1 (New Navigation & Top Controls)
    { id: 'btn-left',     label: <ChevronLeft size={20} />,  variant: 'special', action: () => mfInsert('moveToPreviousChar', true), ariaLabel: 'Move Left' },
    { id: 'btn-right',    label: <ChevronRight size={20} />, variant: 'special', action: () => mfInsert('moveToNextChar', true), ariaLabel: 'Move Right' },
    { id: 'btn-lparen',   label: '(',     variant: 'special',   action: () => mfInsert('(') },
    { id: 'btn-ac',       label: acLabel, variant: 'special',   action: handleClear },
    // Row 2
    { id: 'btn-rparen',   label: ')',     variant: 'special',   action: () => mfInsert(')') }, 
    { id: 'btn-sign',     label: '+/−',   variant: 'special',   action: () => mfInsert('-') },
    { id: 'btn-percent',  label: '%',     variant: 'special',   action: () => mfInsert('\\%') },
    { id: 'btn-divide',   label: '÷',     variant: 'operator',  action: () => mfInsert('/') },
    // Row 3
    { id: 'btn-7',        label: '7',     variant: 'number',    action: () => mfInsert('7') },
    { id: 'btn-8',        label: '8',     variant: 'number',    action: () => mfInsert('8') },
    { id: 'btn-9',        label: '9',     variant: 'number',    action: () => mfInsert('9') },
    { id: 'btn-multiply', label: '×',     variant: 'operator',  action: () => mfInsert('*') },
    // Row 4
    { id: 'btn-4',        label: '4',     variant: 'number',    action: () => mfInsert('4') },
    { id: 'btn-5',        label: '5',     variant: 'number',    action: () => mfInsert('5') },
    { id: 'btn-6',        label: '6',     variant: 'number',    action: () => mfInsert('6') },
    { id: 'btn-subtract', label: '−',     variant: 'operator',  action: () => mfInsert('-') },
    // Row 5
    { id: 'btn-1',        label: '1',     variant: 'number',    action: () => mfInsert('1') },
    { id: 'btn-2',        label: '2',     variant: 'number',    action: () => mfInsert('2') },
    { id: 'btn-3',        label: '3',     variant: 'number',    action: () => mfInsert('3') },
    { id: 'btn-add',      label: '+',     variant: 'operator',  action: () => mfInsert('+') },
    // Row 6
    { id: 'btn-0',        label: '0',     variant: 'number',    action: () => mfInsert('0') },
    { id: 'btn-dot',      label: '.',     variant: 'number',    action: () => mfInsert('.') },
    { id: 'btn-back',     label: <Delete size={18} />, variant: 'backspace', action: handleBackspace, ariaLabel: 'Backspace' },
    { id: 'btn-equals',   label: '=',     variant: 'equals',    action: handleEquals },
  ];

  const scientificButtons = [
    // Row 1
    { id: 'btn-sq',   label: 'x²',  variant: 'special', action: () => mfInsert('^2') },
    { id: 'btn-cube', label: 'x³',  variant: 'special', action: () => mfInsert('^3') },
    { id: 'btn-pow',  label: 'xʸ',  variant: 'operator',action: () => mfInsert('^{}') },
    { id: 'btn-sqrt', label: '√x',  variant: 'special', action: () => mfInsert('\\sqrt{}') },
    // Row 2
    { id: 'btn-sin',  label: 'sin', variant: 'special', action: () => mfInsert('\\sin') },
    { id: 'btn-cos',  label: 'cos', variant: 'special', action: () => mfInsert('\\cos') },
    { id: 'btn-tan',  label: 'tan', variant: 'special', action: () => mfInsert('\\tan') },
    { id: 'btn-pi',   label: 'π',   variant: 'number',  action: () => mfInsert('\\pi') },
    // Row 3
    { id: 'btn-log',  label: 'log', variant: 'special', action: () => mfInsert('\\log') },
    { id: 'btn-ln',   label: 'ln',  variant: 'special', action: () => mfInsert('\\ln') },
    { id: 'btn-inv',  label: '1/x', variant: 'special', action: () => mfInsert('\\frac{1}{#0}') },
    { id: 'btn-e',    label: 'e',   variant: 'number',  action: () => mfInsert('e') },
    // Row 4
    { id: 'btn-ex',   label: 'eˣ',  variant: 'special', action: () => mfInsert('e^{}') },
    { id: 'btn-10x',  label: '10ˣ', variant: 'special', action: () => mfInsert('10^{}') },
    { id: 'btn-exp',  label: 'EXP', variant: 'special', action: () => mfInsert('\\times 10^{}') },
    { id: 'btn-fact', label: 'x!',  variant: 'special', action: () => mfInsert('!') },
    // Row 5
    { id: 'btn-frac', label: 'x/y',  variant: 'special', action: () => mfInsert('\\frac{#0}{#?}') },
    { id: 'btn-ans',  label: 'Ans',  variant: 'special', action: () => mfInsert('Ans') },
    { id: 'btn-abs',  label: '|x|', variant: 'special', action: () => mfInsert('|#0|') },
    { id: 'btn-mod',  label: 'mod', variant: 'operator',action: () => mfInsert('\\pmod{}') },
    // Row 6
    { id: 'btn-asin', label: 'sin⁻¹',variant: 'special',action: () => mfInsert('\\arcsin') },
    { id: 'btn-acos', label: 'cos⁻¹',variant: 'special',action: () => mfInsert('\\arccos') },
    { id: 'btn-atan', label: 'tan⁻¹',variant: 'special',action: () => mfInsert('\\arctan') },
    { id: 'btn-cbrt', label: '³√x', variant: 'special', action: () => mfInsert('\\sqrt[3]{#0}') },
  ];

  const handleTogglePro = async () => {
    const nextMode = !isProMode;
    setIsProMode(nextMode);
    try {
      const win = getCurrentWindow();
      const newWidth = nextMode ? 680 : 350;
      if (!isFullscreen) {
         import('@tauri-apps/api/dpi').then(({ LogicalSize }) => {
            win.setSize(new LogicalSize(newWidth, CARD_BASE_HEIGHT)).catch(()=>{});
         });
      }
    } catch(e) {}
  };

  return (
    <div className={`app-root ${isFullscreen ? 'app-root--fullscreen' : ''}`}>
      <div
        className={`calc-card ${isProMode ? 'pro-mode' : ''}`}
        role="main"
        aria-label="Calculator"
        style={{
          zoom: cardScale,
          transition: isFullscreen ? 'none' : 'width 0.35s cubic-bezier(0.34, 1.15, 0.64, 1), zoom 0.3s ease',
        }}
      >
        <TitleBar isFullscreen={isFullscreen} onFullscreenChange={setIsFullscreen} />

        <div className="display">
          <div className="display-header" style={{ gap: '8px', justifyContent: 'flex-end' }}>
            <button
              className={`history-toggle-btn ${isProMode ? 'active' : ''}`}
              onClick={handleTogglePro}
              title="Toggle Scientific Mode"
            >
              <Grid size={11} />
              Pro
            </button>
            <button
              className={`history-toggle-btn ${showHistory ? 'active' : ''}`}
              onClick={() => setShowHistory(v => !v)}
              title="Calculation history"
            >
              <Clock size={11} />
              History
            </button>
          </div>
          <Display
            ref={mfRef}
            history={history}
            isError={isError}
            isLoading={isLoading}
          />
        </div>

        <div className="btn-container" role="group" aria-label="Calculator buttons">
          <div className="scientific-pad">
            {scientificButtons.map((btn) => (
              <Button
                key={btn.id}
                id={btn.id}
                label={btn.label}
                variant={btn.variant}
                onClick={btn.action}
                isWide={btn.isWide}
                ariaLabel={btn.ariaLabel}
              />
            ))}
          </div>

          <div className="standard-pad">
            {buttons.map((btn) => (
              <Button
                key={btn.id}
                id={btn.id}
                label={btn.label}
                variant={btn.variant}
                onClick={btn.action}
                isWide={btn.isWide}
                ariaLabel={btn.ariaLabel}
              />
            ))}
          </div>
        </div>

        <div className={`history-panel ${showHistory ? 'open' : ''}`}>
          <div className="history-panel-header">
            <span className="history-panel-title">History</span>
            {calcHistory.length > 0 && (
              <button
                className="history-clear-btn"
                onClick={() => setCalcHistory([])}
              >
                Clear all
              </button>
            )}
          </div>
          <div className="history-list">
            {calcHistory.length === 0 ? (
              <div className="history-empty">No calculations yet</div>
            ) : (
              calcHistory.map((entry, i) => (
                <div
                  key={i}
                  className="history-entry"
                  onClick={() => {
                    if (mfRef.current) mfRef.current.value = entry.result;
                    setShouldReset(true);
                    setShowHistory(false);
                  }}
                  title="Tap to use this result"
                >
                  <span className="history-entry-expr">
                     <math-field read-only style={{background: 'transparent', color: 'inherit', border: 'none', padding: 0, outline: 'none', width: 'auto'}}>{entry.expr}</math-field>
                  </span>
                  <span className="history-entry-result">{entry.result}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
