// @vitest-environment jsdom
/** Real column rendering and dnd-kit; only preview, tenant scope, and API dependencies are mocked. */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

vi.mock("@/components/BlockPreview", () => ({
  BlockPreview: ({ block }: any) => <div data-testid={`preview-${block.id}`}><span>{block.data.html}</span></div>,
}));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 11 }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: { blockTemplates: { list: { useQuery: () => ({ data: [], isLoading: false }) } } },
}));

import { SortableBlock as AdminSortableBlock } from "@/pages/admin/LandingPageBuilder";
import { SortableBlock as LmsSortableBlock } from "@/pages/lms/LandingPageBuilder";
import type { Block } from "@/components/BlockPreview";

const sides = ["left", "right"] as const;
const children = (side: "left" | "right"): Block[] => [0, 1, 2].map(index => ({
  id: `${side}-child-${index}`, type: "text", data: { html: `${side} content ${index}`, retained: { side, index } },
}));
function columnBlock(): Block {
  return { id: "columns", type: "column_layout", data: {
    leftBlocks: children("left"), rightBlocks: children("right"), leftRatio: 40, gap: 24,
    retained: { original: true },
  } };
}
function renderColumn(Component: typeof AdminSortableBlock, selectChildren = true, block = columnBlock()) {
  const callbacks = {
    onSelect: vi.fn(), onSelectChildBlock: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(),
    onMoveBlockOutOfColumn: vi.fn(), onMoveChildToOtherColumn: vi.fn(),
    onDeleteChildFromColumn: vi.fn(), onReorderChildInColumn: vi.fn(),
  };
  const onDragStart = vi.fn(), onDragCancel = vi.fn();
  const originalBlock = structuredClone(block);
  const view = render(
    <DndContext onDragStart={onDragStart} onDragCancel={onDragCancel}>
      <SortableContext items={[block.id]} strategy={verticalListSortingStrategy}>
        <Component {...callbacks} block={block} isSelected={false}
          onSelectChildBlock={selectChildren ? callbacks.onSelectChildBlock : undefined} />
      </SortableContext>
    </DndContext>
  );
  const childWrapper = (id: string) => view.getByTestId(`preview-${id}`).parentElement!.parentElement!;
  return { ...view, callbacks, onDragStart, onDragCancel, childWrapper, block, originalBlock };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network denied in column-selection tests"); }));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each([
  ["admin/shared lesson", AdminSortableBlock],
  ["tenant LMS", LmsSortableBlock],
] as const)("%s real SortableBlock child selection", (_module, Component) => {
  it.each(sides)("clicking the %s child wrapper selects only that child", side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const wrapper = view.childWrapper(childId);
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.getAttribute("role")).toBeNull();
    expect(wrapper.getAttribute("data-col-zone")).toBe(`col:columns:${side}`);
    fireEvent.click(wrapper);
    expect(view.callbacks.onSelectChildBlock.mock.calls).toEqual([[childId]]);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.block).toEqual(view.originalBlock);
  });

  it.each(sides)("a nested preview descendant in the %s child cannot select the parent", side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    fireEvent.click(view.getByTestId(`preview-${childId}`).querySelector("span")!);
    expect(view.callbacks.onSelectChildBlock.mock.calls).toEqual([[childId]]);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
  });

  it.each(sides)("the %s child has an always-visible native Edit button outside the original toolbar", side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const wrapper = view.childWrapper(childId);
    const button = within(wrapper).getByRole("button", { name: `Edit block settings ${childId}` });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.textContent).toBe("Edit block settings");
    expect(button.classList.contains("min-h-[44px]")).toBe(true);
    expect(button.closest(".opacity-0")).toBeNull();
    expect(button.hidden).toBe(false);
    expect(button.closest('[role="button"]')).toBeNull();
    expect(within(wrapper).getByTitle("Move out of column")).toBeTruthy();
    expect(within(wrapper).getByTitle("Remove from column")).toBeTruthy();
    fireEvent.click(button);
    expect(view.callbacks.onSelectChildBlock.mock.calls).toEqual([[childId]]);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
  });

  it.each([
    ["left", "{Enter}"], ["right", "{Enter}"], ["left", " "], ["right", " "],
  ] as const)("native keyboard activation selects the %s child with %s", async (side, key) => {
    const user = userEvent.setup();
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const button = view.getByRole("button", { name: `Edit block settings ${childId}` });
    button.focus();
    expect(document.activeElement).toBe(button);
    await user.keyboard(key);
    expect(view.callbacks.onSelectChildBlock.mock.calls).toEqual([[childId]]);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.onDragStart).not.toHaveBeenCalled();
  });

  it.each(sides)("all original %s child action controls retain payloads without selecting", side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const child = within(view.childWrapper(childId));
    fireEvent.click(child.getByTitle("Move to other column"));
    fireEvent.click(child.getByTitle("Move out of column"));
    fireEvent.click(child.getByTitle("Remove from column"));
    fireEvent.click(child.getByTitle("Move up"));
    fireEvent.click(child.getByTitle("Move down"));
    expect(view.callbacks.onMoveChildToOtherColumn.mock.calls).toEqual([["columns", side, childId]]);
    expect(view.callbacks.onMoveBlockOutOfColumn.mock.calls).toEqual([["columns", side, childId]]);
    expect(view.callbacks.onDeleteChildFromColumn.mock.calls).toEqual([["columns", side, childId]]);
    expect(view.callbacks.onReorderChildInColumn.mock.calls).toEqual([
      ["columns", side, childId, "up"], ["columns", side, childId, "down"],
    ]);
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.block).toEqual(view.originalBlock);
  });

  it.each(sides)("%s child drag-handle clicks including its icon select neither child nor parent", side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const handle = within(view.childWrapper(childId)).getByTitle("Drag to reorder");
    expect(handle.getAttribute("data-drag-handle")).toBe("true");
    expect(handle.getAttribute("tabindex")).toBe("0");
    fireEvent.click(handle);
    fireEvent.click(handle.querySelector("svg")!);
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
  });

  it.each(sides)("the real %s child drag listener still starts and cancels a keyboard drag without selecting", async side => {
    const view = renderColumn(Component), childId = `${side}-child-1`;
    const handle = within(view.childWrapper(childId)).getByTitle("Drag to reorder");
    handle.focus();
    fireEvent.keyDown(handle, { key: " ", code: "Space" });
    await waitFor(() => expect(view.onDragStart).toHaveBeenCalledTimes(1));
    expect(view.onDragStart.mock.calls[0][0].active.id).toBe(childId);
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(view.onDragCancel).toHaveBeenCalledTimes(1));
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.block).toEqual(view.originalBlock);
  });

  it.each(sides)("old consumers without the optional callback retain %s child bubbling and actions", side => {
    const view = renderColumn(Component, false), childId = `${side}-child-1`;
    const child = within(view.childWrapper(childId));
    expect(child.queryByRole("button", { name: `Edit block settings ${childId}` })).toBeNull();
    fireEvent.click(view.childWrapper(childId));
    expect(view.callbacks.onSelect).toHaveBeenCalledTimes(1);
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
    view.callbacks.onSelect.mockClear();
    fireEvent.click(child.getByTitle("Move out of column"));
    fireEvent.click(child.getByTitle("Remove from column"));
    fireEvent.click(child.getByTitle("Move up"));
    fireEvent.click(child.getByTitle("Move down"));
    fireEvent.click(child.getByTitle("Drag to reorder"));
    expect(view.callbacks.onMoveBlockOutOfColumn.mock.calls).toEqual([["columns", side, childId]]);
    expect(view.callbacks.onDeleteChildFromColumn.mock.calls).toEqual([["columns", side, childId]]);
    expect(view.callbacks.onReorderChildInColumn.mock.calls).toEqual([
      ["columns", side, childId, "up"], ["columns", side, childId, "down"],
    ]);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
  });

  it("top-level non-column selection and original delete/duplicate controls are unchanged", () => {
    const block: Block = { id: "root", type: "text", data: { html: "Original root" } };
    const view = renderColumn(Component, true, block);
    fireEvent.click(view.getByTestId("preview-root"));
    expect(view.callbacks.onSelect).toHaveBeenCalledTimes(1);
    view.callbacks.onSelect.mockClear();
    fireEvent.click(view.getByTitle("Duplicate"));
    fireEvent.click(view.getByTitle("Delete"));
    fireEvent.click(view.getByTitle("Drag to reorder"));
    expect(view.callbacks.onDuplicate).toHaveBeenCalledTimes(1);
    expect(view.callbacks.onDelete).toHaveBeenCalledTimes(1);
    expect(view.callbacks.onSelect).not.toHaveBeenCalled();
    expect(view.callbacks.onSelectChildBlock).not.toHaveBeenCalled();
  });
});
