// 알파 마스크 기반 브러시 편집기.
// 원본 RGB(불변) + 마스크(투명도)를 분리 유지하고, 화면/저장은 원본을 마스크로 오려낸다.
//  - 복원 브러시: 마스크에 흰색 스탬프(source-over) → 알파 증가 → 원본 복귀
//  - 지우개 브러시: 마스크에 destination-out 스탬프 → 알파 감소 → 투명
//  - 강도(hardness): 방사형 그라디언트로 0=부드럽게 ~ 100=선명하게
export function mountEditor(mount, originalImg, resultImg, opts = {}) {
  const W = originalImg.naturalWidth;
  const H = originalImg.naturalHeight;
  const onState = opts.onState || (() => {});
  const onBlob = opts.onBlob || (() => {});

  // 원본 캔버스(불변)
  const orig = document.createElement("canvas");
  orig.width = W; orig.height = H;
  orig.getContext("2d").drawImage(originalImg, 0, 0);

  // 마스크 캔버스: 초기값 = AI 결과의 알파 채널
  const mask = document.createElement("canvas");
  mask.width = W; mask.height = H;
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  mctx.drawImage(resultImg, 0, 0);

  // 표시 캔버스
  const view = document.createElement("canvas");
  view.width = W; view.height = H;
  view.className = "editor__canvas";
  const vctx = view.getContext("2d");

  mount.classList.add("checker");
  mount.appendChild(view);

  // 브러시 커서 링
  const cursor = document.createElement("div");
  cursor.className = "editor__cursor";
  cursor.hidden = true;
  mount.appendChild(cursor);

  const state = { mode: "restore", size: 40, hardness: 60 };

  // ── undo/redo (마스크 크기에 따라 스냅샷 개수 동적 제한) ──
  const MAX_SNAP = Math.max(3, Math.min(20, Math.floor((64 * 1024 * 1024) / (W * H * 4))));
  const undoStack = [];
  const redoStack = [];
  const snapshot = () => mctx.getImageData(0, 0, W, H);
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_SNAP) undoStack.shift();
    redoStack.length = 0;
    emitState();
  }

  // ── 합성(rAF throttle) ──
  let rafId = 0;
  function composite() {
    vctx.clearRect(0, 0, W, H);
    vctx.globalCompositeOperation = "source-over";
    vctx.drawImage(orig, 0, 0);
    vctx.globalCompositeOperation = "destination-in";
    vctx.drawImage(mask, 0, 0);
    vctx.globalCompositeOperation = "source-over";
  }
  function requestComposite() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; composite(); });
  }

  // ── 좌표 변환: client → 캔버스 픽셀 ──
  function toCanvas(e) {
    const rect = view.getBoundingClientRect();
    const scale = W / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, scale };
  }
  const radiusNat = (scale) => (state.size / 2) * scale;

  // ── 스탬프 ──
  function stamp(x, y, r) {
    r = Math.max(1, r);
    const inner = Math.min(r * (state.hardness / 100), r * 0.999);
    const grad = mctx.createRadialGradient(x, y, inner, x, y, r);
    if (state.mode === "restore") {
      mctx.globalCompositeOperation = "source-over";
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      mctx.globalCompositeOperation = "destination-out";
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
    }
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(x, y, r, 0, Math.PI * 2);
    mctx.fill();
    mctx.globalCompositeOperation = "source-over";
  }
  function stampLine(x0, y0, x1, y1, r) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.25)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
    }
  }

  // ── 포인터 드로잉 ──
  let drawing = false;
  let hovering = false;
  let last = null;

  function onDown(e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    try { view.setPointerCapture(e.pointerId); } catch {}
    pushUndo();
    drawing = true;
    last = toCanvas(e);
    stamp(last.x, last.y, radiusNat(last.scale));
    requestComposite();
  }
  function onMove(e) {
    updateCursor(e);
    if (!drawing) return;
    const p = toCanvas(e);
    stampLine(last.x, last.y, p.x, p.y, radiusNat(p.scale));
    last = p;
    requestComposite();
  }
  function onUp() {
    if (!drawing) return;
    drawing = false;
    last = null;
    composite();
    emitBlob();
  }

  function updateCursor(e) {
    const rect = mount.getBoundingClientRect();
    cursor.hidden = !(hovering || drawing);
    cursor.style.width = cursor.style.height = state.size + "px";
    cursor.style.left = e.clientX - rect.left + "px";
    cursor.style.top = e.clientY - rect.top + "px";
  }

  view.addEventListener("pointerenter", () => { hovering = true; });
  view.addEventListener("pointerleave", () => { hovering = false; if (!drawing) cursor.hidden = true; });
  view.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  // ── 내보내기(원본 RGB + 편집 마스크) ──
  function renderExport() {
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const octx = out.getContext("2d");
    octx.drawImage(orig, 0, 0);
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(mask, 0, 0);
    return out;
  }
  const getBlob = () => new Promise((res) => renderExport().toBlob(res, "image/png"));

  function emitState() {
    onState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  }
  async function emitBlob() { onBlob(await getBlob()); }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    mctx.putImageData(undoStack.pop(), 0, 0);
    composite(); emitState(); emitBlob();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    mctx.putImageData(redoStack.pop(), 0, 0);
    composite(); emitState(); emitBlob();
  }

  composite();
  emitState();

  return {
    setMode: (m) => { state.mode = m; },
    setSize: (s) => { state.size = s; },
    setHardness: (h) => { state.hardness = h; },
    undo, redo, getBlob,
    destroy() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
