import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Delete } from 'lucide-react';
import Display from './Display';
import Button from './Button';

const MAX_DIGITS = 16;

/**
 * Main Calculator component
 * Handles all calculator state and communicates with Rust backend via Tauri invoke.
 *
 * State:
 *   current     — The number currently visible on the display (string)
 *   previous    — The first operand stored before an operator is pressed (string)
 *   operator    — The selected operator: '+' | '-' | '*' | '/' | null
 *   history     — The small history text shown above the display
 *   shouldReset — Whether the next digit press should clear current (after operator press)
 *   isError     — Whether an error is being displayed
 *   isLoading   — Whether Rust is processing the calculation
 */
export default function Calculator() {
  const [current, setCurrent] = useState('0');
  const [previous, setPrevious] = useState(null);
  const [operator, setOperator] = useState(null);
  const [history, setHistory] = useState('');
  const [shouldReset, setShouldReset] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ─── Digit / Decimal press ─────────────────────────────────────
  const handleDigit = useCallback((digit) => {
    if (isError) {
      setCurrent(digit === '.' ? '0.' : digit);
      setIsError(false);
      setShouldReset(false);
      return;
    }

    setCurrent(prev => {
      const base = shouldReset ? '' : prev;
      // Reset flag will be cleared below
      if (digit === '.') {
        // Only one decimal allowed
        if (base.includes('.')) return base;
        return (base === '' || base === '0' ? '0' : base) + '.';
      }
      // Prevent leading zeros (except for "0.")
      if (base === '0' && digit !== '.') return digit;
      // Limit digit count
      const digits = base.replace('-', '').replace('.', '');
      if (digits.length >= MAX_DIGITS) return base;
      return base + digit;
    });

    if (shouldReset) setShouldReset(false);
  }, [shouldReset, isError]);

  // ─── Operator press ────────────────────────────────────────────
  const handleOperator = useCallback(async (op) => {
    if (isError) return;

    // If previous and current and operator exist → chain calculation
    if (previous !== null && operator && !shouldReset) {
      await performCalculation(previous, operator, current, op);
    } else {
      setOperator(op);
      setPrevious(current);
      setShouldReset(true);

      const displayOp = formatOpSymbol(op);
      setHistory(`${current} ${displayOp}`);
    }
  }, [current, previous, operator, shouldReset, isError]);

  // ─── Equals press ─────────────────────────────────────────────
  const handleEquals = useCallback(async () => {
    if (isError || operator === null || previous === null) return;
    await performCalculation(previous, operator, current, null);
  }, [current, previous, operator, isError]);

  // ─── Core calculation → Rust invoke ───────────────────────────
  const performCalculation = async (a, op, b, nextOp) => {
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);

    if (isNaN(aNum) || isNaN(bNum)) return;

    setIsLoading(true);

    const displayOp = formatOpSymbol(op);
    const historyStr = `${a} ${displayOp} ${b} =`;

    try {
      // ★ This is where Rust does the heavy lifting ★
      const result = await invoke('calculate', {
        a: aNum,
        operator: op,
        b: bNum,
      });

      setCurrent(result);
      setHistory(historyStr);
      setIsError(false);

      if (nextOp) {
        // Chain: result becomes previous for next operation
        setPrevious(result);
        setOperator(nextOp);
        setHistory(`${result} ${formatOpSymbol(nextOp)}`);
      } else {
        setPrevious(null);
        setOperator(null);
      }
    } catch (err) {
      // Rust returned an Err(String)
      setCurrent(err || 'Error');
      setHistory(historyStr);
      setIsError(true);
      setPrevious(null);
      setOperator(null);
    } finally {
      setIsLoading(false);
      setShouldReset(true);
    }
  };

  // ─── AC (All Clear) ───────────────────────────────────────────
  const handleClear = useCallback(() => {
    setCurrent('0');
    setPrevious(null);
    setOperator(null);
    setHistory('');
    setShouldReset(false);
    setIsError(false);
  }, []);

  // ─── Backspace ────────────────────────────────────────────────
  const handleBackspace = useCallback(() => {
    if (isError || shouldReset) {
      handleClear();
      return;
    }
    setCurrent(prev => {
      if (prev.length <= 1 || prev === '-0') return '0';
      const next = prev.slice(0, -1);
      return next === '-' ? '0' : next;
    });
  }, [isError, shouldReset, handleClear]);

  // ─── Toggle +/- ───────────────────────────────────────────────
  const handleToggleSign = useCallback(() => {
    if (isError) return;
    setCurrent(prev => {
      const num = parseFloat(prev);
      if (isNaN(num) || num === 0) return prev;
      return String(-num);
    });
  }, [isError]);

  // ─── Percentage ───────────────────────────────────────────────
  const handlePercent = useCallback(() => {
    if (isError) return;
    setCurrent(prev => {
      const num = parseFloat(prev);
      if (isNaN(num)) return prev;
      const result = num / 100;
      // Format: remove trailing zeros
      return String(parseFloat(result.toPrecision(10)));
    });
  }, [isError]);

  // ─── Keyboard support ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === '.') handleDigit('.');
      else if (e.key === '+') handleOperator('+');
      else if (e.key === '-') handleOperator('-');
      else if (e.key === '*') handleOperator('*');
      else if (e.key === '/') { e.preventDefault(); handleOperator('/'); }
      else if (e.key === 'Enter' || e.key === '=') handleEquals();
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') handleClear();
      else if (e.key === '%') handlePercent();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent]);

  // ─── Button layout definition ─────────────────────────────────
  const buttons = [
    // Row 1
    { id: 'btn-ac',       label: isError ? 'AC' : (current !== '0' || previous ? 'C' : 'AC'), variant: 'special',   action: handleClear },
    { id: 'btn-sign',     label: '+/-',    variant: 'special',   action: handleToggleSign },
    { id: 'btn-percent',  label: '%',      variant: 'special',   action: handlePercent },
    { id: 'btn-divide',   label: '÷',      variant: 'operator',  action: () => handleOperator('/') },
    // Row 2
    { id: 'btn-7',        label: '7',      variant: 'number',    action: () => handleDigit('7') },
    { id: 'btn-8',        label: '8',      variant: 'number',    action: () => handleDigit('8') },
    { id: 'btn-9',        label: '9',      variant: 'number',    action: () => handleDigit('9') },
    { id: 'btn-multiply', label: '×',      variant: 'operator',  action: () => handleOperator('*') },
    // Row 3
    { id: 'btn-4',        label: '4',      variant: 'number',    action: () => handleDigit('4') },
    { id: 'btn-5',        label: '5',      variant: 'number',    action: () => handleDigit('5') },
    { id: 'btn-6',        label: '6',      variant: 'number',    action: () => handleDigit('6') },
    { id: 'btn-subtract', label: '−',      variant: 'operator',  action: () => handleOperator('-') },
    // Row 4
    { id: 'btn-1',        label: '1',      variant: 'number',    action: () => handleDigit('1') },
    { id: 'btn-2',        label: '2',      variant: 'number',    action: () => handleDigit('2') },
    { id: 'btn-3',        label: '3',      variant: 'number',    action: () => handleDigit('3') },
    { id: 'btn-add',      label: '+',      variant: 'operator',  action: () => handleOperator('+') },
    // Row 5
    { id: 'btn-0',        label: '0',      variant: 'number',    action: () => handleDigit('0'), isWide: true },
    { id: 'btn-backspace',label: <Delete size={18} />, variant: 'backspace', action: handleBackspace, ariaLabel: 'Backspace' },
    { id: 'btn-equals',   label: '=',      variant: 'equals',    action: handleEquals },
  ];

  return (
    <div className="btn-grid" role="group" aria-label="Calculator buttons">
      {buttons.map((btn) => (
        <Button
          key={btn.id}
          id={btn.id}
          label={btn.label}
          variant={btn.variant}
          onClick={btn.action}
          isWide={btn.isWide}
          ariaLabel={btn.ariaLabel}
          isActive={
            btn.variant === 'operator' &&
            operator === getOpCode(btn.label) &&
            shouldReset
          }
        />
      ))}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function formatOpSymbol(op) {
  return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op;
}

function getOpCode(displaySymbol) {
  return { '+': '+', '−': '-', '×': '*', '÷': '/' }[displaySymbol] || displaySymbol;
}
