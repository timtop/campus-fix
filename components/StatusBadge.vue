<script setup lang="ts">
defineProps<{ status: string }>()
</script>
<template><span class="status-badge" :class="status.toLowerCase()"><span aria-hidden="true" class="status-dot" />{{ status.replaceAll('_', ' ').toLowerCase() }}</span></template>
