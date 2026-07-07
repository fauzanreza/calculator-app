/**
 * Reusable calculator button component
 *
 * Props:
 *   label     {string|ReactNode}  — Button label text or icon
 *   onClick   {function}          — Click handler
 *   variant   {string}            — 'number' | 'operator' | 'special' | 'equals' | 'backspace'
 *   isWide    {boolean}           — If true, spans 2 grid columns (zero button)
 *   isActive  {boolean}           — If true, adds active-op class (for selected operator)
 *   id        {string}            — Unique HTML id for testing
 */
export default function Button({
  label,
  onClick,
  variant = 'number',
  isWide = false,
  isActive = false,
  id,
  ariaLabel,
}) {
  const baseClass = 'calc-btn';

  const variantClass = {
    number: 'btn-number',
    operator: 'btn-operator',
    special: 'btn-special',
    equals: 'btn-equals',
    backspace: 'btn-backspace',
  }[variant] || 'btn-number';

  const wideClass = isWide ? 'btn-zero' : '';
  const activeClass = isActive ? 'active-op' : '';

  return (
    <button
      id={id}
      className={`${baseClass} ${variantClass} ${wideClass} ${activeClass}`}
      onClick={onClick}
      aria-label={ariaLabel || String(label)}
      type="button"
    >
      {label}
    </button>
  );
}
