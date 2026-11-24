export class PrerequisiteGraph {
  constructor(ids, dependencies) {
    this.parents = new Map(ids.map(id => [id, new Set()]));
    const children = new Map(ids.map(id => [id, []]));
    for (const [parent, child] of dependencies) {
      if (!this.parents.has(parent) || !this.parents.has(child)) {
        throw new Error('Unknown curriculum ID in prerequisite graph');
      }
      if (this.parents.get(child).has(parent)) continue;
      this.parents.get(child).add(parent);
      children.get(parent).push(child);
    }
    const counts = new Map([...this.parents].map(([id, parents]) => [id, parents.size]));
    this.order = [...counts].filter(([, count]) => count === 0).map(([id]) => id);
    for (let i = 0; i < this.order.length; i++) {
      for (const child of children.get(this.order[i])) {
        const count = counts.get(child) - 1;
        counts.set(child, count);
        if (count === 0) this.order.push(child);
      }
    }
    if (this.order.length !== this.parents.size) throw new Error('Cycle in curriculum prerequisites');
  }

  weakPrerequisites(target, mastery, available, threshold) {
    const ancestors = new Set();
    const pending = [...(this.parents.get(target) ?? [])];
    while (pending.length) {
      const id = pending.pop();
      if (ancestors.has(id)) continue;
      ancestors.add(id);
      for (const parent of this.parents.get(id)) pending.push(parent);
    }
    return this.order.filter(id => ancestors.has(id) && available.has(id) && (mastery.get(id) ?? 0) < threshold);
  }
}
