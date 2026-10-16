<template>
  <article
    v-if="doc"
    class="doc"
  >
    <!-- 正文：来自 src/docs/<id>.md -->
    <MarkdownView :content="doc.content" />
    <!-- 交互演示：来自 src/components/demos/<demo>.vue -->
    <component
      :is="doc.demoComponent"
      v-if="doc.demoComponent"
    />
  </article>

  <p
    v-else
    class="missing"
  >
    未找到教程：{{ id }}
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownView from '../components/MarkdownView.vue'
import { getDoc } from '../docs'

const props = defineProps<{ id: string }>()

const doc = computed(() => getDoc(props.id))
</script>

<style scoped>
.doc {
  text-align: left;
}

.missing {
  text-align: left;
  color: var(--text);
}
</style>
