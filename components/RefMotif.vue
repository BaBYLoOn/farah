<template>
  <svg
    class="ref-motif"
    :class="[`ref-motif--${name}`]"
    :width="size"
    :height="size"
    :viewBox="vb"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <!-- FIRE KEEPER — seated figure, hands clasped, helm/crown -->
    <g v-if="name === 'fire-keeper'" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <!-- Helm / crown -->
      <path d="M70 30 C70 22 86 18 100 18 C114 18 130 22 130 30 L132 36 C132 44 124 50 100 50 C76 50 68 44 68 36 Z" fill="currentColor" fill-opacity="0.35" />
      <path d="M82 22 L82 18 M91 20 L91 16 M100 19 L100 14 M109 20 L109 16 M118 22 L118 18" />
      <!-- Veil falling from helm -->
      <path d="M68 36 C60 56 56 76 60 110 L80 110 C76 88 78 70 84 50" fill="currentColor" fill-opacity="0.18" />
      <path d="M132 36 C140 56 144 76 140 110 L120 110 C124 88 122 70 116 50" fill="currentColor" fill-opacity="0.18" />
      <!-- Body / robes -->
      <path d="M84 50 C82 70 80 96 78 132 L122 132 C120 96 118 70 116 50" fill="currentColor" fill-opacity="0.4" />
      <!-- Hands clasped on lap -->
      <path d="M88 116 C92 114 96 116 100 118 C104 116 108 114 112 116 C112 122 108 124 100 124 C92 124 88 122 88 116 Z" fill="currentColor" fill-opacity="0.65" />
      <!-- Hem / pooled robe at base -->
      <path d="M70 132 L130 132 C134 138 136 144 134 152 L66 152 C64 144 66 138 70 132 Z" fill="currentColor" fill-opacity="0.55" />
      <!-- Glow at heart (tiny ember) -->
      <circle cx="100" cy="92" r="2" fill="currentColor" opacity="0.85" />
    </g>

    <!-- SCARLET AEONIA bloom — Malenia's symbol, abstracted as a rotted flower -->
    <g v-else-if="name === 'malenia'" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <g transform="translate(100 100)">
        <g v-for="n in 6" :key="n" :transform="`rotate(${n * 60})`">
          <path d="M 0 0 C -10 -22 -8 -50 0 -68 C 8 -50 10 -22 0 0 Z" fill="currentColor" fill-opacity="0.32" />
          <path d="M 0 -8 L 0 -64" stroke="currentColor" stroke-opacity="0.6" />
        </g>
        <!-- Inner ring of small petals -->
        <g v-for="n in 6" :key="`inner-${n}`" :transform="`rotate(${n * 60 + 30})`">
          <path d="M 0 0 C -5 -10 -4 -22 0 -30 C 4 -22 5 -10 0 0 Z" fill="currentColor" fill-opacity="0.5" />
        </g>
        <!-- Core -->
        <circle r="6" fill="currentColor" />
        <circle r="2.5" fill="currentColor" opacity="0" stroke="none" />
      </g>
    </g>

    <!-- ANTLER — Hannibal's stag motif, branched silhouette -->
    <g v-else-if="name === 'antler'" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <!-- Main beam -->
      <path d="M100 180 L100 60" />
      <!-- Branch points up the beam -->
      <path d="M100 150 L78 130 L70 118 M78 130 L72 142" />
      <path d="M100 150 L122 130 L130 118 M122 130 L128 142" />
      <path d="M100 120 L82 100 L72 88 M82 100 L78 110" />
      <path d="M100 120 L118 100 L128 88 M118 100 L122 110" />
      <path d="M100 90 L86 72 L78 60 M86 72 L82 82" />
      <path d="M100 90 L114 72 L122 60 M114 72 L118 82" />
      <path d="M100 70 L92 56 L86 48" />
      <path d="M100 70 L108 56 L114 48" />
      <path d="M100 60 L100 44" />
      <!-- Skull-cap base -->
      <path d="M82 184 C82 188 90 190 100 190 C110 190 118 188 118 184 C118 178 112 174 100 174 C88 174 82 178 82 184 Z" fill="currentColor" fill-opacity="0.4" />
    </g>

    <!-- ORCHID-MARK (small, line-only) — for dividers where the full BlackOrchid is too heavy -->
    <g v-else-if="name === 'orchid-mark'" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <g transform="translate(100 100)">
        <path d="M 0 0 C -14 -22 -16 -54 0 -72 C 16 -54 14 -22 0 0 Z" fill="currentColor" fill-opacity="0.5" />
        <g transform="rotate(72)">
          <path d="M 0 0 C -14 -22 -16 -54 0 -72 C 16 -54 14 -22 0 0 Z" fill="currentColor" fill-opacity="0.4" />
        </g>
        <g transform="rotate(-72)">
          <path d="M 0 0 C -14 -22 -16 -54 0 -72 C 16 -54 14 -22 0 0 Z" fill="currentColor" fill-opacity="0.4" />
        </g>
        <g transform="rotate(144)">
          <path d="M 0 0 C -10 -16 -10 -38 0 -52 C 10 -38 10 -16 0 0 Z" fill="currentColor" fill-opacity="0.35" />
        </g>
        <g transform="rotate(-144)">
          <path d="M 0 0 C -10 -16 -10 -38 0 -52 C 10 -38 10 -16 0 0 Z" fill="currentColor" fill-opacity="0.35" />
        </g>
        <circle r="3" fill="currentColor" />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  name: 'fire-keeper' | 'malenia' | 'antler' | 'orchid-mark'
  size?: number | string
}>(), { size: 200 })

const vb = '0 0 200 200'
</script>

<style scoped>
.ref-motif { display: block; }
</style>
