/*
  【文件职责】     把宿主指针与 wheel 事件映射到 object-contain 的真实远端内容区域。
  【架构位置】     L3
  【主要导出】     mapBrowserPoint · normalizeBrowserWheel
  【依赖关系】     无
  【边界与注意】   letterbox 外返回 null；不把宿主面板尺寸误当远端 viewport。
*/

export interface BrowserContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BrowserPointInput {
  clientX: number;
  clientY: number;
  rect: BrowserContentRect;
  naturalWidth: number;
  naturalHeight: number;
}

export interface BrowserNormalizedPoint {
  nx: number;
  ny: number;
}

export function mapBrowserPoint({
  clientX,
  clientY,
  rect,
  naturalWidth,
  naturalHeight,
}: BrowserPointInput): BrowserNormalizedPoint | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return null;
  }
  const scale = Math.min(
    rect.width / naturalWidth,
    rect.height / naturalHeight,
  );
  const contentWidth = naturalWidth * scale;
  const contentHeight = naturalHeight * scale;
  const offsetX = (rect.width - contentWidth) / 2;
  const offsetY = (rect.height - contentHeight) / 2;
  const x = clientX - rect.left - offsetX;
  const y = clientY - rect.top - offsetY;
  if (x < 0 || y < 0 || x > contentWidth || y > contentHeight) return null;
  return { nx: x / contentWidth, ny: y / contentHeight };
}

export function normalizeBrowserWheel({
  deltaX,
  deltaY,
  deltaMode,
}: {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}): { dx: number; dy: number } {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1;
  const normalize = (value: number) => {
    const pixels = value * unit;
    return Math.abs(pixels) < 0.25 ? 0 : pixels * 2;
  };
  return { dx: normalize(deltaX), dy: normalize(deltaY) };
}

/** Normalize units before batching; deadzone/gain belong to the accumulated frame. */
export function browserWheelPixels({
  deltaX,
  deltaY,
  deltaMode,
}: {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}): { dx: number; dy: number } {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1;
  return { dx: deltaX * unit, dy: deltaY * unit };
}
