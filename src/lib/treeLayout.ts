/**
 * Converts TreeNodeData[] (the app's attack-tree model) into
 * SvelteFlow nodes + edges, then applies dagre auto-layout.
 */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/svelte";
import { Position } from "@xyflow/svelte";
import type { TreeNodeData } from "$lib/types";

/* ── Icons per node type ───────────────────────────────────── */
const typeIcons: Record<string, string> = {
  goal: "🎯",
  category: "📂",
  step: "⚡",
  substep: "🔸",
  path: "🔀",
  countermeasure: "🛡️",
};

/* ── Estimated node dimensions (used by dagre) ─────────────── */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

/* ── Helpers ───────────────────────────────────────────────── */

function getConjunction(node: TreeNodeData): string | null {
  if (node.children.length === 0) return null;
  const d = node.data as any;
  if (node.type === "goal") {
    return d?.impact_category === "and" ? "AND" : "OR";
  }
  return d?.conjunction || null;
}

/**
 * Walk the tree and produce flat node + edge arrays
 */
function flattenTree(
  roots: TreeNodeData[],
  selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function walk(node: TreeNodeData, parentId: string | null) {
    nodes.push({
      id: node.id,
      type: "attackNode", // our custom node type
      position: { x: 0, y: 0 }, // dagre will overwrite
      data: {
        label: node.name,
        nodeType: node.type,
        conjunction: getConjunction(node),
        isSelected: node.id === selectedId,
        icon: typeIcons[node.type] || "•",
        treeNode: node, // keep reference for click handler
      },
      // Compute a reasonable width from the label length
      width: Math.max(NODE_WIDTH, Math.min(node.name.length * 8 + 60, 220)),
      height: getConjunction(node) ? NODE_HEIGHT + 18 : NODE_HEIGHT,
    });

    if (parentId) {
      const isDefense = node.type === "countermeasure";
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "defenseEdge", // our custom edge
        data: { isDefense },
        animated: false,
      });
    }

    for (const child of node.children) {
      walk(child, node.id);
    }
  }

  for (const root of roots) {
    walk(root, null);
  }

  return { nodes, edges };
}

/**
 * Apply dagre layout to position all nodes in a top-down hierarchy.
 */
function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
    edgesep: 20,
    marginx: 30,
    marginy: 30,
  });

  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.width ?? NODE_WIDTH,
      height: node.height ?? NODE_HEIGHT,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const isHorizontal = direction === "LR";

  const layoutedNodes = nodes.map((node) => {
    const gNode = g.node(node.id);
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? NODE_HEIGHT;
    return {
      ...node,
      // dagre returns center position → convert to top-left
      position: {
        x: gNode.x - w / 2,
        y: gNode.y - h / 2,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ── Public API ────────────────────────────────────────────── */

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Convert a TreeNodeData[] to a dagre-laid-out SvelteFlow graph.
 */
export function treeToFlow(
  roots: TreeNodeData[],
  selectedId: string | null,
  direction: "TB" | "LR" = "TB",
): LayoutResult {
  if (roots.length === 0) return { nodes: [], edges: [] };
  const { nodes, edges } = flattenTree(roots, selectedId);
  return applyDagreLayout(nodes, edges, direction);
}
