<script lang="ts">
  import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/svelte";

  /** Custom edge for defense (countermeasure) connections — dashed green */
  export let id: string;
  export let sourceX: number;
  export let sourceY: number;
  export let targetX: number;
  export let targetY: number;
  export let sourcePosition: any;
  export let targetPosition: any;
  export let data: { isDefense?: boolean } | undefined = undefined;
  export let markerEnd: string | undefined = undefined;
  export let style: string | undefined = undefined;
  // Absorb any extra props SvelteFlow passes
  $$restProps;

  $: isDefense = data?.isDefense ?? false;

  $: [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  $: edgeStyle = [style, isDefense
    ? "stroke: #48BB78; stroke-width: 2; stroke-dasharray: 8 4;"
    : "stroke: #A0AEC0; stroke-width: 2;"].filter(Boolean).join(" ");
</script>

<BaseEdge {id} path={path} {markerEnd} style={edgeStyle} />
