// FireNances mark: Prosperity's rising zigzag arrow (same artwork), painted with the theme accent
// through a CSS mask so it follows light/dark mode.
export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-accent ${className}`}
      style={{ maskImage: "url(/logo-arrow.png)", WebkitMaskImage: "url(/logo-arrow.png)", maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }}
    />
  );
}

// Spaced uppercase wordmark, as in Prosperity's lockup.
export function Wordmark({ className }: { className?: string }) {
  return <span className={`truncate text-[0.92rem] font-bold uppercase tracking-[0.14em] ${className ?? ""}`}>FireNances</span>;
}
