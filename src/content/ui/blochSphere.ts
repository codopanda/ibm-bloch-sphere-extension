import { BlochVector } from '../../lib/state.js';

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  azimuth: number;
  elevation: number;
}

export class BlochSphereCanvas {
  private canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D;

  private size: number;

  private dpr: number;

  private center: number;

  private sphereRadius: number;

  private vector: BlochVector | null = null;

  private view = { azimuth: 0, elevation: -Math.PI / 2 + 0.25 };

  private pendingFrame: number | null = null;

  private dragState: DragState | null = null;

  constructor(size = 150) {
    this.size = size;
    this.center = size / 2;
    this.sphereRadius = size * 0.38;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.canvas.width = Math.round(size * this.dpr);
    this.canvas.height = Math.round(size * this.dpr);
    this.canvas.style.cursor = 'grab';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire canvas context');
    }
    this.ctx = ctx;
    this.ctx.scale(this.dpr, this.dpr);
    this.attachInteractions();
    this.scheduleDraw();
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  clear() {
    this.vector = null;
    this.scheduleDraw();
  }

  render(vector: BlochVector | null) {
    this.vector = vector;
    this.scheduleDraw();
  }

  private attachInteractions() {
    this.canvas.addEventListener('pointerdown', (event) => this.beginDrag(event));
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.endDrag(event));
    this.canvas.addEventListener('pointerleave', (event) => this.endDrag(event));
    this.canvas.addEventListener('pointercancel', (event) => this.endDrag(event));
  }

  private beginDrag(event: PointerEvent) {
    this.canvas.setPointerCapture(event.pointerId);
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      azimuth: this.view.azimuth,
      elevation: this.view.elevation
    };
    this.canvas.style.cursor = 'grabbing';
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;
    this.view.azimuth = this.dragState.azimuth + dx * 0.01;
    const minElev = -Math.PI / 2 + 0.1;
    const maxElev = Math.PI / 2 - 0.1;
    this.view.elevation = clamp(this.dragState.elevation + dy * 0.01, minElev, maxElev);
    this.scheduleDraw();
  }

  private endDrag(event: PointerEvent) {
    if (this.dragState && event.pointerId === this.dragState.pointerId) {
      this.canvas.releasePointerCapture(event.pointerId);
      this.dragState = null;
      this.canvas.style.cursor = 'grab';
    }
  }

  private scheduleDraw() {
    if (this.pendingFrame !== null) {
      return;
    }
    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = null;
      this.draw();
    });
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    this.drawBackground();
    this.drawSphereGrid();
    this.drawAxisLabels();
    if (this.vector) {
      this.drawVector(this.vector);
    }
  }

  private drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.size, this.size);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    gradient.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
  }

  private drawSphereGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = Math.max(1, this.size * 0.01);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.beginPath();
    ctx.arc(this.center, this.center, this.sphereRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    this.drawCircle({ x: 0, y: 0, z: 1 }, 'rgba(148, 163, 184, 0.6)', 'rgba(148, 163, 184, 0.25)');
    this.drawCircle({ x: 1, y: 0, z: 0 }, 'rgba(148, 163, 184, 0.35)', 'rgba(148, 163, 184, 0.15)');
    this.drawCircle({ x: 0, y: 1, z: 0 }, 'rgba(148, 163, 184, 0.35)', 'rgba(148, 163, 184, 0.15)');

    this.drawAxis({ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 });
    this.drawAxis({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    this.drawAxis({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 });
  }

  private drawAxisLabels() {
    const ctx = this.ctx;
    const labels: Array<{ text: string; position: Vector3 }> = [
      { text: '|0⟩', position: { x: 0, y: 0, z: 1.1 } },
      { text: '|1⟩', position: { x: 0, y: 0, z: -1.1 } },
      { text: '+X', position: { x: 1.1, y: 0, z: 0 } },
      { text: '-X', position: { x: -1.1, y: 0, z: 0 } },
      { text: '+Y', position: { x: 0, y: 1.1, z: 0 } },
      { text: '-Y', position: { x: 0, y: -1.1, z: 0 } }
    ];
    ctx.save();
    ctx.font = `${Math.max(10, this.size * 0.08)}px 'IBM Plex Sans', 'Inter', sans-serif`;
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of labels) {
      const projected = this.projectPoint(label.position);
      if (projected.depth < -0.2) {
        continue;
      }
      const shadow = ctx.createLinearGradient(projected.x, projected.y - 6, projected.x, projected.y + 6);
      shadow.addColorStop(0, 'rgba(2, 6, 23, 0.9)');
      shadow.addColorStop(1, 'rgba(2, 6, 23, 0.2)');
      ctx.fillStyle = shadow;
      ctx.fillRect(projected.x - 12, projected.y - 10, 24, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label.text, projected.x, projected.y);
    }
    ctx.restore();
  }

  private drawVector(vector: BlochVector) {
    const magnitude = clamp(vector.radius, 0, 1);
    const direction = normalize({ x: vector.x, y: vector.y, z: vector.z });
    const samples: ProjectedPoint[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * magnitude;
      const point = scale(direction, t);
      samples.push(this.projectPoint(point));
    }
    const segments = splitByVisibility(samples);
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, this.size * 0.018);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.setLineDash([4, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));

    ctx.strokeStyle = '#fcd34d';
    ctx.setLineDash([]);
    segments.front.forEach((segment) => this.strokeSegment(segment));

    const headBase = samples[samples.length - 2];
    const headTip = samples[samples.length - 1];
    if (headBase && headTip) {
      this.drawArrowHead(headBase, headTip);
    }
  }

  private drawArrowHead(base: ProjectedPoint, tip: ProjectedPoint) {
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
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
  }

  private strokeSegment(points: ProjectedPoint[]) {
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

  private drawAxis(start: Vector3, end: Vector3) {
    const samples: ProjectedPoint[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      samples.push(this.projectPoint(lerp(start, end, t)));
    }
    const segments = splitByVisibility(samples);
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(1, this.size * 0.01);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.setLineDash([3, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    segments.front.forEach((segment) => this.strokeSegment(segment));
  }

  private drawCircle(normal: Vector3, frontColor: string, backColor: string) {
    const points = this.generateCirclePoints(normal, 1, 72);
    const segments = splitByVisibility(points);
    const ctx = this.ctx;
    ctx.lineWidth = Math.max(1, this.size * 0.009);
    ctx.strokeStyle = backColor;
    ctx.setLineDash([4, 3]);
    segments.back.forEach((segment) => this.strokeSegment(segment));
    ctx.setLineDash([]);
    ctx.strokeStyle = frontColor;
    segments.front.forEach((segment) => this.strokeSegment(segment));
  }

  private generateCirclePoints(normal: Vector3, radius: number, steps: number): ProjectedPoint[] {
    const n = normalize(normal);
    const reference = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const e1 = normalize(cross(n, reference));
    const e2 = normalize(cross(n, e1));
    const points: ProjectedPoint[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const theta = (i / steps) * Math.PI * 2;
      const point = add(scale(e1, Math.cos(theta) * radius), scale(e2, Math.sin(theta) * radius));
      points.push(this.projectPoint(point));
    }
    return points;
  }

  private projectPoint(point: Vector3): ProjectedPoint {
    const rotated = rotate(point, this.view.azimuth, this.view.elevation);
    const cameraDistance = 3;
    const perspective = cameraDistance / (cameraDistance - rotated.z);
    const x = this.center + rotated.x * this.sphereRadius * perspective;
    const y = this.center - rotated.y * this.sphereRadius * perspective;
    return { x, y, depth: rotated.z };
  }
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function rotate(point: Vector3, azimuth: number, elevation: number): Vector3 {
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

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!isFinite(length) || length === 0) {
    return { x: 0, y: 0, z: 1 };
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function scale(vector: Vector3, factor: number): Vector3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function lerp(a: Vector3, b: Vector3, t: number): Vector3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

function splitByVisibility(points: ProjectedPoint[]) {
  const front: ProjectedPoint[][] = [];
  const back: ProjectedPoint[][] = [];
  let currentSegment: ProjectedPoint[] = [];
  let currentFront: boolean | null = null;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
