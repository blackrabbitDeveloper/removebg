# removebg 툴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages에서 동작하는, 브라우저 내 AI로 이미지 배경을 제거하고 투명 PNG로 저장하는 무빌드 정적 웹 툴.

**Architecture:** 무빌드 정적 SPA. `@imgly/background-removal`을 CDN ESM으로 로드해 브라우저에서 배경 제거. 3개 JS 모듈로 책임 분리(엔진 래퍼 / 슬라이더 / 오케스트레이션). 저장소 루트에서 Pages로 서빙.

**Tech Stack:** HTML5, CSS3(다크 테마), Vanilla ES Modules, `@imgly/background-removal`(WASM/ONNX, CDN)

> **테스트 전략 주의:** 브라우저 ML·DOM 중심 툴이라 단위 테스트 프레임워크 대신 **로컬 정적 서버 + 실제 Chrome(브라우저 자동화)로 end-to-end 검증**을 각 태스크의 검증 단계로 사용한다. 각 태스크는 "동작하는 증거"를 브라우저에서 확인한 뒤 커밋한다.

---

## 파일 구조

| 파일 | 책임 |
|------|------|
| `index.html` | 레이아웃/마크업. 상태 컨테이너(업로드/처리중/결과/에러) |
| `css/style.css` | 다크 테마, 반응형, 체커보드 투명 배경, 슬라이더 스타일 |
| `js/bgremover.js` | `@imgly` `removeBackground` 캡슐화. 입력 Blob→출력 투명 PNG Blob + 진행률 |
| `js/compare.js` | Before/After 슬라이더. 원본 URL + 결과 URL → 드래그 비교 DOM |
| `js/main.js` | 오케스트레이션: 업로드·상태전환·에러·다운로드·리셋 |
| `assets/` | 파비콘, 샘플 이미지 |
| `README.md` | 소개·사용법·출처/라이선스 |

---

## Task 1: HTML 레이아웃 + 스타일 스켈레톤

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>배경 제거 — removebg</title>
  <meta name="description" content="브라우저에서 바로 이미지 배경을 제거하는 무료 툴. 이미지는 서버로 전송되지 않습니다." />
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main class="app">
    <header class="app__header">
      <h1 class="app__title">🪄 배경 제거</h1>
      <p class="app__subtitle">이미지를 올리면 브라우저에서 바로 배경을 지워드려요.</p>
    </header>

    <!-- (a) 업로드 대기 -->
    <section id="dropzone" class="dropzone" aria-label="이미지 업로드 영역">
      <input id="fileInput" type="file" accept="image/*" hidden />
      <div class="dropzone__inner">
        <div class="dropzone__icon">⬆️</div>
        <p class="dropzone__text">이미지를 여기로 끌어다 놓거나 클릭해서 선택하세요</p>
        <button id="pickBtn" type="button" class="btn btn--primary">이미지 선택</button>
        <p class="dropzone__hint">PNG · JPG · WEBP · 최대 25MB</p>
      </div>
    </section>

    <!-- (b) 처리 중 -->
    <section id="processing" class="panel" hidden>
      <div class="spinner" aria-hidden="true"></div>
      <p id="progressText" class="panel__text">배경 제거 중…</p>
      <div class="progress"><div id="progressBar" class="progress__bar"></div></div>
      <p class="panel__hint">첫 실행에는 AI 모델(수십 MB)을 내려받아 시간이 걸릴 수 있어요.</p>
    </section>

    <!-- (c) 결과 -->
    <section id="result" class="panel" hidden>
      <div id="compareMount" class="compare"></div>
      <div class="actions">
        <a id="downloadBtn" class="btn btn--primary" download>PNG 다운로드</a>
        <button id="resetBtn" type="button" class="btn btn--ghost">다른 이미지</button>
      </div>
    </section>

    <!-- (d) 에러 -->
    <section id="error" class="panel panel--error" hidden>
      <p id="errorText" class="panel__text">문제가 발생했어요.</p>
      <button id="retryBtn" type="button" class="btn btn--ghost">다시 시도</button>
    </section>

    <footer class="app__footer">
      <p>🔒 이미지는 서버로 전송되지 않고 브라우저에서만 처리됩니다.</p>
    </footer>
  </main>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `css/style.css` 작성**

```css
:root {
  --bg: #0f1216;
  --surface: #171b21;
  --surface-2: #1f242c;
  --border: #2a313b;
  --text: #e6e9ee;
  --muted: #9aa4b2;
  --primary: #6c8cff;
  --primary-hover: #869dff;
  --danger: #ff6b6b;
  --radius: 14px;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  line-height: 1.5;
}
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 20px 64px;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.app__header { text-align: center; }
.app__title { font-size: 2rem; margin: 0 0 8px; }
.app__subtitle { color: var(--muted); margin: 0; }

/* dropzone */
.dropzone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.dropzone.is-drag { border-color: var(--primary); background: var(--surface-2); }
.dropzone__icon { font-size: 2.5rem; }
.dropzone__text { margin: 12px 0; }
.dropzone__hint { color: var(--muted); font-size: .85rem; margin: 12px 0 0; }

/* panels */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 24px;
  text-align: center;
}
.panel--error { border-color: var(--danger); }
.panel__text { margin: 0 0 8px; }
.panel__hint { color: var(--muted); font-size: .85rem; margin: 12px 0 0; }

/* progress */
.progress { height: 8px; background: var(--surface-2); border-radius: 999px; overflow: hidden; margin: 16px auto 0; max-width: 320px; }
.progress__bar { height: 100%; width: 0%; background: var(--primary); transition: width .2s; }
.spinner {
  width: 40px; height: 40px; margin: 0 auto 16px;
  border: 4px solid var(--surface-2); border-top-color: var(--primary);
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* buttons */
.btn {
  display: inline-block; border: none; border-radius: 10px;
  padding: 12px 20px; font-size: 1rem; font-weight: 600;
  cursor: pointer; text-decoration: none; transition: background .15s, transform .05s;
}
.btn:active { transform: translateY(1px); }
.btn--primary { background: var(--primary); color: #0b0e13; }
.btn--primary:hover { background: var(--primary-hover); }
.btn--ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn--ghost:hover { background: var(--surface-2); }
.actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }

/* compare / checkerboard */
.compare { position: relative; width: 100%; border-radius: 10px; overflow: hidden; user-select: none; touch-action: none; }
.checker {
  background-image:
    linear-gradient(45deg, #2a313b 25%, transparent 25%),
    linear-gradient(-45deg, #2a313b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a313b 75%),
    linear-gradient(-45deg, transparent 75%, #2a313b 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  background-color: #232830;
}

.app__footer { text-align: center; color: var(--muted); font-size: .85rem; margin-top: auto; }

@media (max-width: 480px) {
  .app { padding: 28px 14px 40px; }
  .app__title { font-size: 1.6rem; }
}
```

- [ ] **Step 3: 로컬 서버로 렌더 확인 (검증)**

Run: 저장소 루트에서 `python -m http.server 8123` (백그라운드)
브라우저 자동화로 `http://localhost:8123/` 접속.
Expected: 헤더/드롭존/푸터가 다크 테마로 보이고 콘솔 에러 없음(단, `main.js`는 아직 없어 404 → Task 2에서 생성).

- [ ] **Step 4: 파비콘 추가** — `assets/favicon.svg`

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#6c8cff"/><text x="16" y="22" font-size="18" text-anchor="middle">✂️</text></svg>
```

- [ ] **Step 5: 커밋**

```bash
git add index.html css/style.css assets/favicon.svg
git commit -m "feat: add static layout and dark theme skeleton"
```

---

## Task 2: 배경 제거 엔진 래퍼 (`js/bgremover.js`)

**Files:**
- Create: `js/bgremover.js`
- Create(임시): `js/main.js` (Task 3에서 확장; 여기선 스모크 테스트용 최소본)

> **CDN URL 검증 주의:** `@imgly/background-removal`은 WASM/ONNX 에셋을 런타임에 내려받는다. 1순위로 jsDelivr `+esm`, 실패 시 `https://esm.sh/@imgly/background-removal`로 교체한다. 에셋은 라이브러리 기본 `publicPath`(staticimgly.com)에서 받으며, 필요 시 `publicPath`를 data 패키지 CDN으로 명시한다. 구현 중 반드시 브라우저에서 실제 로드를 확인할 것.

- [ ] **Step 1: `js/bgremover.js` 작성**

```js
// @imgly/background-removal 캡슐화 래퍼.
// 입력: Blob | File | image URL, 진행률 콜백
// 출력: 투명 PNG Blob
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/+esm";

/**
 * @param {Blob|File|string} input
 * @param {(ratio:number, label:string)=>void} onProgress  0~1 비율
 * @returns {Promise<Blob>} 투명 PNG Blob
 */
export async function removeBg(input, onProgress = () => {}) {
  const config = {
    model: "isnet_fp16",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      const ratio = total > 0 ? current / total : 0;
      const label = key.startsWith("fetch") ? "AI 모델 준비 중…" : "배경 제거 중…";
      onProgress(ratio, label);
    },
  };
  return await removeBackground(input, config);
}
```

- [ ] **Step 2: 스모크 테스트용 최소 `js/main.js`**

```js
import { removeBg } from "./bgremover.js";
window.__removeBg = removeBg; // 브라우저 콘솔 검증용
console.log("[removebg] modules loaded");
```

- [ ] **Step 3: 모듈 로드 검증 (검증)**

Run: `http://localhost:8123/` 재접속, 콘솔 확인.
Expected: `[removebg] modules loaded` 출력, import 관련 콘솔 에러 없음.
(만약 `+esm` import 실패 시 → `https://esm.sh/@imgly/background-removal@1.6.0`로 교체 후 재확인.)

- [ ] **Step 4: 실제 배경 제거 스모크 테스트 (검증)**

브라우저 콘솔에서 샘플 이미지 URL 또는 업로드 blob으로 `await window.__removeBg(<blob>)` 실행,
반환이 `Blob`(type `image/png`)인지 확인. 진행률 콜백이 여러 번 호출되는지 로그로 확인.

- [ ] **Step 5: 커밋**

```bash
git add js/bgremover.js js/main.js
git commit -m "feat: add @imgly background-removal wrapper module"
```

---

## Task 3: 업로드 → 처리 → 결과 흐름 (`js/main.js` 확장)

**Files:**
- Modify: `js/main.js` (전체 재작성)

- [ ] **Step 1: `js/main.js` 작성 (상태 전환 + 업로드 + 처리)**

```js
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

let state = { originalUrl: null, resultUrl: null, fileName: "image" };

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
els.pickBtn.addEventListener("click", () => els.fileInput.click());
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
```

- [ ] **Step 2: 업로드 흐름 검증 (검증)**

브라우저 자동화로 `fileInput`에 샘플 이미지 업로드 → 처리중 패널(진행률 상승) → 결과 패널 노출.
Expected: 결과 이미지가 체커보드 위 투명 PNG로 표시(다음 Task의 compare로 완성). 콘솔 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add js/main.js
git commit -m "feat: wire upload, processing, and result flow"
```

---

## Task 4: Before/After 슬라이더 (`js/compare.js`)

**Files:**
- Create: `js/compare.js`

- [ ] **Step 1: `js/compare.js` 작성**

```js
// Before/After 비교 슬라이더.
// 왼쪽(구분선 기준)=결과(투명), 오른쪽=원본. 핸들을 드래그해 비교.
export function mountCompare(mount, originalUrl, resultUrl) {
  mount.classList.add("checker");
  mount.innerHTML = `
    <img class="compare__img compare__img--base" src="${originalUrl}" alt="원본" draggable="false" />
    <div class="compare__top">
      <img class="compare__img" src="${resultUrl}" alt="배경 제거 결과" draggable="false" />
    </div>
    <div class="compare__divider"><div class="compare__handle">⇄</div></div>
    <span class="compare__label compare__label--left">결과</span>
    <span class="compare__label compare__label--right">원본</span>
  `;
  const top = mount.querySelector(".compare__top");
  const divider = mount.querySelector(".compare__divider");

  const setPos = (clientX) => {
    const rect = mount.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.min(1, Math.max(0, ratio));
    const pct = ratio * 100;
    top.style.width = `${pct}%`;
    divider.style.left = `${pct}%`;
  };

  let dragging = false;
  const start = () => (dragging = true);
  const end = () => (dragging = false);
  const move = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setPos(x);
  };

  divider.addEventListener("pointerdown", start);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointermove", move);
  // 초기 위치: 가운데
  requestAnimationFrame(() => {
    const rect = mount.getBoundingClientRect();
    setPos(rect.left + rect.width / 2);
  });
}
```

- [ ] **Step 2: 슬라이더 스타일 추가 → `css/style.css` 하단에 append**

```css
.compare__img { display: block; width: 100%; height: auto; }
.compare__img--base { display: block; }
.compare__top { position: absolute; top: 0; left: 0; height: 100%; width: 50%; overflow: hidden; }
.compare__top .compare__img { position: absolute; top: 0; left: 0; height: 100%; width: auto; max-width: none; }
.compare__divider { position: absolute; top: 0; left: 50%; height: 100%; width: 2px; background: var(--primary); transform: translateX(-1px); cursor: ew-resize; }
.compare__handle {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: #0b0e13;
  display: grid; place-items: center; font-size: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
.compare__label {
  position: absolute; bottom: 8px; padding: 2px 8px; font-size: .75rem; border-radius: 6px;
  background: rgba(0,0,0,.55); color: #fff; pointer-events: none;
}
.compare__label--left { left: 8px; }
.compare__label--right { right: 8px; }
```

> **주의(레이아웃):** `.compare__top .compare__img`의 `width:auto`만으로는 원본과 폭이 어긋날 수 있다. 구현 시 결과 이미지 폭을 컨테이너 실제 픽셀폭(`mount.clientWidth`)으로 고정하도록 `setPos`/마운트에서 `img.style.width = mount.clientWidth + "px"`를 적용해 두 이미지 픽셀 정합을 맞춘다. 브라우저에서 정합을 눈으로 확인할 것.

- [ ] **Step 3: 슬라이더 동작 검증 (검증)**

업로드→결과 후, 핸들을 좌우로 드래그(포인터 이벤트)했을 때 결과/원본이 자연스럽게 전환되는지,
두 이미지가 픽셀 단위로 정렬되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add js/compare.js css/style.css
git commit -m "feat: add before/after comparison slider"
```

---

## Task 5: 에러 케이스 · 다운로드 · 리셋 마무리 검증

**Files:** (코드 변경 없으면 검증만)

- [ ] **Step 1: 비이미지 파일 업로드 → 에러 패널 확인**
- [ ] **Step 2: 다운로드 버튼 → `*-removebg.png` 저장 확인**
- [ ] **Step 3: "다른 이미지"/"다시 시도" → 초기 상태 복귀 확인**
- [ ] **Step 4: 필요 시 수정 후 커밋**

```bash
git add -A
git commit -m "fix: polish error, download, and reset behavior"
```

---

## Task 6: README + 최종 점검

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md` 작성**

```markdown
# 🪄 removebg — 브라우저 배경 제거 툴

이미지를 올리면 **브라우저 안에서** AI로 배경을 제거해 투명 PNG로 저장합니다.
서버 전송 없이 로컬에서만 처리되어 개인정보에 안전합니다.

👉 **사용하기: https://blackrabbitdeveloper.github.io/removebg/**

## 기능
- 드래그&드롭 / 클릭 업로드
- 브라우저 내 AI 배경 제거 (오프라인·무료)
- Before/After 비교 슬라이더
- 투명 PNG 다운로드

## 기술
- 무빌드 정적 사이트 (HTML/CSS/Vanilla ES Modules)
- 배경 제거: [@imgly/background-removal](https://github.com/imgly/background-removal-js)
- 호스팅: GitHub Pages

## 로컬 실행
```bash
python -m http.server 8123
# http://localhost:8123/
```

## 참고
- 첫 실행 시 AI 모델(수십 MB)을 내려받아 다소 시간이 걸릴 수 있습니다(이후 캐시).
```

- [ ] **Step 2: 반응형/모바일 뷰 확인 (검증)** — 좁은 화면에서 레이아웃 깨짐 없는지.

- [ ] **Step 3: 커밋**

```bash
git add README.md
git commit -m "docs: add project README"
```

---

## Task 7: 배포 (GitHub Pages)

- [ ] **Step 1: main push**

```bash
git push -u origin main
```

- [ ] **Step 2: Pages 활성화 (gh API)**

```bash
gh api -X POST repos/blackrabbitDeveloper/removebg/pages \
  -f source[branch]=main -f source[path]=/ 2>&1 || \
gh api -X PUT repos/blackrabbitDeveloper/removebg/pages \
  -f source[branch]=main -f source[path]=/
```

- [ ] **Step 3: 배포 URL 검증 (검증)**

몇 분 후 `https://blackrabbitdeveloper.github.io/removebg/` 접속,
실제 배경 제거 end-to-end 동작 확인.

---

## Self-Review 결과

- **스펙 커버리지:** 엔진(Task 2)·업로드/제거/다운로드(Task 3,5)·슬라이더(Task 4)·한국어 UI(전 태스크)·에러(Task 3,5)·배포(Task 7)·개인정보 안내(Task 1) 모두 대응. ✅
- **플레이스홀더:** 없음. 모든 코드 블록은 실제 구현 코드. ✅
- **타입/이름 일관성:** `removeBg`(bgremover)·`mountCompare`(compare)·`els`/`state`(main) 이름이 태스크 간 일치. ✅
- **알려진 리스크:** ① CDN import URL — `+esm` 실패 시 `esm.sh` fallback 명시. ② 슬라이더 이미지 픽셀 정합 — Task4 주의 문구로 대응. 구현 중 브라우저 검증 필수.
