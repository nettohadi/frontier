let _data = {
  id: '1',
  type: 'div',
  props: {
    className: 'element',
    style: {
      padding: '20px',
      backgroundColor: 'white',
      color: 'black',
      height: '100%',
      width: '90%',
    },
  },
  children: [
    {
      id: '1',
      type: 'div',
      props: {
        className: 'element',
        style: {
          padding: '20px',
          backgroundColor: 'white',
          color: 'black',
          height: '100%',
          width: '90%',
        },
      },
      children: ['Hello World 1'],
    },
    {
      id: '2',
      type: 'Box',
      isFunctionComponent: true,
      props: {
        className: 'element',
        style: {
          padding: '20px',
          backgroundColor: 'red',
          color: 'white',
          height: '100%',
          width: '90%',
        },
      },
      children: [
        {
          id: '3',
          type: 'Button',
          isFunctionComponent: true,
          props: {
            className: 'element',
            style: {
              padding: '20px',
              backgroundColor: 'white',
              color: 'black',
              height: '100%',
              width: '100px',
            },
          },
          children: ['Hello World'],
        },
      ],
    },
  ],
};

const data = {
  get: () => _data,
  set: (value: any) => {
    _data = value;
  },
};

export default data;