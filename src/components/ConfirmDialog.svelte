<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = 'Confirm';
  export let message = 'Are you sure?';
  export let confirmLabel = 'Confirm';
  export let cancelLabel = 'Cancel';
  export let danger = false;
  export let open = false;

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();

  function confirm() {
    dispatch('confirm');
    open = false;
  }

  function cancel() {
    dispatch('cancel');
    open = false;
  }
</script>

{#if open}
  <div class="overlay" on:click={cancel} on:keypress={cancel} role="dialog" aria-modal="true">
    <div class="dialog" on:click|stopPropagation role="document">
      <h3 class="dialog-title">{title}</h3>
      <p class="dialog-message">{message}</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={cancel}>{cancelLabel}</button>
        <button class="btn" class:btn-danger={danger} class:btn-primary={!danger} on:click={confirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    border-radius: 10px;
    padding: 24px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  .dialog-title {
    margin: 0 0 8px;
    font-size: 1.05rem;
  }

  .dialog-message {
    font-size: 0.88rem;
    color: var(--color-text-muted, #718096);
    margin: 0 0 20px;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    border: none;
    border-radius: 4px;
    padding: 8px 18px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .btn-primary { background: var(--color-primary, #1a365d); color: white; }
  .btn-secondary { background: #edf2f7; color: #2d3748; }
  .btn-danger { background: #e53e3e; color: white; }
</style>
