# Prototype: Windows Right-Edge Curved Notch Overlay

> **Question under evaluation ([Issue #4](https://github.com/Vudattumaniteja/usage-moniter/issues/4)):**  
> How should the transparent frameless Tauri window, SVG curved notch boundary, circular usage progress rings, and hover popover cards be structured and styled on Windows to match the reference design smoothly?

---

## How to Run the Prototype

To launch the interactive prototype switcher locally:

```bash
pnpm dev
```

Then navigate in your browser to:
- **Variant A (Organic Curve Notch):** [http://localhost:1420/?variant=A](http://localhost:1420/?variant=A)
- **Variant B (Floating Pill HUD):** [http://localhost:1420/?variant=B](http://localhost:1420/?variant=B)
- **Variant C (Cyber Chamfer Blade):** [http://localhost:1420/?variant=C](http://localhost:1420/?variant=C)

Or launch directly inside Tauri transparent frameless window:

```bash
pnpm tauri dev
```

---

## The 3 Radically Different UI Variants

### Variant A: Organic Curvature Notch (Default & Recommended)
- **Geometry:** Continuous organic SVG cubic Bezier fillet curves smoothly extending from the right screen edge.
- **Visuals:** Frosted glassmorphism (`backdrop-filter: blur(20px)` + dark gradient with subtle top-left border glow).
- **Rings & Popover:** Stacked dual-ring gauges for Antigravity (Sky Blue `#38bdf8`), Codex / ChatGPT (Emerald `#10b981`), and Claude (Orange `#f97316`). Hovering or clicking a ring expands a detailed left-floating popover card showing session reset countdowns and secondary model limits.

### Variant B: Floating Pill Tab with Expandable HUD
- **Geometry:** Ultra-compact right-edge capsule with vertical micro-bars that takes minimal screen footprint when idle.
- **Interaction:** Expands on click or hover into a multi-provider comparative HUD card with segmented provider tabs, burn-rate metrics, and aggregated reset countdown.

### Variant C: Cyber Chamfer Blade
- **Geometry:** High-tech angled polygon chamfer edge with an active vertical neon rail and live RPC connectivity status (`127.0.0.1:RPC`).
- **Telemetry:** Segmented bar indicators, live clock, and a one-click slide-out raw JSON diagnostic drawer inspecting the underlying RPC response schema.

---

## Interactive Features in the Prototype

- **Floating Switcher Pill:** Bottom-centered navigation bar with `<` and `>` arrow buttons, current variant badge, and keyboard navigation (`←` and `→` arrow keys).
- **Simulator Controls Drawer:** Click the sliders icon in the switcher to adjust live quota usage percentages across providers (0% to 100%) and watch the gauge colors and warning/exhaustion states update dynamically.
- **Canvas Backdrop Switcher:** Toggle between **Studio Dark**, **VS Code Editor**, **Windows 11 Wallpaper**, and **Pure Alpha (Transparent)** to test visual contrast against different desktop backgrounds.
