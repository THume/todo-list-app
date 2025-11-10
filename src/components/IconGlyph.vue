<script setup>
import { computed, watchEffect } from 'vue';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ICON_FILES = import.meta.glob('../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const iconDefinitions = {};

Object.entries(ICON_FILES).forEach(([path, rawContent]) => {
  const matchName = path.match(/\/([^/]+)\.svg$/);
  if (!matchName) {
    return;
  }
  const iconName = matchName[1];
  const matchSvg = rawContent.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!matchSvg) {
    return;
  }
  const [, rawAttributes = '', innerContent = ''] = matchSvg;
  const parsedAttributes = {};
  const attributePattern = /([^\s=]+)\s*=\s*"([^"]*)"/g;
  let attributeMatch;
  while ((attributeMatch = attributePattern.exec(rawAttributes))) {
    parsedAttributes[attributeMatch[1]] = attributeMatch[2];
  }
  iconDefinitions[iconName] = {
    attrs: parsedAttributes,
    inner: innerContent.trim(),
  };
});

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

const sizeValue = computed(() => Number(props.size) || 18);
const titleValue = computed(() => props.title?.trim() ?? '');
const iconEntry = computed(() => iconDefinitions[props.name] ?? null);

const iconAttrs = computed(() => {
  if (!iconEntry.value) {
    return null;
  }
  const sanitized = { ...(iconEntry.value.attrs ?? {}) };
  delete sanitized.width;
  delete sanitized.height;
  delete sanitized.class;
  delete sanitized.role;
  Object.keys(sanitized).forEach((key) => {
    if (key.startsWith('aria-')) {
      delete sanitized[key];
    }
  });
  if (!sanitized.xmlns) {
    sanitized.xmlns = 'http://www.w3.org/2000/svg';
  }
  if (!sanitized.viewBox) {
    sanitized.viewBox = '0 0 24 24';
  }
  return sanitized;
});

const iconInnerContent = computed(() => {
  if (!iconEntry.value) {
    return null;
  }
  const withoutTitle = iconEntry.value.inner.replace(/<title[\s\S]*?<\/title>/gi, '').trim();
  if (!titleValue.value) {
    return withoutTitle;
  }
  const escapedTitle = escapeHtml(titleValue.value);
  return `<title>${escapedTitle}</title>${withoutTitle ? `\n${withoutTitle}` : ''}`;
});

if (import.meta.env.DEV) {
  watchEffect(() => {
    if (!iconEntry.value && props.name) {
      console.warn(`[IconGlyph] Unknown icon "${props.name}".`);
    }
  });
}
</script>

<template>
  <svg
    v-if="iconAttrs && iconInnerContent"
    v-bind="iconAttrs"
    class="icon-glyph"
    :width="sizeValue"
    :height="sizeValue"
    :role="titleValue ? 'img' : 'presentation'"
    :aria-label="titleValue || undefined"
    :aria-hidden="titleValue ? undefined : 'true'"
    focusable="false"
    v-html="iconInnerContent"
  />
  <svg
    v-else
    class="icon-glyph"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="sizeValue"
    :height="sizeValue"
    role="presentation"
    aria-hidden="true"
    focusable="false"
  />
</template>

<style scoped>
.icon-glyph {
  display: inline-block;
  vertical-align: middle;
  fill: currentColor;
}
</style>
