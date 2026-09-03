import React, { useEffect, useRef } from 'react';

export function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    async function startAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext.current = new AudioContext();
        const source = audioContext.current.createMediaStreamSource(stream);
        const analyser = audioContext.current.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        function draw() {
          requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);
          if (!ctx || !canvas) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 2;
            ctx.fillStyle = `rgb(100, 200, 255)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
        }
        draw();
      } catch (e) {
        console.error("Audio error", e);
      }
    }
    startAudio();
  }, []);

  return <canvas ref={canvasRef} className="w-full h-32 glass rounded-lg" />;
}
