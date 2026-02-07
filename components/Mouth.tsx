
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

  // Normalize audio level for lip-sync
  const level = Math.max(0, audioLevel);

  const path = useMemo(() => {
    if (state === RobotState.SPEAKING) {
      const h = 6 + level * 120; 
      const w = 55 - level * 15; 
      return `M ${-w/2} 0 Q 0 ${h} ${w/2} 0 Q 0 ${-h} ${-w/2} 0`;
    } 
    
    if (state === RobotState.SINGING) {
      const baseR = 25;
      const pulse = Math.sin(time * 3.5) * 8;
      const r = baseR + pulse;
      return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0`;
    }

    if (state === RobotState.DISTORTED) {
      const off = () => (Math.random() - 0.5) * 40;
      return `M -50 ${off()} L -20 ${off()} L 10 ${off()} L 40 ${off()}`;
    }

    if (state === RobotState.HAPPY) {
      const bounce = Math.sin(time * 2) * 2;
      return `M -40 -8 Q 0 ${22 + bounce} 40 -8`;
    }

    if (state === RobotState.LISTENING) {
      const pulse = Math.sin(time * 1.5) * 3;
      return `M -25 0 Q 0 ${12 + pulse} 25 0`;
    }

    // Default/IDLE: Resting digital line with subtle breathing and organic noise
    // Added noise factors (Math.sin with different frequencies) to prevent static look
    const noiseY = Math.sin(time * 0.8) * 4 + Math.sin(time * 2.2) * 1.5;
    const noiseW = Math.cos(time * 0.4) * 5 + Math.sin(time * 1.7) * 2;
    const w = 45 + noiseW;
    
    return `M ${-w/2} 0 Q 0 ${noiseY} ${w/2} 0`;
  }, [state, level, time]);

  return (
    <div className="mt-20 flex justify-center items-center relative h-32 w-full">
      <svg viewBox="-100 -100 200 200" className="w-80 h-80 overflow-visible">
        <defs>
          <filter id="mouthGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Dynamic Shadow Layer */}
        <path
          d={path}
          fill="none"
          stroke="rgba(34, 211, 238, 0.4)"
          strokeWidth={state === RobotState.SPEAKING ? 20 : 0}
          className="transition-all duration-150 blur-md"
        />

        <path
          d={path}
          fill={state === RobotState.SPEAKING || state === RobotState.SINGING ? 'rgba(34, 211, 238, 0.1)' : 'none'}
          stroke="#22d3ee"
          strokeWidth={state === RobotState.SPEAKING ? 14 : 7}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#mouthGlow)"
          className="transition-all duration-[100ms] ease-out"
          style={{
            filter: `drop-shadow(0 0 ${12 + level * 60}px rgba(34, 211, 238, 1))`,
            transform: state === RobotState.SPEAKING && level > 0.05 
              ? `translate(${(Math.random()-0.5)*3}px, ${(Math.random()-0.5)*3}px)` 
              : 'none'
          }}
        />
        
        {/* Highlight Polish */}
        {(state === RobotState.SPEAKING || state === RobotState.SINGING) && (
           <path
           d={path}
           fill="none"
           stroke="white"
           strokeWidth={3}
           strokeLinecap="round"
           className="opacity-40"
           style={{ transform: 'scale(0.85)' }}
         />
        )}
      </svg>
    </div>
  );
};

export default Mouth;
