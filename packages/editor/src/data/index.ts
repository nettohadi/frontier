import { debounce } from '@src/utils/helperFunctions';

import { ElementType } from '@frontbuilder/renderer';
import pages from '@src/api/pages';
import { current } from '@src/common/current';

export let initialData: ElementType = {
  id: '0.1',
  uuid: '0.1',
  type: 'Box',
  isFunctionComponent: true,
  contentIsEditable: false,
  className: 'fr-box droppable',
  tags: ['fixed-width', 'fixed-height'],
  props: {
    name: 'Root',
    padding: '0px',
    height: 'auto',
    width: '100%',
    display: 'flex',
    backgroundColor: 'rgb(250 250 250 / 1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  children: [],
  hiddenProps: ['width', 'height', 'minHeight'],
};

let _data: ElementType | string = '';

const data = {
  get: () => {
    return _data;
  },
  set: (value: any) => {
    _data = value;
  },
  refresh: () => {
    _data = { ...(_data as ElementType) };
  },
  persistToCloud: debounce(async () => {
    console.log('persisted to local storage');
    pages.updateDraft(current.page.id || '', _data);
  }),
  get initialData() {
    return initialData;
  },
};

export default data;