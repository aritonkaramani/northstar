import { ref, type Ref } from "vue";

export function useDragOrder(mains: Ref<string[]>) {
  const dragSrcIndex = ref<number | null>(null);
  const dragOverIndex = ref<number | null>(null);

  function onDragStart(index: number, e: DragEvent) {
    dragSrcIndex.value = index;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    dragOverIndex.value = index;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function onDrop(index: number) {
    const src = dragSrcIndex.value;
    dragSrcIndex.value = null;
    dragOverIndex.value = null;
    if (src === null || src === index) return;
    const arr = [...mains.value];
    const [item] = arr.splice(src, 1);
    arr.splice(index, 0, item);
    mains.value = arr;
    savePlayerOrder();
  }

  function onDragEnd() {
    dragSrcIndex.value = null;
    dragOverIndex.value = null;
  }

  async function savePlayerOrder() {
    await fetch("/api/roster?resource=player-order", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "mains", order: mains.value }),
    });
  }

  return { dragSrcIndex, dragOverIndex, onDragStart, onDragOver, onDrop, onDragEnd };
}