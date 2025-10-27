<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 18,
  },
  title: {
    type: String,
    default: '',
  },
});

const ICON_PATHS = {
  sun: [
    { d: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z' },
    { d: 'M11 2h2v2h-2zM11 20h2v2h-2zM4 11h2v2H4zM18 11h2v2h-2z' },
    { d: 'M6.05 4.64 7.46 6.05 5.64 7.87 4.23 6.46zM16.54 17.95l1.41 1.41-1.82 1.82-1.41-1.41zM4.23 17.54l1.41-1.41 1.82 1.82-1.41 1.41zM16.54 6.05l1.41-1.41 1.82 1.82-1.41 1.41z' },
  ],
  calendar: [
    { d: 'M6 5h12v14H6z' },
    { d: 'M6 3h4v2H6zM14 3h4v2h-4z' },
    { d: 'M8 9h3v3H8zM13 9h3v3h-3zM8 14h3v3H8zM13 14h3v3h-3z' },
  ],
  alert: [
    { d: 'M12 4 3 20h18Z' },
    { d: 'M11 10h2v5h-2zM11 17h2v2h-2z', opacity: 0.85 },
  ],
  layers: [
    { d: 'M12 4 3 8.5 12 13l9-4.5z' },
    { d: 'M3 11l9 4.5 9-4.5v3L12 18l-9-4z' },
  ],
  check: [
    { d: 'M9.5 14.5 6.5 11.5 5 13l4.5 4.5L19 8l-1.5-1.5Z' },
  ],
  folder: [
    { d: 'M4 6h6l2 2h8v10H4z' },
    { d: 'M4 6h3v2H4z', opacity: 0.85 },
  ],
  plus: [
    { d: 'M11 5h2v14h-2zM5 11h14v2H5z' },
  ],
  edit: [
    { d: 'm5 16.5 9.5-9.5 3 3L8 19.5 5 20z' },
    { d: 'm15 5 2-2 3 3-2 2z' },
  ],
  repeat: [
    { d: 'M7 7h10V4l4 4-4 4V9H9a3 3 0 0 0-3 3v1H3v-1a6 6 0 0 1 6-6Z' },
    { d: 'M17 17H7v3l-4-4 4-4v3h8a3 3 0 0 0 3-3v-1h3v1a6 6 0 0 1-6 6Z' },
  ],
  clock: [
    { d: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z' },
    { d: 'M11 8h2v4l3 2-1 1-4-2.5Z', opacity: 0.9 },
  ],
  pencil: [
    { d: 'm5 15.5 9.5-9.5 3 3L8 18.5 5 19z' },
    { d: 'm15 5 2-2 3 3-2 2z' },
  ],
  text: [
    { d: 'M6 5h12v2H6zM6 11h12v2H6zM6 17h8v2H6z' },
  ],
  exclamation: [
    { d: 'M11 5h2v10h-2z' },
    { d: 'M11 17h2v2h-2z' },
  ],
  sunrise: [
    { d: 'M12 6.5 9 9.5h6z' },
    { d: 'M12 3v2' },
    { d: 'M5.05 5.05l1.42 1.42' },
    { d: 'M18.95 5.05l-1.42 1.42' },
    { d: 'M4 17h16v2H4z' },
    { d: 'M7 17a5 5 0 0 1 10 0' },
  ],
  person: [
    { d: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
    { d: 'M8 20v-2.5c0-2 1.79-3.5 4-3.5s4 1.5 4 3.5V20Z' },
  ],
  'chevron-left': [
    { d: 'M14.5 6 9 11.5 14.5 17l1.5-1.5-4-4 4-4Z' },
  ],
  'chevron-right': [
    { d: 'M9.5 6 15 11.5 9.5 17 8 15.5l4-4-4-4Z' },
  ],
};

const paths = computed(() => ICON_PATHS[props.name] ?? []);
const sizeValue = computed(() => (Number(props.size) || 18));
</script>

<template>
  <svg
    class="icon-glyph"
    :width="sizeValue"
    :height="sizeValue"
    viewBox="0 0 24 24"
    role="presentation"
    :aria-label="title || undefined"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>
    <path
      v-for="(segment, index) in paths"
      :key="index"
      :d="segment.d"
      :opacity="segment.opacity ?? 1"
      fill="currentColor"
    />
  </svg>
</template>

<style scoped>
.icon-glyph {
  display: inline-block;
  vertical-align: middle;
  fill: currentColor;
}
</style>
