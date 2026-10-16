<template>
  <h2>404</h2>
  <p>页面不存在：{{ route.fullPath }}</p>
  <RouterLink to="/">返回首页</RouterLink>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
