import { afterEach, describe, expect, it, rs, rstest } from "@rstest/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const emitted: unknown[] = [];
rs.mock("canvas-confetti", () => ({
  default: (options: unknown) => {
    emitted.push(options);
  },
}));

import { Shimmer } from "@/components/ai-elements/shimmer";
import { AuroraText } from "@/components/ui/aurora-text";
import { ConfettiButton } from "@/components/ui/confetti-button";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

/*
  `prefers-reduced-motion: reduce` is a user request, not a hint. Three
  product-surface animations ignored it until 2026-09-08 while the Vue app
  honored all three — the workspace welcome heading (AuroraText), the composer's
  confetti (ConfettiButton), and the login/setup backdrop (FlickeringGrid).

  The hook was already there and already used twice (`chat-box`,
  `markdown-content`); these three simply never called it. Nothing in the suite
  said they had to, which is why the gap survived.

  AuroraText is asserted through its rendered class and stopped position rather
  than by simulating the media query: it is a pure CSS animation, so
  `motion-safe:` is the whole mechanism and jsdom does not run animations. The
  stopped position matters on its own — a 200%-wide gradient parked at the
  initial `0% 0%` shows a different slice of the colors than one parked mid-way,
  and the Vue side parks at `50% 50%`.
*/
afterEach(cleanup);

describe("AuroraText", () => {
  it("only animates when motion is safe, and names where it stops", () => {
    render(<AuroraText>Hello</AuroraText>);
    // The visible copy is aria-hidden; the accessible name comes from sr-only.
    const painted = document.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(painted).not.toBeNull();
    expect(painted!.className).toContain("motion-safe:animate-aurora");
    expect(painted!.className).not.toContain(" animate-aurora");
    expect(painted!.style.backgroundPosition).toBe("50% 50%");
  });

  it("keeps the text readable to assistive tech either way", () => {
    render(<AuroraText>Hello</AuroraText>);
    expect(screen.getByText("Hello", { selector: ".sr-only" })).toBeTruthy();
  });
});

describe("ConfettiButton", () => {
  const setPreference = (reduce: boolean) => {
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion: reduce"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  };

  it("emits nothing when motion is reduced, but still runs onClick", () => {
    setPreference(true);
    emitted.length = 0;
    const onClick = rstest.fn();
    render(<ConfettiButton onClick={onClick}>Go</ConfettiButton>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    // The click still does its job — nothing functional hangs off the animation.
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveLength(0);
  });

  it("emits when the user has expressed no preference", () => {
    setPreference(false);
    emitted.length = 0;
    const onClick = rstest.fn();
    render(<ConfettiButton onClick={onClick}>Go</ConfettiButton>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    // Shape assert: a 0 above has to mean "withheld", not "the mock never ran".
    expect(emitted).toHaveLength(1);
  });
});

describe("FlickeringGrid", () => {
  /*
    jsdom has no 2D context and no layout, so the canvas and the observers are
    stubbed. What is asserted is the only thing that matters here: whether a
    frame loop gets started, and whether the backdrop still gets painted once
    when it does not. Painting matters as much as stopping — a reduced-motion
    branch that simply returns would leave the login page's backdrop blank
    rather than still.
  */
  const install = (reduce: boolean) => {
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion: reduce"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    // `clearRect` is the marker for a grid paint: only `drawGrid` calls it.
    // `fillRect` is not usable on its own — the component's `toRGBA` helper
    // resolves the CSS color through its own 1x1 canvas and fills that, so a
    // fill count is >= 1 even when the grid is never painted. That is exactly
    // how the first version of this test went green against a mutation that
    // removed the paint.
    const clears: number[] = [];
    const frames: number[] = [];
    HTMLCanvasElement.prototype.getContext = (() => ({
      clearRect: () => {
        clears.push(1);
      },
      fillRect: () => undefined,
      set fillStyle(_v: string) {
        /* colors are irrelevant here */
      },
      scale: () => undefined,
      // `toRGBA` resolves the CSS color through a 1x1 canvas read.
      getImageData: () => ({ data: [0, 0, 0, 255] }),
    })) as unknown as HTMLCanvasElement["getContext"];
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames.push(1);
      void cb;
      return frames.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() =>
      undefined) as typeof cancelAnimationFrame;
    class IO {
      constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {
        /* nothing to release */
      }
    }
    globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
    class RO {
      observe() {
        /* size never changes in jsdom */
      }
      disconnect() {
        /* nothing to release */
      }
    }
    globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
    return { clears, frames };
  };

  it("paints once and starts no frame loop when motion is reduced", () => {
    const { clears, frames } = install(true);
    render(<FlickeringGrid width={40} height={40} />);
    expect(frames).toHaveLength(0);
    // Still painted, just not animated.
    expect(clears).toHaveLength(1);
  });

  it("starts a frame loop when the user has expressed no preference", () => {
    const { frames } = install(false);
    render(<FlickeringGrid width={40} height={40} />);
    // Shape assert: the 0 above has to mean "withheld", not "never reached".
    expect(frames.length).toBeGreaterThan(0);
  });
});

describe("Shimmer", () => {
  /*
    `motion/react` does not consult the media query on its own, so this one had
    to ask. It parks on the animation's own `initial` frame rather than dropping
    the gradient: the background is two layers, and the solid
    `--color-muted-foreground` one underneath paints the text on every frame.
    At `100% center` the moving highlight sits off the left edge, so that frame
    — which already appears once per cycle today — shows the words in a plain
    muted color. The status lives in the words; only the sweep is withheld.

    motion does drive its animation under jsdom (measured: 100% -> 75% center
    over 250ms of a 1s linear cycle), so this asserts movement rather than
    configuration.
  */
  const setPreference = (reduce: boolean) => {
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion: reduce"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  };

  const positionAfterAWhile = async (reduce: boolean) => {
    setPreference(reduce);
    const { container } = render(<Shimmer duration={1}>Working</Shimmer>);
    const element = container.firstElementChild as HTMLElement;
    const started = element.style.backgroundPosition;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { started, settled: element.style.backgroundPosition };
  };

  it("stays parked on the readable frame when motion is reduced", async () => {
    const seen = await positionAfterAWhile(true);
    expect(seen.started).toBe("100% center");
    expect(seen.settled).toBe("100% center");
  });

  it("sweeps when the user has expressed no preference", async () => {
    const seen = await positionAfterAWhile(false);
    // Shape assert: the pair above has to mean "held still", not "never ran".
    expect(seen.started).toBe("100% center");
    expect(seen.settled).not.toBe("100% center");
  });
});
