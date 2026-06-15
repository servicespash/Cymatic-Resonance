import logoAsset from "@/assets/logo.png.asset.json";

export function CymaticWave({ className = "h-6", bars = 5 }: { className?: string; bars?: number }) {
  return (
    <div className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="wave-bar inline-block w-[3px] rounded-full bg-frequency"
          style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function CymaticLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative grid place-items-center overflow-hidden rounded-xl resonance-glow"
        style={{ width: size, height: size }}
      >
        <img
          src={logoAsset.url}
          alt="Cymatic Resonance"
          width={size}
          height={size}
          className="size-full object-cover"
        />
      </div>
      <div className="leading-tight">
        <div className="font-display text-base font-bold tracking-tight">Cymatic</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Resonance
        </div>
      </div>
    </div>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={logoAsset.url}
      alt="Cymatic Resonance"
      width={size}
      height={size}
      className="rounded-xl resonance-glow"
    />
  );
}
