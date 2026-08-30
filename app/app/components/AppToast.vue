<script setup lang="ts">
import IconCircleCheck from '~icons/lucide/circle-check-big'
import IconCircleInfo from '~icons/lucide/info'
import IconCircleX from '~icons/lucide/circle-x'
import IconTriangleAlert from '~icons/lucide/triangle-alert'
import IconX from '~icons/lucide/x'

type ToastSeverity = 'success' | 'info' | 'warn' | 'error'

const severityIcons = {
  success: IconCircleCheck,
  info: IconCircleInfo,
  warn: IconTriangleAlert,
  error: IconCircleX,
}

const toastBreakpoints = {
  '759px': {
    top: 'max(12px, env(safe-area-inset-top))',
    right: '12px',
    left: '12px',
    width: 'auto',
  },
}

function severityOf(message: { severity?: string }): ToastSeverity {
  return message.severity === 'success'
    || message.severity === 'warn'
    || message.severity === 'error'
    ? message.severity
    : 'info'
}
</script>

<template>
  <PrimeToast
    class="cashi-toast"
    position="top-right"
    :base-z-index="9500"
    :breakpoints="toastBreakpoints"
  >
    <template #container="{ message, closeCallback }">
      <div
        class="cashi-toast__card"
        :data-severity="severityOf(message)"
        data-testid="app-toast"
      >
        <span class="cashi-toast__accent" aria-hidden="true" />

        <span class="cashi-toast__icon" aria-hidden="true">
          <component :is="severityIcons[severityOf(message)]" />
        </span>

        <div class="cashi-toast__copy">
          <strong class="cashi-toast__summary">{{ message.summary }}</strong>
          <p v-if="message.detail" class="cashi-toast__detail">{{ message.detail }}</p>
        </div>

        <button
          class="cashi-toast__close"
          type="button"
          aria-label="Cerrar notificación"
          data-testid="toast-close"
          @click="closeCallback"
        >
          <IconX aria-hidden="true" />
        </button>
      </div>
    </template>
  </PrimeToast>
</template>

<style>
.cashi-toast.p-toast {
  top: 18px;
  right: 18px;
  width: min(390px, calc(100vw - 36px));
  z-index: 9500 !important;
}

.cashi-toast .p-toast-message {
  margin: 0 0 10px;
  overflow: visible;
  border: 0;
  border-radius: 16px;
  background: transparent;
  box-shadow: none;
}

.cashi-toast__card {
  --toast-tone: var(--color-accent);
  --toast-soft: #eef3ff;
  --toast-line: rgba(31, 90, 255, 0.22);
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 46px;
  align-items: start;
  gap: 11px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--toast-line);
  border-radius: 16px 11px 11px 16px;
  background:
    radial-gradient(circle at 92% 10%, color-mix(in srgb, var(--toast-tone) 11%, transparent) 0 2px, transparent 2.5px),
    linear-gradient(135deg, #fff 0%, var(--color-paper) 100%);
  background-size: 12px 12px, auto;
  box-shadow: 0 18px 50px rgba(25, 24, 23, 0.18), 0 3px 10px rgba(25, 24, 23, 0.08);
  padding: 13px 9px 13px 14px;
  color: var(--color-ink);
}

.cashi-toast__card::after {
  position: absolute;
  right: 10px;
  bottom: 0;
  left: 14px;
  height: 3px;
  background: repeating-linear-gradient(90deg, var(--toast-tone) 0 4px, transparent 4px 8px);
  content: '';
  opacity: 0.38;
}

.cashi-toast__card[data-severity='success'] {
  --toast-tone: var(--color-positive);
  --toast-soft: #eaf7f3;
  --toast-line: rgba(15, 123, 108, 0.24);
}

.cashi-toast__card[data-severity='warn'] {
  --toast-tone: #9a6700;
  --toast-soft: #fff7df;
  --toast-line: rgba(154, 103, 0, 0.24);
}

.cashi-toast__card[data-severity='error'] {
  --toast-tone: var(--color-negative);
  --toast-soft: #fff0e9;
  --toast-line: rgba(194, 65, 12, 0.24);
}

.cashi-toast__accent {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  background: var(--toast-tone);
}

.cashi-toast__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--toast-line);
  border-radius: 12px;
  background: var(--toast-soft);
  color: var(--toast-tone);
  transform: rotate(-3deg);
}

.cashi-toast__icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2.2;
}

.cashi-toast__copy {
  min-width: 0;
  padding: 1px 0 2px;
}

.cashi-toast__summary {
  display: block;
  overflow-wrap: anywhere;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.cashi-toast__detail {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: var(--color-muted);
  font-size: 12.5px;
  line-height: 1.4;
}

.cashi-toast__close {
  display: grid;
  width: 46px;
  height: 46px;
  margin-top: -2px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, transform 150ms ease;
}

.cashi-toast__close:hover {
  background: var(--toast-soft);
  color: var(--toast-tone);
}

.cashi-toast__close:active {
  transform: scale(0.94);
}

.cashi-toast__close svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.2;
}

.cashi-toast .p-toast-message-enter-active {
  animation: cashi-toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cashi-toast .p-toast-message-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.cashi-toast .p-toast-message-leave-to {
  opacity: 0;
  transform: translate3d(14px, -4px, 0) scale(0.97);
}

@keyframes cashi-toast-in {
  from {
    opacity: 0;
    transform: translate3d(22px, -5px, 0) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@media (width < 760px) {
  .cashi-toast.p-toast {
    top: max(12px, env(safe-area-inset-top));
    right: 12px;
    left: 12px;
    width: auto;
  }

  .cashi-toast .p-toast-message {
    margin-bottom: 8px;
  }

  .cashi-toast__card {
    grid-template-columns: 36px minmax(0, 1fr) 46px;
    gap: 9px;
    border-radius: 14px 9px 9px 14px;
    padding: 11px 7px 11px 12px;
  }

  .cashi-toast__icon {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .cashi-toast__icon svg {
    width: 18px;
    height: 18px;
  }

  .cashi-toast__summary {
    font-size: 13.5px;
  }

  .cashi-toast__detail {
    font-size: 12px;
  }

  .cashi-toast__close {
    margin-top: -4px;
  }

  .cashi-toast .p-toast-message-enter-active {
    animation-name: cashi-toast-in-mobile;
  }
}

@keyframes cashi-toast-in-mobile {
  from {
    opacity: 0;
    transform: translate3d(0, -18px, 0) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}
</style>
