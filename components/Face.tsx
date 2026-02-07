
import React, { useState, useEffect } from 'react';
import Eye from './Eye';
import Mouth from './Mouth';
import { RobotState } from '../types';

interface FaceProps {
  state: RobotState;
  audioLevel: number;
}

const Face: React.FC<FaceProps> = ({ state, audioLevel }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [jitter, setJitter] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };

    const tiltInterval = setInterval(() => {
      if (state === RobotState.THINKING || state === RobotState.LISTENING) {
        setTilt((Math.random() - 0.5) * 20);
      } else if (state === RobotState.SINGING) {
        setTilt(Math.sin(Date.now() / 200) * 10);
      } else {
        setTilt((Math.random() - 0.5) * 8);
      }
    }, 3000);

    // Sneeze / Glitch Jitter logic
    const jitterInterval = setInterval(() => {
      if (state === RobotState.SNEEZING) {
        setJitter({
          x: (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 50
        });
      } else {
        setJitter({ x: 0, y: 0 });
      }
    }, 50);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(tiltInterval);
      clearInterval(jitterInterval);
    };
  }, [state]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-black overflow-hidden select-none">
      {/* Ambient background that pulses with state */}
      <div 
        className="absolute inset-0 opacity-10 transition-colors duration-1000"
        style={{
          background: state === RobotState.SNEEZING 
            ? 'radial-gradient(circle at center, #ef4444 0%, transparent 70%)' 
            : 'radial-gradient(circle at center, #0891b2 0%, transparent 70%)'
        }}
      />

      <div 
        className="flex flex-col items-center transition-all duration-100"
        style={{ 
          transform: `
            translate(${jitter.x}px, ${jitter.y}px) 
            rotate(${tilt}deg) 
            scale(${state === RobotState.SNEEZING ? 1.4 : 1 + (Math.sin(Date.now() / 2000) * 0.02)})
          `,
        }}
      >
        <div className="flex items-center justify-center gap-24 md:gap-40">
          <Eye state={state} position={mousePos} audioLevel={audioLevel} />
          <Eye state={state} position={mousePos} audioLevel={audioLevel} isRight />
        </div>
        
        <Mouth state={state} audioLevel={audioLevel} />
      </div>

      {/* Decorative HUD */}
      <div className="fixed bottom-10 left-10 opacity-30 font-mono text-[9px] text-cyan-500 uppercase flex flex-col gap-1">
        <div className="flex gap-2"><span>EMOTION_ENG:</span> <span className="text-white animate-pulse">{state}</span></div>
        <div className="flex gap-2"><span>SENSORY_INPUT:</span> <span className="text-white">ACTIVE</span></div>
      </div>
      
      {state === RobotState.OFF && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-1 bg-cyan-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 animate-[loading_2s_infinite]" />
              </div>
              <p className="text-cyan-500/40 text-[10px] uppercase tracking-[0.8em]">Deep Sleep Mode</p>
            </div>
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Face;
