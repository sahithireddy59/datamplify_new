import { Directive, Input, TemplateRef, ViewContainerRef, EmbeddedViewRef, Renderer2, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionService } from '../../services/permission.service';
import { ToastrService } from 'ngx-toastr';

type Mode = 'hide' | 'disable';
type DirectiveInput = number | { id: number; mode?: Mode };

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private embeddedView?: EmbeddedViewRef<any>;
  private sub = new Subscription();
  private currentId?: number;
  private currentMode: Mode = 'hide';

  constructor( private tpl: TemplateRef<any>, private vcr: ViewContainerRef, private renderer: Renderer2, private permissionService: PermissionService, private toastr: ToastrService) {
    // subscribe to permission stream so we can react to updates
    this.sub.add(
      this.permissionService.permissionsObservable().subscribe(() => {
        this.updateView();
      })
    );
  }

  @Input()
  set appHasPermission(input: DirectiveInput) {
    if (typeof input === 'number') {
      this.currentId = input;
      this.currentMode = 'hide';
    } else if (input && typeof input === 'object') {
      this.currentId = input.id;
      this.currentMode = input.mode ?? 'hide';
    } else {
      this.currentId = undefined;
    }
    this.updateView();
  }

  private updateView() {
    // clear previous view
    if (this.embeddedView) {
      this.vcr.clear();
      this.embeddedView = undefined;
    }

    if (this.currentId == null) return;

    const has = this.permissionService.hasPermission(this.currentId);

    if (this.currentMode === 'hide') {
      // show only when permitted
      if (has) {
        this.embeddedView = this.vcr.createEmbeddedView(this.tpl);
      }
    } else { // disable mode -> always render
      this.embeddedView = this.vcr.createEmbeddedView(this.tpl);
      // after view is created, modify root nodes to disabled state if necessary
      if (!has) {
        // apply disable to each root node of the embedded view
        // rootNodes can be multiple (text nodes, elements) - handle elements only
        const nodes = this.embeddedView.rootNodes;
        nodes.forEach(node => {
          if (node instanceof HTMLElement) {
            this.disableElement(node);
          }
        });
      } else {
        // ensure enabled state if permission granted
        const nodes = this.embeddedView.rootNodes;
        nodes.forEach(node => {
          if (node instanceof HTMLElement) {
            this.enableElement(node);
          }
        });
      }
    }
  }

  private disableElement(el: HTMLElement) {
    // set disabled attribute for known interactive elements
    const tag = el.tagName.toLowerCase();

    // Buttons and inputs support disabled attribute
    if (['button', 'input', 'select', 'textarea'].includes(tag)) {
      // this.renderer.setAttribute(el, 'disabled', 'true');
    }

    // For anchors or other elements: block interactions and provide ARIA
    this.renderer.setAttribute(el, 'aria-disabled', 'true');
    // this.renderer.setStyle(el, 'pointer-events', 'none');
    this.renderer.setStyle(el, 'opacity', '0.5');
    // this.renderer.setStyle(el, 'cursor', 'not-allowed');
    // remove from tab order
    this.renderer.setAttribute(el, 'tabindex', '-1');

    this.renderer.setAttribute(el, 'title', 'You don’t have permission to perform this action.');

    const preventClick = (e: Event) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.toastr.warning('You don’t have permission to perform this action.', 'Permission Denied');
    };
    el.addEventListener('click', preventClick, true);
    // Store a reference to remove it later
    (el as any).__permissionClickBlock__ = preventClick;

    // if there are interactive children, also disable them
    const focusables = el.querySelectorAll('a,button,input,select,textarea,[tabindex]');
    focusables.forEach((child: Element) => {
      const c = child as HTMLElement;
      this.renderer.setAttribute(c, 'aria-disabled', 'true');
      // this.renderer.setStyle(c, 'pointer-events', 'none');
      this.renderer.setAttribute(c, 'tabindex', '-1');
      if (c.tagName.toLowerCase() === 'button' || c.tagName.toLowerCase() === 'input') {
        // this.renderer.setAttribute(c, 'disabled', 'true');
      }
    });

    // add a CSS class for styling if app wants to override
    this.renderer.addClass(el, 'app-permission-disabled');
  }

  private enableElement(el: HTMLElement) {
    if (['button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      // this.renderer.removeAttribute(el, 'disabled');
    }
    this.renderer.removeAttribute(el, 'aria-disabled');
    // this.renderer.removeStyle(el, 'pointer-events');
    this.renderer.removeStyle(el, 'opacity');
    // this.renderer.removeStyle(el, 'cursor');
    this.renderer.removeAttribute(el, 'tabindex');

    this.renderer.removeAttribute(el, 'title');

    const blocked = (el as any).__permissionClickBlock__;
    if (blocked) {
      el.removeEventListener('click', blocked, true);
      delete (el as any).__permissionClickBlock__;
    }

    const focusables = el.querySelectorAll('a,button,input,select,textarea,[tabindex]');
    focusables.forEach((child: Element) => {
      const c = child as HTMLElement;
      this.renderer.removeAttribute(c, 'aria-disabled');
      // this.renderer.removeStyle(c, 'pointer-events');
      this.renderer.removeAttribute(c, 'tabindex');
      if (c.tagName.toLowerCase() === 'button' || c.tagName.toLowerCase() === 'input') {
        this.renderer.removeAttribute(c, 'disabled');
      }
    });

    this.renderer.removeClass(el, 'app-permission-disabled');
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
