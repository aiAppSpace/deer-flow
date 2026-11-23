/** Happy DOM lacks native capture. Only the platform boundary is supplied here. */
export function installPointerCaptureFixture() {
  const prototype = HTMLElement.prototype;
  const names = [
    "setPointerCapture",
    "hasPointerCapture",
    "releasePointerCapture",
  ] as const;
  const previous = names.map(
    (name) => [name, Object.getOwnPropertyDescriptor(prototype, name)] as const,
  );
  const captures = new Map<number, HTMLElement>();
  const releases: number[] = [];
  Object.defineProperties(prototype, {
    setPointerCapture: {
      configurable: true,
      value(this: HTMLElement, id: number) {
        captures.set(id, this);
      },
    },
    hasPointerCapture: {
      configurable: true,
      value(this: HTMLElement, id: number) {
        return captures.get(id) === this;
      },
    },
    releasePointerCapture: {
      configurable: true,
      value(this: HTMLElement, id: number) {
        if (captures.get(id) !== this) return;
        captures.delete(id);
        releases.push(id);
        this.dispatchEvent(
          new PointerEvent("lostpointercapture", { pointerId: id }),
        );
      },
    },
  });
  return {
    captures,
    releases,
    restore() {
      captures.clear();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(prototype, name, descriptor);
        else Reflect.deleteProperty(prototype, name);
      }
    },
  };
}
