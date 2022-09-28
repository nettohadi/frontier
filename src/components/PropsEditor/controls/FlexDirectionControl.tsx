import React from 'react';
import * as S from '@components/PropsEditor/controls/shared';
import { MdTableRows, MdViewColumn } from 'react-icons/md';

const FlexDirectionControl = ({ setStyle, name, value, label }: any) => {
  const [direction, setDirection] = React.useState(value);

  React.useEffect(() => {
    setDirection(value);
  }, [value]);

  const handleClick = (_value: any) => {
    setStyle({ [name]: _value }, true);
    setDirection(_value);
  };
  return (
    <S.Container>
      <label>{label}</label>
      <S.OptionsContainer>
        <S.OptionIcon
          selected={direction === 'row'}
          onClick={() => handleClick('row')}
        >
          <MdViewColumn />
        </S.OptionIcon>
        <S.OptionIcon
          selected={direction === 'column'}
          onClick={() => handleClick('column')}
        >
          <MdTableRows />
        </S.OptionIcon>
      </S.OptionsContainer>
    </S.Container>
  );
};

export default FlexDirectionControl;