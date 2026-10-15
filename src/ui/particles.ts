/** Drifting sunset embers (ported from the June prototype's spawnEmber + floatUp). */
export function startEmbers(layer: HTMLElement | null): () => void {
  if (!layer) return () => {};
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (reduced) return () => {};

  const timers: ReturnType<typeof setTimeout>[] = [];
  function spawn(): void {
    if (document.hidden) return;
    const el = document.createElement("span");
    el.className = "ember";
    const size = 2 + Math.random() * 2.5;
    el.style.left = `${Math.random() * 100}vw`;
    el.style.width = el.style.height = `${size}px`;
    el.style.background = `rgba(255, ${Math.round(180 + Math.random() * 60)}, ${Math.round(100 + Math.random() * 60)}, 0.6)`;
    el.style.animationDuration = `${14 + Math.random() * 8}s`;
    el.style.setProperty("--drift", `${((Math.random() - 0.5) * 60).toFixed(0)}px`);
    layer!.appendChild(el);
    timers.push(setTimeout(() => el.remove(), 24000));
  }
  for (let i = 0; i < 5; i++) timers.push(setTimeout(spawn, i * 600));
  const interval = setInterval(spawn, 2500);
  return () => {
    clearInterval(interval);
    for (const t of timers) clearTimeout(t);
    layer.replaceChildren();
  };
}
