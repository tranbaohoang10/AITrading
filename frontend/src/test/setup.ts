import '@testing-library/jest-dom/vitest'

// jsdom lacks native dialog methods. Real focus/inert behavior is verified in-browser.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
