import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentionPopupPlacement } from "@/core/mentions/popup-placement";

function bounds(element: HTMLElement, top: number, bottom: number, border = 0) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top,
    bottom,
  } as DOMRect);
  Object.defineProperty(element, "clientTop", {
    configurable: true,
    value: border,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: bottom - top - border * 2,
  });
}
function fixture() {
  const clip = document.createElement("main"),
    root = document.createElement("div"),
    popup = document.createElement("div");
  document.body.append(clip);
  clip.append(root);
  root.append(popup);
  bounds(clip, 120, 800);
  bounds(root, 300, 780);
  popup.style.marginBottom = "8px";
  return { clip, root, popup };
}
beforeEach(() => vi.stubGlobal("innerHeight", 800));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("reference popup visible native bounds", () => {
  it("preserves the existing desktop viewport gap", () => {
    const { root, popup } = fixture();
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: true,
      inline: false,
      maxHeight: 288,
    });
  });
  it.each(["auto", "scroll", "hidden", "clip"])(
    "respects %s ancestors instead of allowing negative overflow under the header",
    (overflow) => {
      const { clip, root, popup } = fixture();
      clip.style.overflowY = overflow;
      expect(getMentionPopupPlacement(root, popup)).toEqual({
        above: true,
        inline: false,
        maxHeight: 168,
      });
    },
  );
  it("reads current breakpoint clipping instead of retaining the desktop set", () => {
    const { clip, root, popup } = fixture();
    expect(getMentionPopupPlacement(root, popup).maxHeight).toBe(288);
    clip.style.overflowY = "auto";
    expect(getMentionPopupPlacement(root, popup).maxHeight).toBe(168);
    clip.style.overflowY = "visible";
    expect(getMentionPopupPlacement(root, popup).maxHeight).toBe(288);
  });
  it("accounts for the enlarged rem margin and ancestor border", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    bounds(clip, 120, 800, 2);
    popup.style.marginBottom = "16px";
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: true,
      inline: false,
      maxHeight: 158,
    });
  });
  it("chooses below when that is the larger visible region", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    bounds(root, 150, 200);
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: false,
      inline: false,
      maxHeight: 588,
    });
  });
  it("does not manufacture a 100px popup when both sides are clipped", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    bounds(root, 100, 900);
    expect(getMentionPopupPlacement(root, popup).maxHeight).toBe(0);
  });
  it("intersects nested clipping regions with the visual viewport", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    const outer = document.createElement("div");
    clip.before(outer);
    outer.append(clip);
    outer.style.overflowY = "hidden";
    bounds(outer, 100, 700);
    vi.stubGlobal("visualViewport", {
      offsetTop: 150,
      height: 400,
    } as VisualViewport);
    bounds(root, 300, 450);
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: true,
      inline: false,
      maxHeight: 138,
    });
  });
  it("uses the native flow when neither anchor side can contain a real option", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    bounds(clip, 0, 360);
    bounds(root, 120, 590);
    popup.style.marginBottom = "16px";
    const option = document.createElement("button");
    popup.append(option);
    Object.defineProperty(option, "offsetHeight", { value: 104 });
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: true,
      inline: true,
      maxHeight: 352,
    });
  });
  it("bounds flow by the real clipped viewport and restores anchored layout when a side fits", () => {
    const { clip, root, popup } = fixture();
    clip.style.overflowY = "auto";
    bounds(clip, 60, 360);
    bounds(root, 120, 590);
    popup.style.marginBottom = "16px";
    const option = document.createElement("button");
    popup.append(option);
    Object.defineProperty(option, "offsetHeight", { value: 104 });
    expect(getMentionPopupPlacement(root, popup)).toMatchObject({
      inline: true,
      maxHeight: 292,
    });
    bounds(root, 220, 700);
    expect(getMentionPopupPlacement(root, popup)).toEqual({
      above: true,
      inline: false,
      maxHeight: 140,
    });
  });
});
