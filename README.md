# 🪄 removebg — 브라우저 배경 제거 툴

이미지를 올리면 **브라우저 안에서** AI로 배경을 제거해 투명 PNG로 저장합니다.
서버 전송 없이 로컬에서만 처리되어 개인정보에 안전합니다.

👉 **바로 사용하기: https://blackrabbitdeveloper.github.io/removebg/**

## ✨ 기능

- 드래그&드롭 / 클릭 업로드
- 브라우저 내 AI 배경 제거 (오프라인·무료·API 키 불필요)
- **브러시 보정**: 복원 브러시(지워진 곳 되살리기) / 지우개 브러시(남은 곳 지우기), 크기·강도 조절, 되돌리기·다시실행(Ctrl+Z)
- Before/After 비교 슬라이더
- 투명 PNG 다운로드

## 🛠 기술

- 무빌드 정적 사이트 (HTML / CSS / Vanilla ES Modules)
- 배경 제거: [@imgly/background-removal](https://github.com/imgly/background-removal-js) (ONNX/WASM, CDN 로드)
- 호스팅: GitHub Pages

## 🧩 구조

```
index.html          레이아웃 (업로드 · 처리중 · 결과 · 에러 상태)
css/style.css       다크 테마 · 반응형 · 체커보드 투명 배경
js/bgremover.js     배경 제거 엔진 래퍼 (@imgly, publicPath 고정)
js/editor.js        브러시 편집기 (알파 마스크, 복원/지우개, undo/redo)
js/compare.js       Before/After 슬라이더
js/main.js          업로드·상태전환·편집·다운로드·에러 오케스트레이션
```

## 💻 로컬 실행

```bash
python -m http.server 8123
# 브라우저에서 http://localhost:8123/ 접속
```

## 📝 참고

- **첫 실행 시** AI 모델(수십 MB)을 내려받아 다소 시간이 걸릴 수 있습니다. 이후에는 브라우저에 캐시되어 빨라집니다.
- 이미지는 어떤 서버로도 전송되지 않고 브라우저에서만 처리됩니다.
- 인물·제품 등 주요 피사체가 뚜렷한 이미지에서 품질이 가장 좋습니다.

## 📄 라이선스

- 앱 코드: MIT
- 배경 제거 모델/라이브러리는 [@imgly/background-removal](https://github.com/imgly/background-removal-js)의 라이선스를 따릅니다.
