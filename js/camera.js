// camera.js — maps the authored world (world.js) onto the canvas. Pure math,
// no DOM: main.js feeds it pointer/wheel/pinch input and the viewport size,
// render.js reads its transform, and every hit test goes through
// screenToWorld() so pointer, touch and selection agree with what is drawn.
//
// Screen units are CSS pixels. The view is always kept inside the world, and
// zoom is bounded: the minimum shows the whole map (or fills the viewport on
// narrow portrait screens), the maximum is a modest close-up.

const CAMERA_MAX_ZOOM = 1.6;
const CAMERA_DEFAULT_ZOOM = 1;
// Opening view: gate, Entrance Hall, the range beside the gate and the Barracks site.
const CAMERA_HOME = { x: 430, y: 450 };
const CAMERA_HOME_NARROW = { x: 300, y: 580 };

class Camera {
  constructor(viewW = 960, viewH = 576) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.zoom = CAMERA_DEFAULT_ZOOM;
    this.x = 0; // world coordinate at the view's left edge
    this.y = 0; // world coordinate at the view's top edge
    this.home();
  }

  get minZoom() {
    return Math.max(this.viewW / WORLD_W, this.viewH / WORLD_H);
  }

  // Viewport resize keeps the same world point in the middle.
  setViewport(viewW, viewH) {
    const centre = this.screenToWorld(this.viewW / 2, this.viewH / 2);
    this.viewW = viewW;
    this.viewH = viewH;
    this.zoom = clamp(this.zoom, this.minZoom, CAMERA_MAX_ZOOM);
    this.centreOn(centre.x, centre.y);
  }

  // Narrow (phone) viewports start a little wider so the gate, hall and
  // first sites fit; desktop starts at 1:1.
  home() {
    const zoom = this.viewW < 600 ? this.viewW / 520 : CAMERA_DEFAULT_ZOOM;
    this.zoom = clamp(zoom, this.minZoom, CAMERA_MAX_ZOOM);
    this.centreOn(this.viewW < 600 ? CAMERA_HOME_NARROW.x : CAMERA_HOME.x, this.viewW < 600 ? CAMERA_HOME_NARROW.y : CAMERA_HOME.y);
  }

  fitWorld() {
    this.zoom = this.minZoom;
    this.centreOn(WORLD_W / 2, WORLD_H / 2);
  }

  centreOn(worldX, worldY) {
    this.x = worldX - this.viewW / (2 * this.zoom);
    this.y = worldY - this.viewH / (2 * this.zoom);
    this.clampToWorld();
  }

  clampToWorld() {
    const spanX = this.viewW / this.zoom, spanY = this.viewH / this.zoom;
    this.x = spanX >= WORLD_W ? (WORLD_W - spanX) / 2 : clamp(this.x, 0, WORLD_W - spanX);
    this.y = spanY >= WORLD_H ? (WORLD_H - spanY) / 2 : clamp(this.y, 0, WORLD_H - spanY);
  }

  // Drag by a screen-pixel delta (content follows the finger/pointer).
  panBy(screenDx, screenDy) {
    this.x -= screenDx / this.zoom;
    this.y -= screenDy / this.zoom;
    this.clampToWorld();
  }

  // Zoom by `factor` keeping the world point under (screenX, screenY) fixed.
  zoomAt(screenX, screenY, factor) {
    const anchor = this.screenToWorld(screenX, screenY);
    this.zoom = clamp(this.zoom * factor, this.minZoom, CAMERA_MAX_ZOOM);
    this.x = anchor.x - screenX / this.zoom;
    this.y = anchor.y - screenY / this.zoom;
    this.clampToWorld();
  }

  screenToWorld(screenX, screenY) {
    return { x: this.x + screenX / this.zoom, y: this.y + screenY / this.zoom };
  }

  worldToScreen(worldX, worldY) {
    return { x: (worldX - this.x) * this.zoom, y: (worldY - this.y) * this.zoom };
  }

  // Visible world rectangle, padded, for culling.
  visibleBounds(pad = 0) {
    return {
      minX: this.x - pad, minY: this.y - pad,
      maxX: this.x + this.viewW / this.zoom + pad, maxY: this.y + this.viewH / this.zoom + pad,
    };
  }
}
