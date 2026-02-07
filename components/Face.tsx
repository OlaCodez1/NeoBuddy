
import React, { useState, useEffect, useMemo } from 'react';
import Eye from './Eye';
import Mouth from './Mouth';
import { RobotState } from '../types';

interface FaceProps {
  state: RobotState;
  audioLevel: number;
  externalPos: { x: number; y: number };
}

const Face: React.FC<FaceProps> = ({ state, audioLevel, externalPos }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [saccade, setSaccade] = useState({ x: 0, y: 0 });
  const [idleGaze, setIdleGaze] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [time, setTime] = useState(0);
  const [twitch, setTwitch] = useState({ x: 0, y: 0, scale: 1 });

  // Animation frame loop for smooth continuous motions (nodding, breathing)
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setTime(prev => prev + 0.05);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };

    // Micro-saccades: Rapid involuntary eye movements
    const saccadeInterval = setInterval(() => {
      setSaccade({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05
      });
    }, 1500 + Math.random() * 2000);

    // Idle Gaze Drift: Slowly look around when nothing is happening
    const driftInterval = setInterval(() => {
      if (state === RobotState.IDLE) {
        setIdleGaze({
          x: (Math.random() - 0.5) * 0.3,
          y: (Math.random() - 0.5) * 0.2
        });
      }
    }, 4000 + Math.random() * 3000);

    // Random Face Twitches: Occasional tiny glitches or "muscle" spasms
    const triggerTwitch = () => {
      if (state === RobotState.IDLE || state === RobotState.LISTENING) {
        setTwitch({
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 0.5) * 2,
          scale: 0.98 + Math.random() * 0.04
        });
        setTimeout(() => setTwitch({ x: 0, y: 0, scale: 1 }), 100);
      }
      setTimeout(triggerTwitch, 2000 + Math.random() * 8000);
    };
    const twitchTimeout = setTimeout(triggerTwitch, 3000);

    const tiltInterval = setInterval(() => {
      if (state === RobotState.THINKING) {
        setTilt((Math.random() - 0.5) * 15);
      } else if (state === RobotState.SINGING) {
        setTilt(Math.sin(Date.now() / 300) * 8);
      } else {
        setTilt((Math.random() - 0.5) * 5);
      }
    }, 4000);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(saccadeInterval);
      clearInterval(driftInterval);
      clearInterval(tiltInterval);
      clearTimeout(twitchTimeout);
    };
  }, [state]);

  // Priority: External Tracking (Face) > Mouse Position > Idle Drift
  const activePos = {
    x: (externalPos.x !== 0 ? externalPos.x : (mousePos.x !== 0 ? mousePos.x : idleGaze.x)) + saccade.x,
    y: (externalPos.y !== 0 ? externalPos.y : (mousePos.y !== 0 ? mousePos.y : idleGaze.y)) + saccade.y
  };

  // Continuous subtle motions
  const nodY = useMemo(() => {
    if (state === RobotState.LISTENING) {
      return Math.sin(time * 2.5) * 12;
    }
    return Math.sin(time * 0.8) * 4;
  }, [state, time]);

  const scalePulse = useMemo(() => {
    return (1 + (Math.sin(time * 0.5) * 0.015)) * twitch.scale;
  }, [time, twitch.scale]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-black overflow-hidden select-none">
      {/* Dynamic Background Pulse */}
      <div 
        className="absolute inset-0 opacity-5 transition-all duration-[2000ms]"
        style={{
          background: state === RobotState.SPEAKING 
            ? 'radial-gradient(circle at center, #22d3ee 0%, transparent 80%)' 
            : 'radial-gradient(circle at center, #0e7490 0%, transparent 60%)'
        }}
      />

      <div 
        className="flex flex-col items-center transition-transform duration-[800ms] ease-out"
        style={{ 
          transform: `translate(${twitch.x}px, ${nodY + twitch.y}px) rotate(${tilt}deg) scale(${scalePulse})`,
        }}
      >
        <div className="flex items-center justify-center gap-24 md:gap-40">
          <Eye state={state} position={activePos} audioLevel={audioLevel} />
          <Eye state={state} position={activePos} audioLevel={audioLevel} isRight />
        </div>
        
        <Mouth state={state} audioLevel={audioLevel} />
      </div>

      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
};

export default Face;
