import { forwardRef } from 'react';

const Display = forwardRef(({ history, isError, isLoading, onInput }, ref) => {
  return (
    <div aria-live="polite" aria-atomic="true" style={{ width: '100%' }}>
      {/* History line */}
      <div
        className="display-history"
        aria-label="Calculation history"
        title={history}
      >
        {history || '\u00A0'}
      </div>

      {/* MathLive Current value */}
      <math-field
        ref={ref}
        onInput={onInput}
        class={`display-current ${isError ? 'error' : ''} ${isLoading ? 'loading' : ''}`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          outline: 'none',
          width: '100%',
          minHeight: '46px', // Ensure it has height even when empty
        }}
        math-virtual-keyboard-policy="manual"
        read-only={isLoading ? "true" : undefined}
      >
      </math-field>
    </div>
  );
});

export default Display;
