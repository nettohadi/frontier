import { current } from '@src/common/current';
import { ElementType } from '@src/types';
import global from '@src/global';

export const commonEvent = (
  element: ElementType,
  parent: ElementType | null,
  rerender: () => void
) => {
  if (!global.getEditMode()) return {};
  return {
    onMouseOver: (e: any) => {
      e.preventDefault();
      e.stopPropagation();

      while (e.target) {
        if (e.target.classList.contains('selectable')) {
          e.target.classList.add('hover-selected');
          break;
        }
        e.target = e.target.parentNode;
      }
    },
    onMouseMove: (e: any) => {
      // console.clear();
      // console.log('mouse move', e.target);
    },
    onMouseOut: (e: any) => {
      e.preventDefault();
      e.stopPropagation();

      while (e.target) {
        if (e.target.classList.contains('selectable')) {
          e.target.classList.remove('hover-selected');
          e.target.classList.remove('hover-all');
          e.target.classList.remove('hover-left');
          e.target.classList.remove('hover-right');
          break;
        }
        e.target = e.target.parentNode;
      }
    },
    onClick: (e: any) => {
      e.preventDefault();
      e.stopPropagation();

      current.setElement(element);
      current.setParent(parent);
      current.setNode(e.target);
      rerender();
    },
  };
};
