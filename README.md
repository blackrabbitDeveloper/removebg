<div align="center">

# Background Remover

AI로 이미지 배경을 지우고 브러시로 결과를 다듬습니다.

[![Open App](https://img.shields.io/badge/Open_App-E8795A?style=for-the-badge&logo=googlechrome&logoColor=white)](https://blackrabbitdeveloper.github.io/removebg/)
[![Local First](https://img.shields.io/badge/Processing-Local_First-248A5A?style=for-the-badge)](#개인정보)

</div>

> 서버 업로드나 API 키 없이 브라우저에서 동작하는 BlackRabbit Utils의 AI 이미지 도구입니다.

## 주요 기능

- 드래그 앤 드롭 이미지 선택
- 브라우저 내 AI 배경 제거
- 복원 및 지우개 브러시와 실행 취소·다시 실행
- 원본과 결과 비교 슬라이더
- 투명 PNG 다운로드
- Dark/Light 공통 테마와 반응형 UI

## 사용법

1. [Background Remover](https://blackrabbitdeveloper.github.io/removebg/)를 엽니다.
2. PNG, JPEG 또는 WebP 이미지를 선택합니다.
3. AI 처리 후 브러시로 마스크를 다듬습니다.
4. 투명 PNG로 저장합니다.

## 로컬 실행

```bash
npx serve . -l 8123
```

브라우저에서 <http://localhost:8123>을 엽니다. 첫 실행에는 AI 모델 다운로드로 시간이 걸릴 수 있습니다.

## 기술

- Vanilla HTML, CSS, JavaScript ES Modules
- `@imgly/background-removal`과 ONNX/WASM
- GitHub Pages

## 개인정보

이미지와 편집 결과는 별도 서버로 전송되지 않습니다. 배경 제거 모델은 CDN에서 내려받아 브라우저에서 실행합니다.

## 라이선스

- 애플리케이션 코드: [MIT](LICENSE)
- 배경 제거 모델 및 라이브러리: `@imgly/background-removal` 라이선스 적용
