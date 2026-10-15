export type Graph = Map<string, { to: string; meters: number }[]>;

/** A binary min-heap; lazy duplicate entries avoid an O(V) decrease-key scan. */
class MinHeap {
  private items: { id: string; distance: number }[] = [];
  push(item: { id: string; distance: number }) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (a[parent].distance <= item.distance) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items;
    if (!a.length) return undefined;
    const first = a[0];
    const last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && a[child + 1].distance < a[child].distance) child++;
        if (last.distance <= a[child].distance) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return first;
  }
}

/** Shortest nonnegative weighted path, or null if disconnected. No provider calls. */
export function dijkstra(graph: Graph, source: string, target: string) {
  if (!graph.has(source) || !graph.has(target)) throw new Error('Unknown graph endpoint');
  for (const edges of graph.values())
    for (const edge of edges)
      if (!graph.has(edge.to) || !Number.isFinite(edge.meters) || edge.meters < 0)
        throw new Error('Edges require known nodes and finite nonnegative weights');
  const distances = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, string>();
  const queue = new MinHeap();
  queue.push({ id: source, distance: 0 });
  let visitedNodes = 0;
  for (let current = queue.pop(); current; current = queue.pop()) {
    if (current.distance !== distances.get(current.id)) continue;
    visitedNodes++;
    if (current.id === target) {
      const path = [target];
      while (path[path.length - 1] !== source)
        path.push(previous.get(path[path.length - 1])!);
      return { nodeIds: path.reverse(), distanceMeters: current.distance, visitedNodes };
    }
    for (const edge of graph.get(current.id)!) {
      const candidate = current.distance + edge.meters;
      if (!Number.isFinite(candidate)) throw new Error('Path cost overflow');
      if (candidate < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, candidate);
        previous.set(edge.to, current.id);
        queue.push({ id: edge.to, distance: candidate });
      }
    }
  }
  return null;
}
