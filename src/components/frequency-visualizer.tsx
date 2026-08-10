import { useEffect, useRef, useState } from "react";

export function FrequencyVisualizer({
  stream,
  className = "",
  barColor = "oklch(0.78 0.16 200)",
  gap = 2,
}: {
  stream?: MediaStream | null;
  className?: string;
  barColor?: string;
  gap?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        ctx.fillStyle = barColor;
        // Rounded top bars
        const radius = 4;
        const xPos = x;
        const yPos = height - barHeight;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(xPos, yPos, barWidth - gap, barHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(xPos, yPos, barWidth - gap, barHeight);
        }
        ctx.fill();

        x += barWidth + gap;
        if (x > width) break;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContext.close();
    };
  }, [stream, barColor, gap]);

  return (
    <canvas ref={canvasRef} className={`h-full w-full ${className}`} width={400} height={100} />
  );
}
