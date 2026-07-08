<template>
  <svg
    class="orchid"
    :class="[`orchid--${variant}`]"
    :width="size"
    :height="size"
    viewBox="0 0 240 260"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <radialGradient :id="`orchid-glow-${uid}`" cx="50%" cy="52%" r="55%">
        <stop offset="0%" stop-color="#3a0808" stop-opacity="0.85" />
        <stop offset="55%" stop-color="#0c0505" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#000" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="`orchid-petal-${uid}`" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="#1a0a0a" />
        <stop offset="65%" stop-color="#0a0404" />
        <stop offset="100%" stop-color="#040202" />
      </radialGradient>
      <radialGradient :id="`orchid-core-${uid}`" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#a01a1a" />
        <stop offset="40%" stop-color="#5a0606" />
        <stop offset="100%" stop-color="#1a0202" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Soft halo -->
    <circle cx="120" cy="135" r="118" :fill="`url(#orchid-glow-${uid})`" />

    <g transform="translate(120 135)">
      <!-- Lower-left sepal -->
      <g transform="rotate(-145)">
        <path
          d="M 0 0 C -16 -22 -20 -58 0 -82 C 20 -58 16 -22 0 0 Z"
          :fill="`url(#orchid-petal-${uid})`"
          stroke="#5a0a0a" stroke-width="0.7" stroke-opacity="0.55"
        />
        <path d="M 0 -4 L 0 -76" stroke="#7a1414" stroke-width="0.5" stroke-opacity="0.45" fill="none" />
      </g>

      <!-- Lower-right sepal -->
      <g transform="rotate(145)">
        <path
          d="M 0 0 C -16 -22 -20 -58 0 -82 C 20 -58 16 -22 0 0 Z"
          :fill="`url(#orchid-petal-${uid})`"
          stroke="#5a0a0a" stroke-width="0.7" stroke-opacity="0.55"
        />
        <path d="M 0 -4 L 0 -76" stroke="#7a1414" stroke-width="0.5" stroke-opacity="0.45" fill="none" />
      </g>

      <!-- Upper-left petal (large, swept) -->
      <g transform="rotate(-72)">
        <path
          d="M 0 0 C -26 -28 -32 -86 -4 -116 C 26 -88 22 -28 0 0 Z"
          :fill="`url(#orchid-petal-${uid})`"
          stroke="#5a0a0a" stroke-width="0.8" stroke-opacity="0.6"
        />
        <path d="M -2 -4 L -3 -110" stroke="#7a1414" stroke-width="0.5" stroke-opacity="0.5" fill="none" />
      </g>

      <!-- Upper-right petal -->
      <g transform="rotate(72)">
        <path
          d="M 0 0 C 26 -28 32 -86 4 -116 C -26 -88 -22 -28 0 0 Z"
          :fill="`url(#orchid-petal-${uid})`"
          stroke="#5a0a0a" stroke-width="0.8" stroke-opacity="0.6"
        />
        <path d="M 2 -4 L 3 -110" stroke="#7a1414" stroke-width="0.5" stroke-opacity="0.5" fill="none" />
      </g>

      <!-- Top sepal (dorsal) -->
      <path
        d="M 0 0 C -22 -22 -26 -88 0 -120 C 26 -88 22 -22 0 0 Z"
        :fill="`url(#orchid-petal-${uid})`"
        stroke="#5a0a0a" stroke-width="0.85" stroke-opacity="0.65"
      />
      <path d="M 0 -6 L 0 -114" stroke="#7a1414" stroke-width="0.5" stroke-opacity="0.5" fill="none" />

      <!-- Labellum (lip) — ruffled, points down -->
      <path
        d="M 0 0
           C -22 8 -34 22 -30 42
           C -34 56 -22 70 -10 64
           C -6 72 6 72 10 64
           C 22 70 34 56 30 42
           C 34 22 22 8 0 0 Z"
        :fill="`url(#orchid-petal-${uid})`"
        stroke="#6a0e0e" stroke-width="0.8" stroke-opacity="0.7"
      />
      <!-- Labellum inner ruffle -->
      <path
        d="M -14 24 C -10 36 -4 42 0 40 C 4 42 10 36 14 24"
        fill="none" stroke="#8a1414" stroke-width="0.6" stroke-opacity="0.55"
      />

      <!-- Column / center bloom -->
      <ellipse cx="0" cy="-2" rx="8" ry="11" :fill="`url(#orchid-core-${uid})`" />
      <circle cx="0" cy="-3" r="2.4" fill="#c41818" opacity="0.85" />
      <circle cx="0" cy="-3" r="0.9" fill="#f0d0c4" opacity="0.55" />
    </g>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: number | string
  variant?: 'centerpiece' | 'mark' | 'divider'
}>(), {
  size: 220,
  variant: 'centerpiece',
})

const uid = Math.random().toString(36).slice(2, 9)
</script>

<style scoped>
.orchid {
  display: block;
  filter: drop-shadow(0 0 22px rgba(120, 0, 0, 0.18))
          drop-shadow(0 0 60px rgba(0, 0, 0, 0.7));
}
.orchid--mark { filter: drop-shadow(0 0 8px rgba(120, 0, 0, 0.25)); }
.orchid--divider { filter: drop-shadow(0 0 6px rgba(120, 0, 0, 0.2)); opacity: 0.85; }
</style>
