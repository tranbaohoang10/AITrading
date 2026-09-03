import '@testing-library/jest-dom/vitest'

// jsdom does not expose PointerEvent, while chart gestures intentionally use
// pointer input so mouse, pen and touch share one implementation.
if (!window.PointerEvent) window.PointerEvent = MouseEvent as typeof PointerEvent

// jsdom lacks native dialog methods. Real focus/inert behavior is verified in-browser.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
