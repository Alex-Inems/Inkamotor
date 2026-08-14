export function ColorStripe({ className = "" }: { className?: string }) {
  return (
    <div className={`color-stripe ${className}`} aria-hidden>
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function InkamotoLogo({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <img
      src="/inkamoto-logo.svg"
      alt="Inkamoto Tours"
      className={className}
    />
  );
}
