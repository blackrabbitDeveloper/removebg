import { removeBg } from "./bgremover.js";
import { mountEditor } from "./editor.js";
import { mountCompare } from "./compare.js";

const MAX_BYTES = 25 * 1024 * 1024;

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  pickBtn: document.getElementById("pickBtn"),
  processing: document.getElementById("processing"),
  progressText: document.getElementById("progressText"),
  progressBar: document.getElementById("progressBar"),
  result: document.getElementById("result"),
  editorMount: document.getElementById("editorMount"),
  compareMount: document.getElementById("compareMount"),
  modeRestore: document.getElementById("modeRestore"),
  modeErase: document.getElementById("modeErase"),
  brushSize: document.getElementById("brushSize"),
  brushHardness: document.getElementById("brushHardness"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  compareToggle: document.getElementById("compareToggle"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  error: document.getElementById("error"),
  errorText: document.getElementById("errorText"),
  retryBtn: document.getElementById("retryBtn"),
};

const state = {
  originalUrl: null,
  resultUrl: null,
  downloadUrl: null,
  compareUrl: null,
  fileName: "image",
  editor: null,
  comparing: false,
};

function show(section) {
  for (const s of [els.dropzone, els.processing, els.result, els.error]) s.hidden = true;
  section.hidden = false;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = url;
  });
}

function revoke(key) {
  if (state[key]) URL.revokeObjectURL(state[key]);
  state[key] = null;
}

function fail(message) {
  els.errorText.textContent = message;
  show(els.error);
}

function validate(file) {
  if (!file.type.startsWith("image/")) return "이미지 파일만 업로드할 수 있어요.";
  if (file.size > MAX_BYTES) return "이미지가 너무 커요. 25MB 이하로 사용해 주세요.";
  return null;
}

async function handleFile(file) {
  const err = validate(file);
  if (err) return fail(err);

  teardownEditor();
  revoke("originalUrl"); revoke("resultUrl"); revoke("downloadUrl"); revoke("compareUrl");
  state.fileName = file.name.replace(/\.[^.]+$/, "") || "image";
  state.originalUrl = URL.createObjectURL(file);

  els.progressBar.style.width = "0%";
  els.progressText.textContent = "배경 제거 중…";
  show(els.processing);

  try {
    const resultBlob = await removeBg(file, (ratio, label) => {
      els.progressText.textContent = label;
      els.progressBar.style.width = `${Math.round(ratio * 100)}%`;
    });
    state.resultUrl = URL.createObjectURL(resultBlob);
    await setupEditor(resultBlob);
  } catch (e) {
    console.error("[removebg] 처리 실패:", e);
    fail("배경 제거에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

async function setupEditor(resultBlob) {
  const [originalImg, resultImg] = await Promise.all([
    loadImage(state.originalUrl),
    loadImage(state.resultUrl),
  ]);

  // UI를 기본값으로 초기화
  resetToolbarUI();
  els.editorMount.innerHTML = "";
  els.compareMount.innerHTML = "";
  els.editorMount.hidden = false;
  els.compareMount.hidden = true;
  state.comparing = false;
  els.compareToggle.textContent = "◐ 원본과 비교";

  state.editor = mountEditor(els.editorMount, originalImg, resultImg, {
    onState: ({ canUndo, canRedo }) => {
      els.undoBtn.disabled = !canUndo;
      els.redoBtn.disabled = !canRedo;
    },
    onBlob: updateDownload,
  });
  state.editor.setSize(+els.brushSize.value);
  state.editor.setHardness(+els.brushHardness.value);

  updateDownload(resultBlob); // 편집 전 초기 다운로드 = AI 결과
  show(els.result);
}

function updateDownload(blob) {
  revoke("downloadUrl");
  state.downloadUrl = URL.createObjectURL(blob);
  els.downloadBtn.href = state.downloadUrl;
  els.downloadBtn.download = `${state.fileName}-removebg.png`;
}

function resetToolbarUI() {
  els.brushSize.value = "40";
  els.brushHardness.value = "60";
  els.modeRestore.classList.add("is-active");
  els.modeErase.classList.remove("is-active");
  els.undoBtn.disabled = true;
  els.redoBtn.disabled = true;
}

function teardownEditor() {
  if (state.editor) { state.editor.destroy(); state.editor = null; }
}

async function toggleCompare() {
  if (!state.editor) return;
  if (!state.comparing) {
    const blob = await state.editor.getBlob();
    revoke("compareUrl");
    state.compareUrl = URL.createObjectURL(blob);
    els.editorMount.hidden = true;
    els.compareMount.hidden = false;
    mountCompare(els.compareMount, state.originalUrl, state.compareUrl);
    state.comparing = true;
    els.compareToggle.textContent = "✎ 편집 계속";
  } else {
    els.compareMount.hidden = true;
    els.editorMount.hidden = false;
    revoke("compareUrl");
    state.comparing = false;
    els.compareToggle.textContent = "◐ 원본과 비교";
  }
}

function reset() {
  teardownEditor();
  revoke("originalUrl"); revoke("resultUrl"); revoke("downloadUrl"); revoke("compareUrl");
  els.editorMount.innerHTML = "";
  els.compareMount.innerHTML = "";
  els.fileInput.value = "";
  show(els.dropzone);
}

// ── 이벤트 ──
els.pickBtn.addEventListener("click", (e) => { e.stopPropagation(); els.fileInput.click(); });
els.dropzone.addEventListener("click", (e) => { if (e.target !== els.pickBtn) els.fileInput.click(); });
els.fileInput.addEventListener("change", () => {
  if (els.fileInput.files[0]) handleFile(els.fileInput.files[0]);
});
["dragenter", "dragover"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add("is-drag"); })
);
["dragleave", "drop"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.remove("is-drag"); })
);
els.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

els.modeRestore.addEventListener("click", () => {
  els.modeRestore.classList.add("is-active");
  els.modeErase.classList.remove("is-active");
  state.editor?.setMode("restore");
});
els.modeErase.addEventListener("click", () => {
  els.modeErase.classList.add("is-active");
  els.modeRestore.classList.remove("is-active");
  state.editor?.setMode("erase");
});
els.brushSize.addEventListener("input", () => state.editor?.setSize(+els.brushSize.value));
els.brushHardness.addEventListener("input", () => state.editor?.setHardness(+els.brushHardness.value));
els.undoBtn.addEventListener("click", () => state.editor?.undo());
els.redoBtn.addEventListener("click", () => state.editor?.redo());
els.compareToggle.addEventListener("click", toggleCompare);
els.resetBtn.addEventListener("click", reset);
els.retryBtn.addEventListener("click", reset);

// 키보드 단축키 (결과 화면에서만)
window.addEventListener("keydown", (e) => {
  if (els.result.hidden || !state.editor || state.comparing) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); state.editor.undo(); }
  else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); state.editor.redo(); }
});

console.log("[removebg] app ready");
