<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";

  /** Props injected by SvelteFlow for custom nodes */
  export let data: {
    label: string;
    nodeType: string;
    conjunction: string | null;
    isSelected: boolean;
    icon: string;
  };
  /** Node id — passed by SvelteFlow */
  export let id: string = "";
  // Absorb any extra props SvelteFlow passes
  $$restProps;

  const typeStyles: Record<
    string,
    { fill: string; stroke: string; text: string; accent: string }
  > = {
    goal: {
      fill: "#FFF5F5",
      stroke: "#C53030",
      text: "#742A2A",
      accent: "#FED7D7",
    },
    category: {
      fill: "#EBF8FF",
      stroke: "#2B6CB0",
      text: "#1A365D",
      accent: "#BEE3F8",
    },
    step: {
      fill: "#FFFAF0",
      stroke: "#DD6B20",
      text: "#7B341E",
      accent: "#FEEBC8",
    },
    substep: {
      fill: "#FFF5F5",
      stroke: "#E53E3E",
      text: "#742A2A",
      accent: "#FED7D7",
    },
    path: {
      fill: "#FAF5FF",
      stroke: "#805AD5",
      text: "#44337A",
      accent: "#E9D8FD",
    },
    countermeasure: {
      fill: "#F0FFF4",
      stroke: "#38A169",
      text: "#22543D",
      accent: "#C6F6D5",
    },
  };

  $: style = typeStyles[data.nodeType] || typeStyles.step;
  $: isDefense = data.nodeType === "countermeasure";
</script>

<div
  class="attack-node"
  class:defense={isDefense}
  class:selected={data.isSelected}
  data-node-id={id}
  style="
    --node-fill: {data.isSelected ? style.stroke : style.fill};
    --node-stroke: {style.stroke};
    --node-text: {data.isSelected ? '#ffffff' : style.text};
    --node-accent: {style.accent};
  "
>
  <Handle type="target" position={Position.Top} />

  <div class="node-content">
    <span class="node-icon">{data.icon}</span>
    <span class="node-label">{data.label}</span>
    {#if data.conjunction}
      <span class="conjunction-badge {data.conjunction.toLowerCase()}"
        >{data.conjunction}</span
      >
    {/if}
  </div>

  {#if data.conjunction}
    <div class="gate-symbol">
      <svg width="28" height="14" viewBox="0 0 28 14">
        <!-- OR arc -->
        <path
          d="M 4 2 Q 14 14 24 2"
          fill="none"
          stroke={data.isSelected ? "#ffffff" : "#718096"}
          stroke-width="1.5"
          stroke-linecap="round"
        />
        {#if data.conjunction === "AND"}
          <!-- AND line through arc -->
          <line
            x1="6"
            y1="6"
            x2="22"
            y2="6"
            stroke={data.isSelected ? "#ffffff" : "#718096"}
            stroke-width="1.5"
            stroke-linecap="round"
          />
        {/if}
      </svg>
    </div>
  {/if}

  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .attack-node {
    background: var(--node-fill);
    border: 2px solid var(--node-stroke);
    border-radius: 12px;
    padding: 10px 16px;
    min-width: 100px;
    max-width: 220px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.18s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    position: relative;
  }

  .attack-node:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
    transform: translateY(-1px);
  }

  .attack-node.selected {
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.18),
      0 0 0 3px var(--node-accent);
  }

  .attack-node.defense {
    border-style: dashed;
  }

  .node-content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .node-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .node-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--node-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conjunction-badge {
    font-size: 0.55rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    flex-shrink: 0;
    letter-spacing: 0.5px;
  }

  .conjunction-badge.or {
    background: #fed7d7;
    color: #c53030;
  }

  .conjunction-badge.and {
    background: #bee3f8;
    color: #2b6cb0;
  }

  .selected .conjunction-badge {
    background: rgba(255, 255, 255, 0.25);
    color: inherit;
  }

  .gate-symbol {
    display: flex;
    justify-content: center;
    margin-top: 4px;
  }

  /* Handle styling */
  :global(.attack-node .svelte-flow__handle) {
    width: 6px;
    height: 6px;
    background: var(--node-stroke);
    border: 1.5px solid white;
  }
</style>
