# IBM Bloch Inspector

Chrome extension that overlays Bloch-sphere visualisations for each qubit while you scrub through the Inspect view inside [IBM Quantum Composer](https://quantum.cloud.ibm.com/composer).

## How it works

- Injects a floating panel into the Composer canvas (runs in the page world, isolated through a Shadow DOM root so it will not clash with IBM styles).
- Watches the Inspect view table and slider (found automatically by scanning for the statevector table that contains basis states such as `|000⟩`).
- Parses the amplitude column, rebuilds the full statevector for the current step, and computes the reduced single-qubit states (partial trace) to get Bloch vectors.
- Renders one Bloch sphere per qubit with live Cartesian coordinates `(x, y, z)` as well as `θ/φ` in degrees. The spheres update every time the Inspect slider changes.
- Provides a small popup (toolbar icon) so you can decide if the overlay should auto-mount on load. You can also hide/show the panel with `Alt + B` directly on the Composer tab.

> **Assumptions**
> IBM Composer currently displays amplitudes as `a ± bi`. That representation is parsed directly from the DOM. If IBM changes the Inspect table format, adjust `src/content/inspectScraper.ts` to parse the new structure.

## Getting started

```bash
npm install
npm run build
```

Load the `dist` folder as an unpacked extension in `chrome://extensions`. The build step copies the manifest, popup HTML, icons and bundled scripts.

For iterative work, run the watcher:

```bash
npm run dev
```

and reload the extension in Chrome when files rebuild.

## Usage

1. Open IBM Quantum Composer and build / load a circuit.
2. Click **Inspect** to open the built-in step debugger.
3. Switch the analytics card to **Statevector** (bottom left dropdown). The extension parses the `[ ... ]` array shown in that panel; if it is closed you'll now see a reminder in the overlay.
4. Move the Inspect slider — the "Bloch Inspector" panel appears on the right and tracks the current step.
5. Each qubit card shows a Bloch sphere plus numeric coordinates. Use the collapse button or drag the header if the panel covers the circuit.
5. Toggle the overlay quickly via `Alt + B`, or disable the auto-mount behaviour from the action popup.

If the panel says "Open Inspect view to start tracking", ensure the Inspect modal/table is visible. The scraper polls every ~1.5 s for the table, so the panel syncs up shortly after Inspect is opened.

## Project layout

- `manifest.json` – Chrome MV3 manifest.
- `src/content` – content script (DOM scraper, Bloch computations, overlay UI).
- `src/lib` – complex number helpers, statevector → Bloch conversion utilities.
- `src/popup` – action popup with auto-enable toggle.
- `src/background.ts` – placeholder service worker for future messaging/telemetry.
- `scripts/build.mjs` – esbuild bundler + static asset copier.

## Customising / extending

- Update the selectors in `InspectScraper` if IBM revamps the Inspect panel markup.
- Style tweaks live in `src/content/ui/panel.ts` (Shadow DOM-scoped CSS). The drag/collapse behaviour is also there.
- The Bloch renderer uses a lightweight Canvas component (`src/content/ui/blochSphere.ts`). Replace it with a richer WebGL component if you need more detail (e.g., gate annotations or trajectories).
- The content script exposes `window.ibmBlochInspector.pushSample(sample)` for quick UI testing with mock data. Use it from DevTools to check the overlay without connecting to Composer.

## Limitations

- Entanglement visualisation is limited to single-qubit reductions; therefore arrows shrink if the qubit is mixed (magnitude < 1).
- The scraper relies on the textual amplitude column; if the Inspect modal hides amplitudes (e.g., due to screen size), the panel cannot compute anything.
- This project does not yet hook into Composer internals, so there is no guarantee that it will survive future IBM UI refactors without selector updates.

Contributions and refinements are welcome!
