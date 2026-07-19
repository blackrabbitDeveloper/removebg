import { removeBg } from "./bgremover.js";
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
  compareMount: document.getElementById("compareMount"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  error: document.getElementById("error"),
  errorText: document.getElementById("errorText"),
  retryBtn: document.getElementById("retryBtn"),
};

const state = { originalUrl: null, resultUrl: null, fileName: "image" };

function show(section) {
  for (const s of [els.dropzone, els.processing, els.result, els.error]) s.hidden = true;
  section.hidden = false;
}

function revokeUrls() {
  if (state.originalUrl) URL.revokeObjectURL(state.originalUrl);
  if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  state.originalUrl = state.resultUrl = null;
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

  revokeUrls();
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
    renderResult();
  } catch (e) {
    console.error("[removebg] 처리 실패:", e);
    fail("배경 제거에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

function renderResult() {
  els.compareMount.innerHTML = "";
  mountCompare(els.compareMount, state.originalUrl, state.resultUrl);
  els.downloadBtn.href = state.resultUrl;
  els.downloadBtn.download = `${state.fileName}-removebg.png`;
  show(els.result);
}

function reset() {
  revokeUrls();
  els.fileInput.value = "";
  show(els.dropzone);
}

// events
els.pickBtn.addEventListener("click", (e) => { e.stopPropagation(); els.fileInput.click(); });
els.dropzone.addEventListener("click", (e) => {
  if (e.target === els.pickBtn) return;
  els.fileInput.click();
});
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
els.resetBtn.addEventListener("click", reset);
els.retryBtn.addEventListener("click", reset);

console.log("[removebg] app ready");
