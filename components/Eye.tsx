
import React, { useState, useEffect } from 'react';
import { RobotState } from '../types';

interface EyeProps {
  state: RobotState;
  position: { x: number; y: number };
  audioLevel?: number;
  isRight?: boolean;
}

const Eye: React.FC<EyeProps> = ({ state, position, audioLevel = 0, isRight }) => {
  const [isBlinking, setIsBlinking] = useState(false);
  
  useEffect(() => {
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 80);
      setTimeout(triggerBlink, 3000 + Math.random() * 5000);
    };
    const id = setTimeout(triggerBlink, 2000);
    return () => clearTimeout(id);
  }, []);

  // Base state for a "softer" look
  let scaleY = 1;
  let pupilSize = 0.68; // Larger pupils are less creepy
  let lidHeight = 15;   // Slight natural droop
  let glowColor = '#22d3ee';
  let rotation = 0;

  if (isBlinking) {
    scaleY = 0.01;
    lidHeight = 100;
  } else {
    switch (state) {
      case RobotState.LISTENING:
        pupilSize = 0.8;
        glowColor = '#2dd4bf';
        lidHeight = 10;
        break;
      case RobotState.THINKING:
        scaleY = 0.85;
        lidHeight = 40;
        rotation = isRight ? 6 : -6;
        break;
      case RobotState.HAPPY:
        lidHeight = -35;
        rotation = isRight ? -15 : 15;
        break;
      case RobotState.SPEAKING:
        // Pupils react to audio but stay in a friendly range
        pupilSize = 0.65 + audioLevel * 0.35;
        scaleY = 1 + audioLevel * 0.1;
        lidHeight = 12;
        break;
      case RobotState.SINGING:
        rotation = Math.sin(Date.now() / 250) * 18;
        scaleY = 1.05 + Math.sin(Date.now() / 200) * 0.05;
        lidHeight = 10;
        break;
      case RobotState.OFF:
        scaleY = 0.1;
        lidHeight = 100;
        break;
    }
  }

  // Parallax for depth
  const lookX = position.x * 30;
  const lookY = position.y * 18;

  return (
    <div 
      className="relative flex items-center justify-center transition-all duration-[350ms] cubic-bezier(0.17, 0.84, 0.44, 1)"
      style={{
        width: '110px',
        height: '110px',
        transform: `translate(${lookX}px, ${lookY}px) scaleY(${scaleY}) rotate(${rotation}deg)`,
      }}
    >
      {/* Soft Glow */}
      <div 
        className="absolute inset-0 blur-[40px] opacity-15 transition-colors duration-700"
        style={{ backgroundColor: glowColor, borderRadius: '40%' }}
      />
      
      {/* Eye Chassis */}
      <div 
        className="relative w-full h-full bg-cyan-400 overflow-hidden shadow-[inset_0_0_25px_rgba(0,0,0,0.5),0_0_40px_rgba(34,211,238,0.3)]"
        style={{ borderRadius: '38%' }}
      >
        {/* Lids with slightly softer transitions */}
        <div 
          className="absolute top-0 left-0 w-full bg-[#0a0a0a] z-20 transition-all duration-[120ms]" 
          style={{ height: `${Math.max(0, lidHeight)}%` }} 
        />
        <div 
          className="absolute bottom-0 left-0 w-full bg-[#0a0a0a] z-20 transition-all duration-[120ms]" 
          style={{ height: `${Math.max(0, -lidHeight)}%` }} 
        />

        {/* Pupil & Parallax Iris */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translate(${position.x * 10}px, ${position.y * 6}px)` }}
        >
          <div 
            className="rounded-full bg-[#050505] relative transition-all duration-[250ms] ease-out"
            style={{ 
              width: `${pupilSize * 90}%`, 
              height: `${pupilSize * 90}%`,
              boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)'
            }}
          >
            {/* Soft Iris Highlights */}
            <div className="absolute inset-0 rounded-full opacity-20 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.8)_0%,transparent_70%)]" />
            
            {/* Catchlight (The "Soul" of the eye) */}
            <div className="absolute top-[18%] left-[22%] w-1/3 h-1/3 bg-white/50 rounded-full blur-[2px]" />
            <div className="absolute bottom-[25%] right-[25%] w-1/6 h-1/6 bg-white/20 rounded-full blur-[1px]" />
          </div>
        </div>

        {/* HUD/Digital Texture Layer */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08] bg-[radial-gradient(#fff_0.5px,transparent_0)] bg-[length:8px_8px]" />
      </div>
    </div>
  );
};

export default Eye;
