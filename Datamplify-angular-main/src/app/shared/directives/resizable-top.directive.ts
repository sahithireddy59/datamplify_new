import { Directive, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[resizableTop]',
  standalone: true,
})
export class ResizableTopDirective {
  private startY = 0;
  private startHeight = 175; // Initial default
  private currentHeight = 175;
  private topPaneHeight = 0;
  private topPane!: HTMLElement;
  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {
    this.renderer.setStyle(this.el.nativeElement, 'height', `${this.currentHeight}px`);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('resize-handle')) {
    //   this.startY = event.clientY;
    //   this.startHeight = this.currentHeight;

    //   document.documentElement.addEventListener('mousemove', this.onMouseMove);
    //   document.documentElement.addEventListener('mouseup', this.onMouseUp);
    //   event.preventDefault();
    const container = this.el.nativeElement.parentElement;

    if (container && container.children.length >= 2) {
      this.topPane = container.children[0] as HTMLElement;

      // Get current height values
      this.startHeight = this.el.nativeElement.getBoundingClientRect().height;
      this.topPaneHeight = this.topPane.getBoundingClientRect().height;
    }

    this.startY = event.clientY;

    document.documentElement.addEventListener('mousemove', this.onMouseMove);
    document.documentElement.addEventListener('mouseup', this.onMouseUp);
    event.preventDefault();

    }
  }

//   private onMouseMove = (event: MouseEvent): void => {
//     const dy = event.clientY - this.startY;
//     const newHeight = this.startHeight - dy;

//     const minHeight = 75;
//     const container = this.el.nativeElement.parentElement;
//     const containerHeight = container?.clientHeight || 0;
//     const maxHeight = containerHeight;

//     if (newHeight >= minHeight) {
//       this.currentHeight = newHeight;
//       this.renderer.setStyle(this.el.nativeElement, 'height', `${newHeight}px`);
//     }
//   };


private onMouseMove = (event: MouseEvent): void => {
    const dy = event.clientY - this.startY;
    const newBottomHeight = this.startHeight - dy;
    const newTopHeight = this.topPaneHeight + dy;

    const minHeight = 48;

    if (newBottomHeight >= minHeight && newTopHeight >= minHeight) {
      this.renderer.setStyle(this.el.nativeElement, 'height', `${newBottomHeight}px`);
      this.renderer.setStyle(this.topPane, 'height', `${newTopHeight}px`);
    }
  };
  private onMouseUp = (): void => {
    document.documentElement.removeEventListener('mousemove', this.onMouseMove);
    document.documentElement.removeEventListener('mouseup', this.onMouseUp);
  };
}
