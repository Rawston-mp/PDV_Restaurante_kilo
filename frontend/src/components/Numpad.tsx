import React from 'react';

type NumpadProps = {
  onInput: (n: string) => void;
};

const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export const Numpad = ({ onInput }: NumpadProps) => (
  <div className="grid grid-cols-3 gap-4 p-4">
    {keys.map((n) => (
      <button
        key={n}
        onClick={() => onInput(n.toString())}
        className="h-20 rounded-xl bg-gray-800 text-2xl text-white"
      >
        {n}
      </button>
    ))}
  </div>
);
