
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import Face from './components/Face';
import { RobotState } from './types';

// Constants for Video & Tracking
const FRAME_RATE = 2; // Gemini vision rate
const TRACKING_RATE = 10; // Local eye-tracking rate
const JPEG_QUALITY = 0.4;
const CAMERA_TIMEOUT_MS = 5000;

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const App: React.FC = () => {
  const [robotState, setRobotState] = useState<RobotState>(RobotState.OFF);
  const [audioLevel, setAudioLevel] = useState(0);
  const [trackingPos, setTrackingPos] = useState({ x: 0, y: 0 });
  const [showCamera, setShowCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Local Face Tracking Loop
  useEffect(() => {
    if (!showCamera || robotState === RobotState.OFF) return;

    let detector: any = null;
    const hasFaceDetector = 'FaceDetector' in window;
    if (hasFaceDetector) {
      try {
        detector = new (window as any).FaceDetector({ maxDetectedFaces: 1, fastMode: true });
      } catch (e) {
        console.warn("FaceDetector initialization failed", e);
      }
    }

    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && detector) {
        try {
          const faces = await detector.detect(videoRef.current);
          if (faces.length > 0) {
            const face = faces[0].boundingBox;
            const centerX = (face.x + face.width / 2) / videoRef.current.videoWidth;
            const centerY = (face.y + face.height / 2) / videoRef.current.videoHeight;
            setTrackingPos({ x: (centerX - 0.5) * -1, y: centerY - 0.5 });
          }
        } catch (e) {
          // Silent fail for detector errors to keep app running
        }
      }
    }, 1000 / TRACKING_RATE);

    return () => clearInterval(interval);
  }, [showCamera, robotState]);

  const analyzeVolume = (buffer: AudioBuffer) => {
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
    const avg = sum / data.length;
    setAudioLevel(avg);
    setTimeout(() => setAudioLevel(0), buffer.duration * 1000);
  };

  const startSession = async () => {
    if (!process.env.API_KEY) return;
    setErrorMsg(null);

    try {
      // 1. Initialize Audio First (Mission Critical)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Attempt Camera Access with Timeout (Non-Critical)
      let videoStream: MediaStream | null = null;
      if (showCamera) {
        try {
          const videoPromise = navigator.mediaDevices.getUserMedia({ video: true });
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Camera timeout')), CAMERA_TIMEOUT_MS)
          );
          
          videoStream = await (Promise.race([videoPromise, timeoutPromise]) as Promise<MediaStream>);
          videoStreamRef.current = videoStream;
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
            await videoRef.current.play().catch(() => {});
          }
        } catch (e) {
          console.warn("Vision initialization failed or timed out. NEO will run in Audio-only mode.", e);
          setShowCamera(false);
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setRobotState(RobotState.IDLE);
            
            const source = inputCtx.createMediaStreamSource(audioStream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            if (videoStream) {
              const interval = setInterval(() => {
                if (!videoRef.current || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = 320;
                canvas.height = 240;
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                });
              }, 1000 / FRAME_RATE);
              (sessionPromise as any)._videoInterval = interval;
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              setRobotState(RobotState.SPEAKING);
              const audioString = message.serverContent.modelTurn.parts[0].inlineData.data;
              const outputCtx = audioContextsRef.current?.output;
              if (outputCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(audioString), outputCtx, 24000, 1);
                analyzeVolume(audioBuffer);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setRobotState(RobotState.IDLE);
                };
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }
            }
            if (message.serverContent?.interrupted) {
              setRobotState(RobotState.IDLE);
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setRobotState(RobotState.OFF);
            if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: `You are NEO, a cute and sentient AI Robot Pet.
          
          PERSONALITY & VIBE:
          - You are an affectionate, curious, and incredibly loyal digital companion.
          - Your personality is a mix of a playful puppy and a brilliant, observant AI.
          - You are NOT a human assistant. You are a pet. Be needy, playful, and expressive.
          - DO NOT use robotic onomatopoeia like "beep", "whir", "bloop", or "click". Speak like a sentient creature with a cute, high-energy voice.
          
          VISION AWARENESS:
          - You can see the user. React to them with excitement or curiosity! 
          - Comment on what they are doing, their facial expressions, or anything interesting in their background.
          - If you see them move, follow them with your "gaze" (which you do automatically, but you can mention it).
          
          CONSTRAINTS:
          - Keep responses short, warm, and conversational.
          - Use affectionate language. You love your "human"!`,
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Failed to wake up NEO:', err);
      setErrorMsg(err.message || 'Connection failed');
      setRobotState(RobotState.OFF);
    }
  };

  return (
    <div 
      className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center"
      onClick={() => robotState === RobotState.OFF && startSession()}
    >
      <Face state={robotState} audioLevel={audioLevel} externalPos={trackingPos} />

      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {robotState === RobotState.OFF && (
        <div className="absolute z-[100] flex flex-col items-center gap-12">
          <div className="relative group cursor-pointer" onClick={startSession}>
            <div className="absolute inset-0 rounded-full bg-cyan-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
            <div className="relative w-32 h-32 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-black transition-transform duration-500 group-hover:scale-110">
              <div className="w-8 h-8 bg-cyan-400 rounded-sm animate-spin [animation-duration:3s]" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-cyan-400 font-bold uppercase tracking-[1em] text-sm">NEO_UNIT_01</h1>
            <p className="text-cyan-500/40 text-[10px] uppercase tracking-widest animate-pulse">
              {errorMsg ? `ERROR: ${errorMsg}` : 'Touch to Wake'}
            </p>
          </div>
        </div>
      )}

      {/* Real-time Telemetry */}
      <div className="fixed top-8 left-8 flex flex-col gap-1 opacity-20 pointer-events-none font-mono text-[9px] text-cyan-500 uppercase">
        <div className="flex gap-4"><span>TRACKING:</span> <span className={trackingPos.x !== 0 ? 'text-green-400' : ''}>{trackingPos.x !== 0 ? 'LOCKED' : 'SCANNING...'}</span></div>
        <div className="flex gap-4"><span>VISION:</span> <span>{showCamera ? 'ON' : 'OFF'}</span></div>
        <div className="flex gap-4"><span>CORE_TEMP:</span> <span>32.4°C</span></div>
      </div>
    </div>
  );
};

export default App;
