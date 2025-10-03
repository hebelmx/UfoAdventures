export function setOverlayVisible(overlay: HTMLElement | null, visible: boolean, focusSelector?: string): void {
    if (!overlay) {
        return;
    }

    overlay.style.display = visible ? 'flex' : 'none';
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!visible) {
        return;
    }

    const focus = () => {
        const explicit = focusSelector ? overlay.querySelector<HTMLElement>(focusSelector) : null;
        const preferred = explicit || overlay.querySelector<HTMLElement>('[data-autofocus]');
        const fallback = preferred || overlay.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"], [tabindex]:not([tabindex="-1"])');
        const target = fallback || overlay;
        if (typeof target.focus === 'function') {
            target.focus({ preventScroll: true });
        }
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(focus);
    } else {
        focus();
    }
}
