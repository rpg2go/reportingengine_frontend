import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  Renderer2,
  inject,
} from '@angular/core';

/**
 * ColResizerDirective — appColResizer
 *
 * Attaches a thin drag-handle bar to the right edge of any `<th>` it decorates.
 * Dragging it emits the new pixel width via `(widthChanged)`.
 *
 * Usage:
 *   <th appColResizer [minWidth]="80" (widthChanged)="onColumnWidthChanged(0, $event)">
 *     Column Label
 *   </th>
 */
@Directive({
  selector: '[appColResizer]',
  standalone: true,
})
export class ColResizerDirective implements OnDestroy {

  /** Minimum column width in pixels (default: 40). */
  @Input() minWidth: number = 40;

  /** Emits the new width in pixels after each completed drag. */
  @Output() widthChanged = new EventEmitter<number>();

  private el      = inject(ElementRef);
  private renderer = inject(Renderer2);

  private handle!: HTMLElement;
  private isDragging   = false;
  private startX       = 0;
  private startWidth   = 0;

  // Document-level listener teardown refs
  private unlistenMouseMove?: () => void;
  private unlistenMouseUp?  : () => void;

  constructor() {
    this.createHandle();
  }

  ngOnDestroy(): void {
    this.teardownListeners();
    if (this.handle?.parentNode) {
      this.handle.parentNode.removeChild(this.handle);
    }
  }

  // ── Handle creation ────────────────────────────────────────────────────────

  private createHandle(): void {
    const host: HTMLElement = this.el.nativeElement;

    // Ensure the host `<th>` has relative positioning so the handle can
    // be pinned absolutely to its right edge.
    this.renderer.setStyle(host, 'position', 'relative');

    this.handle = this.renderer.createElement('span') as HTMLElement;

    // Styling: thin vertical bar on the right edge
    const styles: Record<string, string> = {
      position:       'absolute',
      top:            '0',
      right:          '0',
      width:          '5px',
      height:         '100%',
      cursor:         'col-resize',
      'user-select':  'none',
      'z-index':      '20',
      background:     'transparent',
      transition:     'background 0.15s ease',
    };

    Object.entries(styles).forEach(([prop, val]) =>
      this.renderer.setStyle(this.handle, prop, val)
    );

    // Hover highlight
    this.renderer.listen(this.handle, 'mouseenter', () =>
      this.renderer.setStyle(this.handle, 'background', 'rgba(99, 102, 241, 0.45)')
    );
    this.renderer.listen(this.handle, 'mouseleave', () => {
      if (!this.isDragging) {
        this.renderer.setStyle(this.handle, 'background', 'transparent');
      }
    });

    this.renderer.listen(this.handle, 'mousedown', (e: MouseEvent) =>
      this.onHandleMouseDown(e)
    );

    this.renderer.appendChild(host, this.handle);
  }

  // ── Drag lifecycle ─────────────────────────────────────────────────────────

  private onHandleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDragging = true;
    this.startX     = event.clientX;
    this.startWidth = (this.el.nativeElement as HTMLElement).getBoundingClientRect().width;

    // Apply global resizing cursor so dragging outside the handle feels smooth
    this.renderer.addClass(document.body, 'col-resizing');
    this.renderer.setStyle(this.handle, 'background', 'rgba(99, 102, 241, 0.7)');

    this.unlistenMouseMove = this.renderer.listen('document', 'mousemove', (e: MouseEvent) =>
      this.onMouseMove(e)
    );
    this.unlistenMouseUp = this.renderer.listen('document', 'mouseup', () =>
      this.onMouseUp()
    );
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) { return; }
    const delta    = event.clientX - this.startX;
    const newWidth = Math.max(this.minWidth, this.startWidth + delta);
    this.renderer.setStyle(this.el.nativeElement, 'width', `${newWidth}px`);
  }

  private onMouseUp(): void {
    if (!this.isDragging) { return; }
    this.isDragging = false;

    const finalWidth = Math.max(
      this.minWidth,
      (this.el.nativeElement as HTMLElement).getBoundingClientRect().width
    );

    this.widthChanged.emit(finalWidth);

    this.renderer.removeClass(document.body, 'col-resizing');
    this.renderer.setStyle(this.handle, 'background', 'transparent');
    this.teardownListeners();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private teardownListeners(): void {
    this.unlistenMouseMove?.();
    this.unlistenMouseMove = undefined;
    this.unlistenMouseUp?.();
    this.unlistenMouseUp = undefined;
  }

  // Prevent text selection when the user clicks inside the header cell itself
  @HostListener('mousedown', ['$event'])
  onHostMouseDown(event: MouseEvent): void {
    // Only suppress selection start — not clicks on inputs inside the cell
    if (event.target === this.handle) {
      event.preventDefault();
    }
  }
}
