import React from 'react';

export const RetroUI: React.FC = () => {
  return (
    <>
      <div className="scanlines" />
      <div className="vignette" />
      <div className="absolute bottom-2 right-2 text-[10px] text-green-900 font-mono pointer-events-none z-40">
        KRONOS-OS v3.1
      </div>
    </>
  );
};