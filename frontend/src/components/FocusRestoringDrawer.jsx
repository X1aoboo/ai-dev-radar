import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { Drawer } from 'antd'

const DrawerFocusContext = createContext(null)
const FOCUSABLE_SELECTOR = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [role="button"], [role="combobox"], [tabindex="0"]'

function interactionTarget(target) {
  return target instanceof Element ? target.closest(FOCUSABLE_SELECTOR) : null
}

function transitionTime(element) {
  if (!element) return 0
  const style = getComputedStyle(element)
  const toMilliseconds = (value) => {
    const amount = Number.parseFloat(value) || 0
    return value.trim().endsWith('ms') ? amount : amount * 1000
  }
  const durations = style.transitionDuration.split(',').map(toMilliseconds)
  const delays = style.transitionDelay.split(',').map(toMilliseconds)
  return Math.max(0, ...durations.map((duration, index) => duration + (delays[index % delays.length] ?? 0)))
}

export function DrawerFocusProvider({ children }) {
  const lastInteractionRef = useRef(null)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const remember = (event) => {
      const target = interactionTarget(event.target)
      if (target && !target.disabled && target.getAttribute('aria-disabled') !== 'true') {
        lastInteractionRef.current = target
      }
    }
    const rememberActivation = (event) => {
      if (event.key === 'Enter' || event.key === ' ') remember(event)
    }

    document.addEventListener('pointerdown', remember, true)
    document.addEventListener('focusin', remember, true)
    document.addEventListener('keydown', rememberActivation, true)
    return () => {
      document.removeEventListener('pointerdown', remember, true)
      document.removeEventListener('focusin', remember, true)
      document.removeEventListener('keydown', rememberActivation, true)
    }
  }, [])

  return <DrawerFocusContext.Provider value={lastInteractionRef}>{children}</DrawerFocusContext.Provider>
}

export default function FocusRestoringDrawer({ open, focusable, afterOpenChange, ...props }) {
  const lastInteractionRef = useContext(DrawerFocusContext)
  const triggerRef = useRef(null)
  const restoreTimerRef = useRef(null)
  const openRef = useRef(Boolean(open))
  const wasOpenRef = useRef(Boolean(open))
  openRef.current = Boolean(open)

  function focusTrigger() {
    const target = triggerRef.current
    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current)
    restoreTimerRef.current = null
    if (target?.isConnected) target.focus({ preventScroll: true })
    triggerRef.current = null
  }

  function scheduleFocusTrigger() {
    const target = triggerRef.current
    if (!target?.isConnected || typeof document === 'undefined') return
    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current)
    const wrapper = document.querySelector('.ant-drawer-content-wrapper')
    restoreTimerRef.current = window.setTimeout(() => {
      if (target.isConnected) target.focus({ preventScroll: true })
      if (triggerRef.current === target) triggerRef.current = null
      restoreTimerRef.current = null
    }, transitionTime(wrapper) + 32)
  }

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return
    const active = document.activeElement
    const interaction = lastInteractionRef?.current
    triggerRef.current = interaction?.isConnected
      ? interaction
      : typeof HTMLElement !== 'undefined' && active instanceof HTMLElement && active !== document.body
        ? active
        : null
  }, [lastInteractionRef, open])

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    scheduleFocusTrigger()
  }, [open])

  useEffect(() => () => {
    if (openRef.current) scheduleFocusTrigger()
  }, [])

  function handleAfterOpenChange(nextOpen) {
    afterOpenChange?.(nextOpen)
    if (!nextOpen) focusTrigger()
  }

  function handleClose(event) {
    props.onClose?.(event)
    scheduleFocusTrigger()
  }

  return (
    <Drawer
      {...props}
      open={open}
      onClose={handleClose}
      focusable={lastInteractionRef ? { ...focusable, focusTriggerAfterClose: false } : focusable}
      afterOpenChange={handleAfterOpenChange}
    />
  )
}
