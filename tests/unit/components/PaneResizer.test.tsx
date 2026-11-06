import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PaneResizer, useResizableWidth } from "@/components/workspace/PaneResizer";

const renderCount = { value: 0 };

function Harness({ min = 200, max = 300 }: { min?: number; max?: number }) {
  const { paneRef, width, setWidth, persist, setDragging, reset } = useResizableWidth("pane-test", 276, min, () => max);
  return (
    <div>
      <div data-testid="pane" ref={paneRef} style={{ width: `${width}px` }} />
      <PaneResizer
        label="Resize test pane"
        width={width}
        direction={1}
        onResize={setWidth}
        onCommit={persist}
        onDraggingChange={setDragging}
        onReset={reset}
        valueMin={min}
        valueMax={max}
      />
    </div>
  );
}

/** Counts commits of everything inside it, outside render so the hooks lint rule is satisfied. */
function Counted({ children }: { children: React.ReactNode }) {
  return <React.Profiler id="pane" onRender={() => { renderCount.value += 1; }}>{children}</React.Profiler>;
}

const handle = () => screen.getByRole("separator", { name: "Resize test pane" });

beforeEach(() => {
  renderCount.value = 0;
  localStorage.clear();
  // happy-dom may not implement pointer capture; the resizer only needs it to be callable.
  const proto = HTMLElement.prototype as unknown as { setPointerCapture?: () => void };
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
});

afterEach(cleanup);

describe("PaneResizer accessibility", () => {
  it("exposes the current, minimum and maximum width", () => {
    render(<Counted><Harness /></Counted>);
    const el = handle();
    expect(el.getAttribute("aria-valuenow")).toBe("276");
    expect(el.getAttribute("aria-valuemin")).toBe("200");
    expect(el.getAttribute("aria-valuemax")).toBe("300");
  });
});

describe("PaneResizer keyboard", () => {
  it("clamps ArrowRight at the maximum", () => {
    render(<Counted><Harness /></Counted>);
    for (let i = 0; i < 10; i += 1) fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(handle().getAttribute("aria-valuenow")).toBe("300");
  });

  it("clamps ArrowLeft at the minimum", () => {
    render(<Counted><Harness /></Counted>);
    for (let i = 0; i < 10; i += 1) fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(handle().getAttribute("aria-valuenow")).toBe("200");
  });
});

describe("PaneResizer drag", () => {
  it("writes the width to the pane while dragging and commits on pointer up", () => {
    render(<Counted><Harness max={400} /></Counted>);
    const el = handle();

    act(() => {
      fireEvent.pointerDown(el, { clientX: 100, pointerId: 1 });
    });
    const rendersAtStart = renderCount.value;

    act(() => {
      fireEvent.pointerMove(el, { clientX: 130, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 150, pointerId: 1 });
    });

    expect(screen.getByTestId("pane").style.width).toBe("326px");
    expect(el.getAttribute("aria-valuenow")).toBe("276");
    expect(renderCount.value).toBe(rendersAtStart);

    act(() => {
      fireEvent.pointerUp(el, { clientX: 150, pointerId: 1 });
    });
    expect(el.getAttribute("aria-valuenow")).toBe("326");
    expect(screen.getByTestId("pane").style.width).toBe("326px");
    expect(localStorage.getItem("pc:pane-width:pane-test")).toBe("326");
  });

  it("clamps the dragged width to the maximum", () => {
    render(<Counted><Harness max={300} /></Counted>);
    const el = handle();
    act(() => {
      fireEvent.pointerDown(el, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 400, pointerId: 1 });
      fireEvent.pointerUp(el, { clientX: 400, pointerId: 1 });
    });
    expect(el.getAttribute("aria-valuenow")).toBe("300");
  });
});
