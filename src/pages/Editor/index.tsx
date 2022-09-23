import React from 'react';

import './index.css';
import data from '@src/data';
import Render from '@components/Render';
import global from '@src/global';
import PageData from '@src/context';
import ElementContainer from './ElementContainer';
import PropsEditor from '@components/PropsEditor';

export default function Editor() {
  console.log('renders editor');
  const [state, rerender] = React.useState<boolean>(false);
  const [props, setProps] = React.useState();

  global.setMode('edit', 'mode is set to edit');

  React.useEffect(() => {
    data.persistToLocalStorage();
  }, [state]);

  return (
    <PageData.Provider value={() => rerender((s) => !s)}>
      <div className="editor-wrapper">
        <div id="edit-box">
          <ElementContainer />
        </div>
        <div id="canvas">
          <Render element={data.get()} parent={null} />
        </div>
        <div id="style-panel">
          <PropsEditor />
        </div>
      </div>
    </PageData.Provider>
  );
}