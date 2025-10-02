export function createPlaceholderImage(width: number, height: number, color: string): string {
    if (typeof document === 'undefined') {
        return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));

    const context = canvas.getContext('2d');
    if (!context) {
        return '';
    }

    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    return canvas.toDataURL();
}
