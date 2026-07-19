// @imgly/background-removal 캡슐화 래퍼.
// 입력: Blob | File | image URL, 진행률 콜백(0~1 비율 + 라벨)
// 출력: 투명 PNG Blob
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

// 모델/WASM 에셋 경로. jsDelivr의 +esm 번들은 기본 publicPath의 ${PACKAGE_VERSION}을
// 치환하지 못해 경로가 깨지므로, 반드시 명시적으로 고정한다(끝 슬래시 필수).
const PUBLIC_PATH =
  "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

/**
 * 이미지의 배경을 제거해 투명 PNG Blob을 반환한다.
 * @param {Blob|File|string} input
 * @param {(ratio:number, label:string)=>void} onProgress  진행률 0~1
 * @returns {Promise<Blob>} 투명 PNG Blob
 */
export async function removeBg(input, onProgress = () => {}) {
  const config = {
    publicPath: PUBLIC_PATH,
    model: "isnet_fp16", // 품질/속도 균형
    output: { format: "image/png" },
    progress: (key, current, total) => {
      const ratio = total > 0 ? current / total : 0;
      const label = key.startsWith("fetch") ? "AI 모델 준비 중…" : "배경 제거 중…";
      onProgress(ratio, label);
    },
  };
  return await removeBackground(input, config);
}
