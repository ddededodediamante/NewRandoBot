const Users = require("../models/userSchema.js");

const MAX_TREE_LOOKUP = 200;

async function walkTree(startId, direction) {
  const seen = new Set([startId]);
  let frontier = [startId];

  while (frontier.length && seen.size < MAX_TREE_LOOKUP) {
    const docs = await Users.find({ id: { $in: frontier } });
    const next = [];

    for (const doc of docs) {
      for (const id of doc.family?.[direction] ?? []) {
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
    }

    frontier = next;
  }

  seen.delete(startId);
  return seen;
}

async function walkTreeDepths(startId, direction) {
  const depth = new Map([[startId, 0]]);
  let frontier = [startId];

  while (frontier.length && depth.size < MAX_TREE_LOOKUP) {
    const docs = await Users.find({ id: { $in: frontier } });
    const next = [];

    for (const doc of docs) {
      const d = depth.get(doc.id);
      for (const id of doc.family?.[direction] ?? []) {
        if (!depth.has(id)) {
          depth.set(id, d + 1);
          next.push(id);
        }
      }
    }

    frontier = next;
  }

  depth.delete(startId);
  return depth;
}

async function getRelation(me, other) {
  const myParents = me.family?.parents ?? [];
  const myChildren = me.family?.children ?? [];

  if (myParents.includes(other.id)) return "parent";
  if (myChildren.includes(other.id)) return "child";

  const otherParents = other.family?.parents ?? [];
  if (myParents.some((id) => otherParents.includes(id))) return "sibling";

  if ((await walkTree(me.id, "parents")).has(other.id)) return "ancestor";
  if ((await walkTree(me.id, "children")).has(other.id)) return "descendant";

  return null;
}

module.exports = { walkTree, walkTreeDepths, getRelation };
