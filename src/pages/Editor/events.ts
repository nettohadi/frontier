import { current } from '@src/common/current';
import { ElementType, ParentType } from '@src/types';
import global from '@src/global';
import {
  addChildElement,
  addChildElementAfter,
  addChildElementBefore,
  updateElementProp,
} from '@src/global/element';
import {
  applyHoverEffect,
  removeClasses,
  removeHoverEffect,
} from '@src/utils/helperFunctions';

let pushPosition = 'after';

export const commonEvent = (
  element: ElementType,
  parent: ParentType,
  rerender: () => void,
  rerenderElement: () => void
) => {
  if (global.getMode() === 'preview') return {};

  const selectElement = () => {
    if (current.isEditingTextContent() && element === current.getElement())
      return;

    current.setElement(element);
    current.setParent(parent);
    current.setRerender(rerenderElement);

    if (current.isEditingTextContent()) {
      current.setIsEditingTextContent(false);
    }

    // turn off resizing status
    current.setIsResizing({ width: false, height: false });
    // rerender current element
    rerender();
  };

  element['select'] = selectElement;

  return {
    onMouseOver: (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      applyHoverEffect(element.id);
    },
    onMouseMove: (e: any) => {},
    onMouseOut: (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      removeHoverEffect();
    },
    onClick: (e: any) => {
      e.preventDefault();
      e.stopPropagation();

      selectElement();
    },
    onDoubleClick: (e: any) => {
      e.preventDefault();
      e.stopPropagation();

      if (!element.contentIsEditable) return;

      current.setIsEditingTextContent(true);
      rerender();
    },
    onKeyUp: (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      if (!current.isEditingTextContent()) return;

      updateElementProp(element, {
        textContent: e.target.innerHTML,
      });
    },
  };
};

export const draggableEvent = (
  element: ElementType | null,
  parent: ParentType,
  rerender: () => void,
  isAdding: boolean = false
) => {
  if (global.getMode() === 'preview') return {};
  const isEditingTextContent = current.isEditingTextContent();

  return {
    draggable: !isEditingTextContent,
    onDragStart: (e: any) => {
      if (isEditingTextContent) return;

      console.log({ initialParent: parent });
      document.body.style.cursor = 'default';
      e.target.style.opacity = 0;
      e.dataTransfer.setDragImage(div, 10, 10);
    },
    onDragEnd: (e: any) => {
      removeClasses(['hover-all', 'hover-right', 'hover-left']);
      if (isEditingTextContent) return;

      e.stopPropagation();
      e.preventDefault();
      e.target.style.opacity = 1;
      const targetElement = current.getTargetElement();
      const targetParent = current.getTargetParent();
      const currentTargetIndex = targetParent?.children.indexOf(
        current.getTargetElement() as any
      );

      // bail if any of the below is null
      if (!targetParent || !element || !targetElement) return;

      // should not be able to drop on itself
      if (targetParent === element) return;

      // should not be able to drop on its children
      if (
        targetParent?.id.startsWith(element?.id) &&
        targetParent !== element &&
        !isAdding
      )
        return;

      if (
        pushPosition !== 'inside' &&
        (currentTargetIndex === null ||
          currentTargetIndex === undefined ||
          currentTargetIndex === -1)
      ) {
        return;
      }

      element.select = null;
      const newElement: ElementType = JSON.parse(JSON.stringify(element));

      if (pushPosition === 'before' && targetParent) {
        addChildElementBefore(
          targetParent,
          newElement as any,
          currentTargetIndex
        );
      }

      if (pushPosition === 'after' && targetParent) {
        addChildElementAfter(
          targetParent,
          newElement as any,
          currentTargetIndex
        );
      }

      if (pushPosition === 'inside') {
        addChildElement(targetParent, newElement as any);
      }

      //remove excess children
      if (parent) {
        parent.children.splice(parent.children.indexOf(element as any), 1);
      }

      current.setTargetParent(null);
      rerender();
    },
    onDragOver: (e: any) => {
      e.stopPropagation();
      e.preventDefault();

      if (isEditingTextContent) return;

      while (e.target) {
        if (e.target.classList?.contains('selectable')) {
          e.target.classList.add('hover-all');
          break;
        }
        e.target = e.target.parentNode;
      }

      if (!e.target) return;
      const rect = e.target.getBoundingClientRect();
      e.target.classList.remove('hover-right');
      e.target.classList.remove('hover-left');
      e.target.classList.remove('hover-all');

      if (rect.right - e.clientX <= rect.width / 3) {
        e.target.classList.add('hover-right');
        pushPosition = 'after';
      } else if (e.clientX - rect.left <= rect.width / 3) {
        e.target.classList.add('hover-left');
        pushPosition = 'before';
      } else if (e.target.classList.contains('droppable')) {
        e.target.classList.add('hover-all');
        pushPosition = 'inside';
      }

      if (
        e.target?.classList.contains('droppable') &&
        pushPosition === 'inside'
      ) {
        current.setTargetParent(element);
      } else {
        current.setTargetParent(parent);
      }
    },
    onDragEnter: (e: any) => {
      e.stopPropagation();
      e.preventDefault();

      if (isEditingTextContent) return;

      while (e.target) {
        if (e.target.classList?.contains('selectable')) {
          break;
        }
        e.target = e.target.parentNode;
      }
      current.setTargetElement(element);
    },
    onDragLeave: (e: any) => {
      e.stopPropagation();
      e.preventDefault();

      if (isEditingTextContent) return;

      while (e.target) {
        if (e.target.classList?.contains('selectable')) {
          e.target.classList.remove('hover-selected');
          e.target.classList.remove('hover-all');
          e.target.classList.remove('hover-left');
          e.target.classList.remove('hover-right');
          break;
        }
        e.target = e.target.parentNode;
      }
    },
  };
};

const div = document.createElement('div');
div.style.width = '30px';
div.style.height = '30px';
div.style.position = 'fixed';
div.style.top = '-50px';
div.style.borderRadius = '50%';
div.style.backgroundColor = '#4bcccc';
document.body.appendChild(div);
