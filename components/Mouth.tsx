
import React, { useMemo, useEffect, useState } from 'react';
import { RobotState } from '../types';

interface MouthProps {
  state: RobotState;
  audioLevel: number;
}

const Mouth: React.FC<MouthProps> = ({ state, audioLevel }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setTime(prev => prev + 0.1);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  // Fix: Move level outside useMemo to make it available for the drop-shadow filter in the return statement.
  const level = Math.max(0, audioLevel);

  const path = useMemo(() => {
    if (state === RobotState.SPEAKING) {
      // Fluid "talking" shape - opens vertically based on level
      const h = 5 + level * 70;
      const w = 50 + level * 20;
      return `M ${-w/2} 0 Q 0 ${h} ${w/2} 0 Q 0 ${-h} ${-w/2} 0`;
    } 
    
    if (state === RobotState.SINGING) {
      // Rhythmic oscillation - circular but pulsing
      const r = 20 + Math.sin(time * 2) * 10;
      return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0`;
    }

    if (state === RobotState.DISTORTED) {
      // Glitchy zigzag
      return `M -40 ${(Math.random()-0.5)*20} L -20 ${(Math.random()-0.5)*20} L 0 ${(Math.random()-0.5)*20} L 20 ${(Math.random()-0.5)*20} L 40 ${(Math.random()-0.5)*20}`;
    }

    if (state === RobotState.SNEEZING) {
      return `M -5 0 L 0 -10 L 5 0 L 0 5 Z`; // Tiny nose-like twitch
    }

    if (state === RobotState.HAPPY) {
      return `M -30 -5 Q 0 20 30 -5`; // Wide smile
    }

    // Default: Breathing line
    const breath = Math.sin(time) * 3;
    const w = 40 + Math.cos(time * 0.5) * 5;
    return `M ${-w/2} 0 Q 0 ${breath + (state === RobotState.LISTENING ? 8 : 0)} ${w/2} 0`;
  }, [state, level, time]);

  return (
    <div className="mt-16 flex justify-center items-center relative h-32 w-full">
      <svg viewBox="-100 -100 200 200" className="w-64 h-64 overflow-visible">
        <defs>
          <filter id="mouthGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <path
          d={path}
          fill={state === RobotState.SPEAKING || state === RobotState.SINGING ? 'rgba(34, 211, 238, 0.2)' : 'none'}
          stroke="#22d3ee"
          strokeWidth={state === RobotState.SPEAKING ? 10 : 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#mouthGlow)"
          className="transition-all duration-150 ease-out"
          style={{
            filter: `drop-shadow(0 0 ${15 + level * 40}px rgba(34, 211, 238, 0.8))`,
          }}
        />
      </svg>
    </div>
  );
};

export default Mouth;
