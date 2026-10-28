export interface TreemapRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Weighted<T> {
  item: T;
  value: number;
}

// Worst aspect ratio of a row of areas laid along a side of length `side`
function worst(areas: number[], side: number) {
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/** Squarified treemap (Bruls et al.): tiles `items` into the box, area proportional to value. */
export function squarify<T>(
  items: Weighted<T>[],
  box: { x: number; y: number; w: number; h: number },
): TreemapRect<T>[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, i) => s + i.value, 0);
  if (positive.length === 0 || total <= 0 || box.w <= 0 || box.h <= 0) return [];

  const scale = (box.w * box.h) / total;
  const queue = positive.map((i) => ({ item: i.item, area: i.value * scale }));
  const out: TreemapRect<T>[] = [];
  let { x, y, w, h } = box;

  while (queue.length > 0) {
    const side = Math.min(w, h);
    const row = [queue[0]];
    let next = 1;
    while (
      next < queue.length &&
      worst([...row, queue[next]].map((r) => r.area), side) <= worst(row.map((r) => r.area), side)
    ) {
      row.push(queue[next]);
      next++;
    }
    queue.splice(0, row.length);

    const rowArea = row.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      // Column on the left
      const colW = rowArea / h;
      let cy = y;
      for (const r of row) {
        const rh = r.area / colW;
        out.push({ item: r.item, x, y: cy, w: colW, h: rh });
        cy += rh;
      }
      x += colW;
      w -= colW;
    } else {
      // Row on top
      const rowH = rowArea / w;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rowH;
        out.push({ item: r.item, x: cx, y, w: rw, h: rowH });
        cx += rw;
      }
      y += rowH;
      h -= rowH;
    }
  }
  return out;
}
