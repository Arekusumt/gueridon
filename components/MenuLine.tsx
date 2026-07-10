/** The house signature: a dish-and-price line with dot leaders. */
export function MenuLine({
  label,
  value,
  sub,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="menuline">
        <span>{label}</span>
        <span className="dots" aria-hidden="true" />
        <span className="lining font-mono text-[0.95em] whitespace-nowrap">{value}</span>
      </div>
      {sub ? <div className="text-sm text-ink-soft mt-0.5">{sub}</div> : null}
    </div>
  );
}
