// src/lib/complex.ts
function complex(real = 0, imag = 0) {
  return { real, imag };
}
function mul(a, b) {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}
function conj(a) {
  return { real: a.real, imag: -a.imag };
}
function abs2(a) {
  return a.real * a.real + a.imag * a.imag;
}
function fromPolar(magnitude, phase) {
  return { real: magnitude * Math.cos(phase), imag: magnitude * Math.sin(phase) };
}

// src/lib/state.ts
function nextPowerOfTwo(value) {
  if (value <= 1) {
    return 1;
  }
  return 1 << Math.ceil(Math.log2(value));
}
function normalizeStateVector(state) {
  const total = Math.sqrt(state.reduce((sum, amp) => sum + abs2(amp), 0));
  if (!isFinite(total) || total === 0) {
    return state.map(() => complex(0, 0));
  }
  return state.map((amp) => ({ real: amp.real / total, imag: amp.imag / total }));
}
function computeBlochVectors(state) {
  const normalizedState = normalizeStateVector(state);
  const dimension = normalizedState.length;
  const qubitCount = Math.max(1, Math.round(Math.log2(dimension)));
  const expectedDimension = nextPowerOfTwo(dimension);
  if (expectedDimension !== dimension) {
    normalizedState.length = expectedDimension;
    for (let i = dimension; i < expectedDimension; i += 1) {
      normalizedState[i] = complex(0, 0);
    }
  }
  const vectors = [];
  for (let qubit = 0; qubit < qubitCount; qubit += 1) {
    const rho = reducedDensity(normalizedState, qubit, qubitCount);
    const x = 2 * rho.offDiag.real;
    const y = -2 * rho.offDiag.imag;
    const z = rho.zeroZero - rho.oneOne;
    const radius = Math.min(1, Math.sqrt(x * x + y * y + z * z));
    const theta = radius === 0 ? 0 : Math.acos(clamp(z / (radius === 0 ? 1 : radius), -1, 1));
    const phi = Math.atan2(y, x);
    vectors.push({ index: qubit, x, y, z, radius, theta, phi });
  }
  return { qubitCount, vectors };
}
function reducedDensity(state, qubit, totalQubits) {
  const zeroZero = { real: 0, imag: 0 };
  const oneOne = { real: 0, imag: 0 };
  const offDiag = complex(0, 0);
  const qubitMask = 1 << qubit;
  const restSize = 1 << totalQubits - 1;
  for (let rest = 0; rest < restSize; rest += 1) {
    const basisZero = insertBit(rest, qubit, 0);
    const basisOne = insertBit(rest, qubit, 1);
    const ampZero = state[basisZero] ?? complex(0, 0);
    const ampOne = state[basisOne] ?? complex(0, 0);
    zeroZero.real += abs2(ampZero);
    oneOne.real += abs2(ampOne);
    const product = mul(ampZero, conj(ampOne));
    offDiag.real += product.real;
    offDiag.imag += product.imag;
  }
  return {
    zeroZero: zeroZero.real,
    oneOne: oneOne.real,
    offDiag
  };
}
function insertBit(rest, position, value) {
  const lowerMask = (1 << position) - 1;
  const lower = rest & lowerMask;
  const upper = rest & ~lowerMask;
  return upper << 1 | value << position | lower;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/content/ui/blochSphere.ts
var BlochSphereCanvas = class {
  constructor(size = 150) {
    this.vector = null;
    this.view = { azimuth: 0, elevation: -Math.PI / 2 + 0.25 };
    this.pendingFrame = null;
    this.dragState = null;
    this.size = size;
    this.center = size / 2;
    this.sphereRadius = size * 0.38;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
    this.canvas.style.cursor = "grab";
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to acquire canvas context");
    }
    this.ctx = ctx;
    this.ctx.scale(this.dpr, this.dpr);
    this.attachInteractions();
    this.scheduleDraw();
  }
  get element() {
    return this.canvas;
  }
  clear() {
    this.vector = null;
    this.scheduleDraw();
  }
  render(vector) {
    this.vector = vector;
    this.scheduleDraw();
  }
  attachInteractions() {
    this.canvas.addEventListener("pointerdown", (event) => this.beginDrag(event));
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.endDrag(event));
    this.canvas.addEventListener("pointerleave", (event) => this.endDrag(event));
    this.canvas.addEventListener("pointercancel", (event) => this.endDrag(event));
  }
  beginDrag(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      azimuth: this.view.azimuth,
      elevation: this.view.elevation
    };
    this.canvas.style.cursor = "grabbing";
    event.preventDefault();
  }
  onPointerMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;
    this.view.azimuth = this.dragState.azimuth + dx * 0.01;
    const minElev = -Math.PI / 2 + 0.1;
    const maxElev = Math.PI / 2 - 0.1;
    this.view.elevation = clamp2(this.dragState.elevation + dy * 0.01, minElev, maxElev);
    this.scheduleDraw();
  }
  endDrag(event) {
    if (this.dragState && event.pointerId === this.dragState.pointerId) {
      this.canvas.releasePointerCapture(event.pointerId);
      this.dragState = null;
      this.canvas.style.cursor = "grab";
    }
  }
  scheduleDraw() {
    if (this.pendingFrame !== null) {
      return;
    }
    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.draw();
    });
  }
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    this.drawBackground();
    this.drawSphereGrid();
    this.drawAxisLabels();
    if (this.vector) {
      this.drawVector(this.vector);
    }
  }
  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.size, this.size);
    gradient.addColorStop(0, "rgba(15, 23, 42, 0.95)");
    gradient.addColorStop(1, "rgba(2, 6, 23, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
  }
  drawSphereGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = Math.max(1, this.size * 0.01);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.beginPath();
    ctx.arc(this.center, this.center, this.sphereRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    this.drawCircle({ x: 0, y: 0, z: 1 }, "rgba(148, 163, 184, 0.6)", "rgba(148, 163, 184, 0.25)");
    this.drawCircle({ x: 1, y: 0, z: 0 }, "rgba(148, 163, 184, 0.35)", "rgba(148, 163, 184, 0.15)");
    this.drawCircle({ x: 0, y: 1, z: 0 }, "rgba(148, 163, 184, 0.35)", "rgba(148, 163, 184, 0.15)");
    this.drawAxis({ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 });
    this.drawAxis({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    this.drawAxis({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 });
  }
  drawAxisLabels() {
    const ctx = this.ctx;
    const labels = [
      { text: "|0\u27E9", position: { x: 0, y: 0, z: 1.1 } },
      { text: "|1\u27E9", position: { x: 0, y: 0, z: -1.1 } },
      { text: "+X", position: { x: 1.1, y: 0, z: 0 } },
      { text: "-X", position: { x: -1.1, y: 0, z: 0 } },
      { text: "+Y", position: { x: 0, y: 1.1, z: 0 } },
      { text: "-Y", position: { x: 0, y: -1.1, z: 0 } }
    ];
    ctx.save();
    ctx.font = `${Math.max(10, this.size * 0.08)}px 'IBM Plex Sans', 'Inter', sans-serif`;
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of labels) {
      const projected = this.projectPoint(label.position);
      if (projected.depth < -0.2) {
        continue;
      }
      const shadow = ctx.createLinearGradient(projected.x, projected.y - 6, projected.x, projected.y + 6);
      shadow.addColorStop(0, "rgba(2, 6, 23, 0.9)");
      shadow.addColorStop(1, "rgba(2, 6, 23, 0.2)");
      ctx.fillStyle = shadow;
      ctx.fillRect(projected.x - 12, projected.y - 10, 24, 20);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label.text, projected.x, projected.y);
    }
    ctx.restore();
  }
  drawVector(vector) {
    const magnitude = clamp2(vector.radius, 0, 1);
    const direction = normalize({ x: vector.x, y: vector.y, z: vector.z });
    const samples = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps * magnitude;
      const point = scale(direction, t);
      samples.push(this.projectPoint(point));
    }
    const segments = splitByVisibility(samples);
    const ctx = this.ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, this.size * 0.018);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.setLineDash([4, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));
    ctx.strokeStyle = "#fcd34d";
    ctx.setLineDash([]);
    segments.front.forEach((segment) => this.strokeSegment(segment));
    const headBase = samples[samples.length - 2];
    const headTip = samples[samples.length - 1];
    if (headBase && headTip) {
      this.drawArrowHead(headBase, headTip);
    }
  }
  drawArrowHead(base, tip) {
    const ctx = this.ctx;
    const dx = tip.x - base.x;
    const dy = tip.y - base.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / length;
    const uy = dy / length;
    const size = Math.max(6, this.size * 0.04);
    const leftX = tip.x - ux * size + uy * (size * 0.5);
    const leftY = tip.y - uy * size - ux * (size * 0.5);
    const rightX = tip.x - ux * size - uy * (size * 0.5);
    const rightY = tip.y - uy * size + ux * (size * 0.5);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
  }
  strokeSegment(points) {
    if (points.length < 2) {
      return;
    }
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
  drawAxis(start, end) {
    const samples = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      samples.push(this.projectPoint(lerp(start, end, t)));
    }
    const segments = splitByVisibility(samples);
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(1, this.size * 0.01);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.setLineDash([3, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    segments.front.forEach((segment) => this.strokeSegment(segment));
  }
  drawCircle(normal, frontColor, backColor) {
    const points = this.generateCirclePoints(normal, 1, 72);
    const segments = splitByVisibility(points);
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(1, this.size * 9e-3);
    ctx.strokeStyle = backColor;
    ctx.setLineDash([4, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));
    ctx.setLineDash([]);
    ctx.strokeStyle = frontColor;
    segments.front.forEach((segment) => this.strokeSegment(segment));
  }
  generateCirclePoints(normal, radius, steps) {
    const n = normalize(normal);
    const reference = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const e1 = normalize(cross(n, reference));
    const e2 = normalize(cross(n, e1));
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const theta = i / steps * Math.PI * 2;
      const point = add(scale(e1, Math.cos(theta) * radius), scale(e2, Math.sin(theta) * radius));
      points.push(this.projectPoint(point));
    }
    return points;
  }
  projectPoint(point) {
    const rotated = rotate(point, this.view.azimuth, this.view.elevation);
    const cameraDistance = 3;
    const perspective = cameraDistance / (cameraDistance - rotated.z);
    const x = this.center + rotated.x * this.sphereRadius * perspective;
    const y = this.center - rotated.y * this.sphereRadius * perspective;
    return { x, y, depth: rotated.z };
  }
};
function rotate(point, azimuth, elevation) {
  const cosY = Math.cos(azimuth);
  const sinY = Math.sin(azimuth);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const cosX = Math.cos(elevation);
  const sinX = Math.sin(elevation);
  const y2 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;
  return { x: x1, y: y2, z: z2 };
}
function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!isFinite(length) || length === 0) {
    return { x: 0, y: 0, z: 1 };
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
function scale(vector, factor) {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}
function splitByVisibility(points) {
  const front = [];
  const back = [];
  let currentSegment = [];
  let currentFront = null;
  for (const point of points) {
    const isFront = point.depth >= 0;
    if (currentFront === null) {
      currentFront = isFront;
      currentSegment = [point];
      continue;
    }
    if (isFront === currentFront) {
      currentSegment.push(point);
      continue;
    }
    currentSegment.push(point);
    if (currentSegment.length >= 2) {
      (currentFront ? front : back).push(currentSegment);
    }
    currentSegment = [point];
    currentFront = isFront;
  }
  if (currentSegment.length >= 2 && currentFront !== null) {
    (currentFront ? front : back).push(currentSegment);
  }
  return { front, back };
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/content/ui/panel.ts
var BlochPanel = class {
  constructor() {
    this.collapsed = false;
    this.cards = /* @__PURE__ */ new Map();
    this.visibility = "visible";
    this.dragState = null;
    this.handlePointerMove = (event) => {
      if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
        return;
      }
      const newLeft = clamp3(event.clientX - this.dragState.offsetX, 8, window.innerWidth - this.wrapper.offsetWidth - 8);
      const newTop = clamp3(event.clientY - this.dragState.offsetY, 8, window.innerHeight - this.wrapper.offsetHeight - 8);
      this.wrapper.style.left = `${newLeft}px`;
      this.wrapper.style.top = `${newTop}px`;
    };
    this.handlePointerUp = (event) => {
      if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
        return;
      }
      this.wrapper.releasePointerCapture(event.pointerId);
      this.dragState = null;
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("pointerup", this.handlePointerUp);
    };
    this.root = document.createElement("div");
    this.root.id = "ibm-bloch-overlay-root";
    this.shadow = this.root.attachShadow({ mode: "open" });
    this.wrapper = document.createElement("div");
    this.wrapper.className = "panel";
    this.wrapper.innerHTML = this.buildTemplate();
    this.shadow.appendChild(this.createStyles());
    this.shadow.appendChild(this.wrapper);
    this.titleEl = this.wrapper.querySelector(".panel__title");
    this.body = this.wrapper.querySelector(".panel__body");
    this.statusEl = this.wrapper.querySelector(".panel__status");
    this.qubitHost = this.wrapper.querySelector(".panel__qubits");
    this.stepLabelEl = this.wrapper.querySelector(".panel__step-label");
    this.updatedEl = this.wrapper.querySelector(".panel__updated");
    const collapseBtn = this.wrapper.querySelector('[data-action="collapse"]');
    const closeBtn = this.wrapper.querySelector('[data-action="close"]');
    const header = this.wrapper.querySelector(".panel__header");
    collapseBtn.addEventListener("click", () => this.toggleCollapse());
    closeBtn.addEventListener("click", () => this.hide());
    header.addEventListener("pointerdown", (event) => this.beginDrag(event));
    this.applyVersionLabel();
  }
  mount(target = document.body) {
    target.appendChild(this.root);
  }
  show() {
    this.visibility = "visible";
    this.wrapper.style.display = "flex";
  }
  hide() {
    this.visibility = "hidden";
    this.wrapper.style.display = "none";
  }
  toggleVisibility() {
    if (this.visibility === "visible") {
      this.hide();
    } else {
      this.show();
    }
  }
  setStatus(status, message) {
    const text = message ?? this.messageForStatus(status);
    this.statusEl.textContent = text;
    this.statusEl.dataset.tone = status;
  }
  renderSample(sample) {
    const { vectors } = computeBlochVectors(sample.stateVector);
    this.stepLabelEl.textContent = sample.label ?? `Step ${sample.stepIndex + 1}`;
    const formatter = new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    this.updatedEl.textContent = `Updated ${formatter.format(new Date(sample.lastUpdated))}`;
    const seen = /* @__PURE__ */ new Set();
    for (const vector of vectors) {
      seen.add(vector.index);
      this.getCard(vector.index).update(vector);
    }
    for (const [index, card] of this.cards.entries()) {
      if (!seen.has(index)) {
        card.container.remove();
        this.cards.delete(index);
      }
    }
  }
  getCard(index) {
    if (this.cards.has(index)) {
      return this.cards.get(index);
    }
    const container = document.createElement("div");
    container.className = "qubit-card";
    const title = document.createElement("div");
    title.className = "qubit-card__title";
    title.textContent = `Qubit q${index}`;
    const sphere = new BlochSphereCanvas(150);
    const statsHost = document.createElement("dl");
    statsHost.className = "qubit-card__stats";
    const stats = {};
    for (const key of ["x", "y", "z", "theta", "phi"]) {
      const dt = document.createElement("dt");
      dt.textContent = key.toUpperCase();
      const dd = document.createElement("dd");
      dd.textContent = "--";
      stats[key] = dd;
      statsHost.appendChild(dt);
      statsHost.appendChild(dd);
    }
    container.appendChild(title);
    container.appendChild(sphere.element);
    container.appendChild(statsHost);
    this.qubitHost.appendChild(container);
    const card = {
      container,
      sphere,
      stats,
      update: (vector) => {
        sphere.render(vector);
        stats.x.textContent = vector.x.toFixed(2);
        stats.y.textContent = vector.y.toFixed(2);
        stats.z.textContent = vector.z.toFixed(2);
        stats.theta.textContent = radToDeg(vector.theta).toFixed(1) + "\xB0";
        stats.phi.textContent = radToDeg(vector.phi).toFixed(1) + "\xB0";
      }
    };
    this.cards.set(index, card);
    return card;
  }
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.wrapper.classList.toggle("panel--collapsed", this.collapsed);
  }
  beginDrag(event) {
    if (!(event.buttons & 1)) {
      return;
    }
    const target = event.target;
    if (target.closest("button")) {
      return;
    }
    const rect = this.wrapper.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    this.wrapper.setPointerCapture(event.pointerId);
    this.wrapper.style.right = "auto";
    this.wrapper.style.left = `${rect.left}px`;
    this.wrapper.style.top = `${rect.top}px`;
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    event.preventDefault();
  }
  messageForStatus(status) {
    switch (status) {
      case "connected":
        return "Inspect view detected";
      case "collecting":
        return "Updating from Inspect view\u2026";
      case "error":
        return "Unable to read Inspect view";
      default:
        return "Open Inspect view to start tracking";
    }
  }
  createStyles() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
      }
      .panel {
        position: fixed;
        top: 72px;
        right: 32px;
        width: 360px;
        max-height: 80vh;
        color: #e2e8f0;
        font-family: 'IBM Plex Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: rgba(2, 6, 23, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(2, 6, 23, 0.55);
        display: flex;
        flex-direction: column;
        z-index: 2147483647;
        backdrop-filter: blur(12px);
      }
      .panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: rgba(15, 23, 42, 0.9);
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        cursor: grab;
        user-select: none;
      }
      .panel__title {
        font-size: 14px;
        font-weight: 600;
      }
      .panel__actions {
        display: flex;
        gap: 4px;
      }
      .panel__actions button {
        background: none;
        border: none;
        color: #94a3b8;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
      }
      .panel__actions button:hover {
        background: rgba(148, 163, 184, 0.2);
        color: #f8fafc;
      }
      .panel__body {
        padding: 12px 16px 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .panel__meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: #cbd5f5;
      }
      .panel__status {
        font-size: 12px;
        color: #94a3b8;
      }
      .panel__status[data-tone="collecting"] {
        color: #fcd34d;
      }
      .panel__status[data-tone="error"] {
        color: #f87171;
      }
      .panel__qubits {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .qubit-card {
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 12px;
        background: rgba(15, 23, 42, 0.8);
      }
      .qubit-card__title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .qubit-card canvas {
        border-radius: 12px;
        margin-bottom: 8px;
        display: block;
      }
      .qubit-card__stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 12px;
        margin: 0;
      }
      .qubit-card__stats dt {
        font-size: 11px;
        text-transform: uppercase;
        color: #94a3b8;
      }
      .qubit-card__stats dd {
        margin: 0;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .panel--collapsed .panel__body {
        display: none;
      }
    `;
    return style;
  }
  buildTemplate() {
    return `
      <div class="panel__header">
        <div class="panel__title">Bloch Inspector</div>
        <div class="panel__actions">
          <button data-action="collapse" title="Collapse">\u2581</button>
          <button data-action="close" title="Hide">\u2715</button>
        </div>
      </div>
      <div class="panel__body">
        <div class="panel__meta">
          <span class="panel__step-label">Waiting for steps\u2026</span>
          <span class="panel__updated">\u2014</span>
          <div class="panel__status" data-tone="disconnected">Open Inspect view to start tracking</div>
        </div>
        <div class="panel__qubits"></div>
      </div>
    `;
  }
  applyVersionLabel() {
    try {
      const version = chrome?.runtime?.getManifest?.().version;
      if (version) {
        this.titleEl.textContent = `Bloch Inspector v${version}`;
      }
    } catch (error) {
    }
  }
};
function radToDeg(value) {
  return value * 180 / Math.PI;
}
function clamp3(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/lib/complexParser.ts
var COMPLEX_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([+-])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*[ij]$/i;
var POLAR_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:∠|angle|ang)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i;
var E_EXP_REGEX = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*e\^\{?i([^}]+)\}?$/i;
function parseComplexText(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const polarMatch = normalized.match(POLAR_REGEX);
  if (polarMatch) {
    const magnitude = Number(polarMatch[1]);
    const angle = Number(polarMatch[2]);
    if (isFinite(magnitude) && isFinite(angle)) {
      return fromPolar(magnitude, angle);
    }
  }
  const eExpMatch = normalized.match(E_EXP_REGEX);
  if (eExpMatch) {
    const magnitude = Number(eExpMatch[1]);
    const angle = Number(eExpMatch[2]);
    if (isFinite(magnitude) && isFinite(angle)) {
      return fromPolar(magnitude, angle);
    }
  }
  const complexMatch = normalized.match(COMPLEX_REGEX);
  if (complexMatch) {
    const real = Number(complexMatch[1]);
    const imag = Number(`${complexMatch[2]}${complexMatch[3]}`);
    if (isFinite(real) && isFinite(imag)) {
      return { real, imag };
    }
  }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[ij]$/i.test(normalized)) {
    const imag = Number(normalized.replace(/[ij]/i, ""));
    if (isFinite(imag)) {
      return { real: 0, imag };
    }
  }
  const value = Number(normalized.replace(/[ij]/gi, ""));
  if (isFinite(value)) {
    return { real: value, imag: 0 };
  }
  return null;
}

// src/content/inspectScraper.ts
var STATE_VECTOR_SELECTOR = '#state-vector pre code, [data-panel-id="state-vector"] pre code';
var TOOLBAR_SELECTOR = 'div[role="toolbar"][aria-label="Circuit options"]';
var InspectScraper = class extends EventTarget {
  constructor() {
    super();
    this.stateVectorNode = null;
    this.toolbarNode = null;
    this.stateObserver = null;
    this.toolbarObserver = null;
    this.scanInterval = null;
    this.collectionFrame = null;
    this.lastHash = "";
    this.handleToolbarInteraction = () => {
      this.scheduleCollection();
    };
    this.scan();
    this.scanInterval = window.setInterval(() => this.scan(), 1500);
  }
  disconnect() {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
      this.stateObserver = null;
    }
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
      this.toolbarObserver = null;
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener("click", this.handleToolbarInteraction, true);
    }
    if (this.scanInterval) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.stateVectorNode = null;
    this.toolbarNode = null;
    this.emitStatus("disconnected");
  }
  scan() {
    const stateNode = document.querySelector(STATE_VECTOR_SELECTOR);
    if (stateNode) {
      if (stateNode !== this.stateVectorNode) {
        this.bindStateVector(stateNode);
      }
    } else if (this.stateVectorNode) {
      this.unbindStateVector();
    }
    const toolbar = document.querySelector(TOOLBAR_SELECTOR);
    if (toolbar) {
      if (toolbar !== this.toolbarNode) {
        this.bindToolbar(toolbar);
      }
    } else if (this.toolbarNode) {
      this.unbindToolbar();
    }
    if (!stateNode) {
      const inspectActive = document.querySelector("#composer-toolbar-inspect-switch")?.getAttribute("aria-checked") === "true";
      this.emitStatus(
        inspectActive ? "error" : "disconnected",
        inspectActive ? "Enable the Statevector visualization to feed Bloch Inspector" : void 0
      );
    }
  }
  bindStateVector(node) {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
    }
    this.stateVectorNode = node;
    this.stateObserver = new MutationObserver(() => this.scheduleCollection());
    this.stateObserver.observe(node, { characterData: true, childList: true, subtree: true });
    this.emitStatus("connected");
    this.scheduleCollection();
  }
  unbindStateVector() {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
      this.stateObserver = null;
    }
    this.stateVectorNode = null;
    this.emitStatus("disconnected");
  }
  bindToolbar(node) {
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener("click", this.handleToolbarInteraction, true);
    }
    this.toolbarNode = node;
    this.toolbarNode.addEventListener("click", this.handleToolbarInteraction, true);
    this.toolbarObserver = new MutationObserver(() => this.scheduleCollection());
    this.toolbarObserver.observe(node, { attributes: true, childList: true, subtree: true });
  }
  unbindToolbar() {
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
      this.toolbarObserver = null;
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener("click", this.handleToolbarInteraction, true);
      this.toolbarNode = null;
    }
  }
  scheduleCollection() {
    if (this.collectionFrame !== null) {
      return;
    }
    this.collectionFrame = window.requestAnimationFrame(() => {
      this.collectionFrame = null;
      const sample = this.collectSample();
      if (!sample) {
        return;
      }
      const hash = hashState(sample.stateVector);
      if (hash === this.lastHash) {
        return;
      }
      this.lastHash = hash;
      this.emitStatus("collecting");
      this.dispatchEvent(new CustomEvent("state", { detail: sample }));
    });
  }
  collectSample() {
    if (!this.stateVectorNode) {
      return null;
    }
    const text = this.stateVectorNode.textContent?.trim();
    if (!text) {
      return null;
    }
    const stateVector = parseStateVectorText(text);
    if (!stateVector || !stateVector.length) {
      return null;
    }
    const qubitCount = Math.max(1, Math.round(Math.log2(stateVector.length)));
    const sample = {
      stepIndex: 0,
      totalSteps: 0,
      label: this.extractStepLabel(),
      stateVector,
      lastUpdated: Date.now(),
      qubitCount
    };
    return sample;
  }
  extractStepLabel() {
    const ariaMatch = document.querySelector('[aria-label*="Inspecting" i]');
    if (ariaMatch?.textContent) {
      return ariaMatch.textContent.trim();
    }
    const statusChip = Array.from(document.querySelectorAll("span, div")).find((node) => {
      const text = node.textContent?.trim();
      return text && /Step\s+\d+/i.test(text);
    });
    if (statusChip?.textContent) {
      return statusChip.textContent.trim();
    }
    const toggle = document.querySelector("#composer-toolbar-inspect-switch");
    if (toggle?.getAttribute("aria-checked") === "true") {
      return "Inspecting";
    }
    return void 0;
  }
  emitStatus(status, message) {
    this.dispatchEvent(new CustomEvent("status", { detail: { status, message } }));
  }
};
function parseStateVectorText(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  const entries = inner.split(",");
  const vector = [];
  for (const entry of entries) {
    const parsed = parseComplexText(entry.trim());
    if (!parsed) {
      return null;
    }
    vector.push(parsed);
  }
  return vector;
}
function hashState(state) {
  return state.map((amp) => `${amp.real.toFixed(6)}:${amp.imag.toFixed(6)}`).join("|");
}

// src/content/index.ts
async function bootstrap() {
  const panel = new BlochPanel();
  panel.mount(document.documentElement);
  const scraper = new InspectScraper();
  const { autoEnable } = await chrome.storage.sync.get({ autoEnable: true });
  if (autoEnable) {
    panel.show();
  } else {
    panel.hide();
  }
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.autoEnable) {
      return;
    }
    if (changes.autoEnable.newValue) {
      panel.show();
    } else {
      panel.hide();
    }
  });
  scraper.addEventListener("status", (event) => {
    const statusEvent = event;
    panel.setStatus(statusEvent.detail.status, statusEvent.detail.message);
  });
  scraper.addEventListener("state", (event) => {
    const stateEvent = event;
    panel.setStatus("collecting");
    panel.renderSample(stateEvent.detail);
    panel.setStatus("connected", "Tracking Inspect view");
  });
  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      panel.toggleVisibility();
    }
  });
  window.ibmBlochInspector = {
    pushSample: (sample) => panel.renderSample(sample),
    toggle: () => panel.toggleVisibility()
  };
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
//# sourceMappingURL=index.js.map
