import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  className?: string;
}

const BAR_COUNT = 48;
const BAR_GAP = 3;
const BAR_RADIUS = 2;
const FFT_SIZE = 128;
const SMOOTHING = 0.8;
const MAX_HEIGHT_RATIO = 0.8;
const IDLE_BASE_AMPLITUDE = 0.08;
const IDLE_WAVE_SPEED = 0.002;

const DEFAULT_CLASS = 'absolute inset-0 w-full h-full pointer-events-none opacity-60';

export function AudioVisualizer({ stream, className }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture non-null references for the draw closure
    const cvs = canvas;
    const context = ctx;

    // Set up ResizeObserver to match canvas to container size with devicePixelRatio scaling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        cvs.width = width * dpr;
        cvs.height = height * dpr;
        cvs.style.width = `${width}px`;
        cvs.style.height = `${height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    });
    resizeObserver.observe(cvs);

    // Set up Web Audio API if stream is available
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

    if (stream) {
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        dataArray = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        // Web Audio API may not be available; fall back to idle animation
        analyser = null;
        dataArray = null;
      }
    }

    function draw() {
      const width = cvs.clientWidth;
      const height = cvs.clientHeight;

      context.clearRect(0, 0, width, height);

      // Get audio frequency data if available
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      const now = performance.now();
      const elapsed = now - startTimeRef.current;

      const totalBarWidth = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
      const barWidth = Math.max(1, totalBarWidth);

      // Create vertical gradient for bars: cyan (#00D9FF) at base, purple (#8B00FF) at peaks
      const gradient = context.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#00D9FF');
      gradient.addColorStop(1, '#8B00FF');
      context.fillStyle = gradient;

      const half = BAR_COUNT / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Mirror index: bars radiate from center outward
        let freqIndex: number;
        if (i < half) {
          // Left side: center -> left edge
          freqIndex = half - 1 - i;
        } else {
          // Right side: center -> right edge
          freqIndex = i - half;
        }

        // Get audio value normalized to 0..1
        let audioValue = 0;
        if (dataArray && dataArray.length > 0) {
          const binIndex = Math.floor(
            (freqIndex / half) * (dataArray.length - 1),
          );
          audioValue = dataArray[binIndex] / 255;
        }

        // Idle bounce: subtle sine wave so bars always move even without audio
        const idleBounce =
          IDLE_BASE_AMPLITUDE *
          (0.5 + 0.5 * Math.sin(elapsed * IDLE_WAVE_SPEED + freqIndex * 0.3));

        // Bar height = max(idleBounce, audioValue) * height * 0.8
        const value = Math.max(idleBounce, audioValue);
        const barHeight = Math.max(2, value * height * MAX_HEIGHT_RATIO);

        const x = i * (barWidth + BAR_GAP);
        const y = height - barHeight;

        // Draw bar with rounded corners (roundRect radius 2)
        if (context.roundRect) {
          context.beginPath();
          context.roundRect(x, y, barWidth, barHeight, BAR_RADIUS);
          context.fill();
        } else {
          // Fallback for environments without roundRect
          context.fillRect(x, y, barWidth, barHeight);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      resizeObserver.disconnect();
      cleanup();
    };
  }, [stream, cleanup]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(DEFAULT_CLASS, className)}
    />
  );
}
