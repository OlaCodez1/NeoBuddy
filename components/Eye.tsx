
import React, { useState, useEffect } from 'react';
import { RobotState } from '../types';

interface EyeProps {
  state: RobotState;
  position: { x: number; y: number };
  audioLevel?: number;
  // Fix: Added isRight property to resolve TypeScript error in Face.tsx where it is passed as a prop.
  isRight?: boolean;
}

const Eye: React.FC<EyeProps> = ({ state, position, audioLevel = 0, isRight }) => {
  const [isBlinking, setIsBlinking] = useState(false);
  
  useEffect(() => {
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120);
      setTimeout(triggerBlink, 2000 + Math.random() * 6000);
    };
    const id = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(id);
  }, []);

  // Dynamics
  let scaleY = 1;
  let pupilSize = 0.5;
  let lidHeight = 0;
  let glowColor = '#22d3ee';
  let rotation = 0;

  if (isBlinking) {
    scaleY = 0.05;
    lidHeight = 100;
  } else {
    switch (state) {
      case RobotState.LISTENING:
        pupilSize = 0.7;
        glowColor = '#34d399';
        break;
      case RobotState.THINKING:
        scaleY = 0.8;
        lidHeight = 30;
        rotation = isRight ? 5 : -5;
        glowColor = '#a855f7';
        break;
      case RobotState.HAPPY:
        lidHeight = -20;
        rotation = isRight ? -10 : 10;
        break;
      case RobotState.SNEEZING:
        scaleY = 1.3;
        pupilSize = 0.2;
        glowColor = '#f43f5e';
        break;
      case RobotState.SPEAKING:
        pupilSize = 0.5 + audioLevel * 0.5;
        scaleY = 1 + audioLevel * 0.2;
        break;
      case RobotState.SINGING:
        rotation = Math.sin(Date.now() / 200) * 15;
        pupilSize = 0.6 + Math.sin(Date.now() / 150) * 0.1;
        break;
      case RobotState.DISTORTED:
        rotation = (Math.random() - 0.5) * 40;
        scaleY = 0.5 + Math.random();
        break;
    }
  }

  const lookX = position.x * 25;
  const lookY = position.y * 15;

  return (
    <div 
      className="relative flex items-center justify-center transition-all duration-[400ms] cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      style={{
        width: '100px',
        height: '110px',
        transform: `translate(${lookX}px, ${lookY}px) scaleY(${scaleY}) rotate(${rotation}deg)`,
      }}
    >
      {/* Outer Halo */}
      <div 
        className="absolute inset-0 blur-2xl opacity-30 transition-colors duration-500"
        style={{ backgroundColor: glowColor, borderRadius: '35%' }}
      />
      
      {/* Main Sclera */}
      <div 
        className="relative w-full h-full bg-cyan-400 overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.5)]"
        style={{ borderRadius: '35%', transition: 'background-color 0.5s ease' }}
      >
        {/* Upper Lid Mask */}
        <div 
          className="absolute top-0 left-0 w-full bg-black/40 z-20 transition-all duration-300"
          style={{ height: `${Math.max(0, lidHeight)}%` }}
        />
        {/* Lower Lid Mask */}
        <div 
          className="absolute bottom-0 left-0 w-full bg-black/40 z-20 transition-all duration-300"
          style={{ height: `${Math.max(0, -lidHeight)}%` }}
        />

        {/* Pupil & Iris assembly */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translate(${position.x * 10}px, ${position.y * 10}px)` }}
        >
          <div 
            className="rounded-full bg-black/80 blur-[1px] transition-all duration-300"
            style={{ 
              width: `${pupilSize * 80}%`, 
              height: `${pupilSize * 80}%` 
            }}
          >
            {/* Pupil Glint */}
            <div className="absolute top-[20%] left-[25%] w-1/4 h-1/4 bg-white/30 rounded-full blur-[1px]" />
          </div>
        </div>

        {/* Surface Scanline */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
      </div>
    </div>
  );
};

export default Eye;
