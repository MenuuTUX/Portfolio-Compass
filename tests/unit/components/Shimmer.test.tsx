import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import Shimmer from "@/components/workspace/Shimmer";

afterEach(cleanup);

describe("Shimmer", () => {
  it("is hidden from assistive tech and carries no inline animation state", () => {
    const { container } = render(<Shimmer className="h-3 w-16" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.style.backgroundPosition).toBe("");
  });
});
