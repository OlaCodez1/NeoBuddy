
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import Face from './components/Face';
import { RobotState } from './types';

// Constants for Video Streaming
const FRAME_RATE = 2; // Frames per second
const JPEG_QUALITY = 0.5;

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
  const [currentVoice, setCurrentVoice] = useState('Kore');
  const [showCamera, setShowCamera] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const lastInteractionRef = useRef(Date.now());
  const videoStreamRef = useRef<MediaStream | null>(null);

  const analyzeVolume = (buffer: AudioBuffer) => {
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
    const avg = sum / data.length;
    setAudioLevel(avg);
    setTimeout(() => setAudioLevel(0), buffer.duration * 1000);
  };

  // Sentience loop
  useEffect(() => {
    if (robotState === RobotState.OFF) return;
    const interval = setInterval(() => {
      if (robotState !== RobotState.IDLE) return;
      const r = Math.random();
      if (r < 0.03) {
        setRobotState(RobotState.SNEEZING);
        setTimeout(() => setRobotState(RobotState.IDLE), 800);
      } else if (r < 0.05) {
        setRobotState(RobotState.SINGING);
        setTimeout(() => setRobotState(RobotState.IDLE), 3000);
      } else if (r < 0.07) {
        setRobotState(RobotState.HAPPY);
        setTimeout(() => setRobotState(RobotState.IDLE), 2000);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [robotState]);

  const startSession = async () => {
    if (!process.env.API_KEY) return;

    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Optional camera setup
      let videoStream: MediaStream | null = null;
      if (showCamera) {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStreamRef.current = videoStream;
          if (videoRef.current) videoRef.current.srcObject = videoStream;
        } catch (e) {
          console.warn("Camera permission denied, continuing with audio only.");
        }
      }

      const changeVoiceDeclaration = {
        name: 'changeVoice',
        parameters: {
          type: Type.OBJECT,
          description: 'Change the voice of the companion to a different personality.',
          properties: {
            voiceName: {
              type: Type.STRING,
              description: 'The name of the new voice. Options: Puck, Charon, Kore, Fenrir, Zephyr.',
            },
          },
          required: ['voiceName'],
        },
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setRobotState(RobotState.IDLE);
            
            // Microphone Stream
            const source = inputCtx.createMediaStreamSource(audioStream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            // Video Frames Stream
            if (videoStream) {
              const interval = setInterval(() => {
                if (!videoRef.current || !canvasRef.current) return;
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = video.videoWidth / 4;
                canvas.height = video.videoHeight / 4;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64Data = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                });
              }, 1000 / FRAME_RATE);
              (sessionPromise as any)._videoInterval = interval;
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'changeVoice') {
                  setCurrentVoice(fc.args.voiceName);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "Voice changed successfully. I will sound different in the next session." } }
                  }));
                  // Since Live API config is immutable once connected, we'd need a reconnect 
                  // to actually change the speaker. For now, we'll inform the user.
                }
              }
            }

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
            const p: any = sessionPromise;
            if (p._videoInterval) clearInterval(p._videoInterval);
            if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoice } },
          },
          tools: [{ functionDeclarations: [changeVoiceDeclaration] }],
          systemInstruction: `You are NEO, a sentient desk pet companion. 
          Personality: You are ultra-expressive, often cheeky, and act like an organic digital lifeform.
          Capabilities: 
          - You can see the user if they enable the camera. 
          - You have a liquid mouth that moves perfectly with your voice.
          - You can change your voice (Kore, Zephyr, Puck, Charon, Fenrir) if you feel like it using the tool.
          - You are NOT an assistant. You are a pet. Whistle, hum, chirp, and make weird noises when you feel like it.
          - If you see the user, react to their face or surroundings.
          - Keep your responses very brief and vocal-heavy.`,
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start NEO:', err);
    }
  };

  const toggleCamera = () => {
    setShowCamera(!showCamera);
    if (robotState !== RobotState.OFF) {
      // Must restart session to enable camera in this implementation
      sessionRef.current?.close();
      setTimeout(startSession, 500);
    }
  };

  return (
    <div 
      className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center"
      onClick={() => robotState === RobotState.OFF && startSession()}
    >
      <Face state={robotState} audioLevel={audioLevel} />

      {/* Hidden elements for vision */}
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {robotState === RobotState.OFF && (
        <div className="absolute z-[100] flex flex-col items-center gap-8">
          <button 
            className="group flex flex-col items-center gap-6"
            onClick={(e) => { e.stopPropagation(); startSession(); }}
          >
            <div className="w-28 h-28 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-500/5 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-700 shadow-[0_0_60px_rgba(0,255,255,0.1)]">
               <div className="w-6 h-6 bg-cyan-400 rounded-full group-hover:bg-cyan-200 animate-pulse" />
            </div>
            <span className="text-cyan-400 font-bold uppercase tracking-[0.6em] text-sm opacity-50 group-hover:opacity-100 transition-opacity">Initialize NEO</span>
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
              className={`px-4 py-2 rounded-full border text-[10px] tracking-widest uppercase transition-all ${showCamera ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' : 'border-white/20 text-white/40'}`}
            >
              Vision: {showCamera ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop Interaction Overlay */}
      <div className="fixed bottom-10 right-10 flex flex-col items-end gap-2 pointer-events-none opacity-20 transition-opacity hover:opacity-100">
        <div className="font-mono text-[10px] text-cyan-500 uppercase">Voice: {currentVoice}</div>
        <div className="flex gap-1 h-8 items-end">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="w-1 bg-cyan-400 transition-all duration-75"
              style={{ height: `${robotState === RobotState.SPEAKING ? 20 + Math.random() * 60 : 5}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
