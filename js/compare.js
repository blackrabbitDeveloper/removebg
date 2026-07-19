// Before/After 비교 슬라이더.
// 바닥=결과(투명, 체커보드 위), 오버레이(왼쪽)=원본. 핸들을 드래그해 비교.
// 결과를 바닥에 둬야 투명 영역에서 체커보드가 보인다.
export function mountCompare(mount, originalUrl, resultUrl) {
  mount.classList.add("checker");
  mount.innerHTML = `
    <img class="compare__img compare__img--base" src="${resultUrl}" alt="배경 제거 결과" draggable="false" />
    <div class="compare__top">
      <img class="compare__img" src="${originalUrl}" alt="원본" draggable="false" />
    </div>
    <div class="compare__divider"><div class="compare__handle">⇄</div></div>
    <span class="compare__label compare__label--left">원본</span>
    <span class="compare__label compare__label--right">결과</span>
  `;
  const base = mount.querySelector(".compare__img--base");
  const top = mount.querySelector(".compare__top");
  const topImg = top.querySelector(".compare__img");
  const divider = mount.querySelector(".compare__divider");

  // 결과 이미지를 컨테이너 전체 폭에 고정 → 원본과 픽셀 단위로 정렬.
  const syncWidth = () => { topImg.style.width = `${mount.clientWidth}px`; };
  if (base.complete) syncWidth();
  base.addEventListener("load", syncWidth);
  window.addEventListener("resize", syncWidth);

  const setPos = (clientX) => {
    const rect = mount.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.min(1, Math.max(0, ratio));
    const pct = ratio * 100;
    top.style.width = `${pct}%`;
    divider.style.left = `${pct}%`;
  };

  let dragging = false;
  divider.addEventListener("pointerdown", (e) => { dragging = true; e.preventDefault(); });
  window.addEventListener("pointerup", () => { dragging = false; });
  window.addEventListener("pointermove", (e) => { if (dragging) setPos(e.clientX); });
  // 컨테이너 아무 곳이나 눌러도 그 위치로 이동
  mount.addEventListener("pointerdown", (e) => setPos(e.clientX));

  // 초기 위치: 가운데
  requestAnimationFrame(() => {
    const rect = mount.getBoundingClientRect();
    setPos(rect.left + rect.width / 2);
  });
}
