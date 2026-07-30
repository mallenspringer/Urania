import React, { useEffect, useRef, useState } from "react";

interface IntroLoaderProps {
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color1: [number, number, number];
  color2: [number, number, number];
  colorPhase: number;
  colorSpeed: number;
  alpha: number;
  flickerSpeed: number;
}

export const IntroLoader: React.FC<IntroLoaderProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(1);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    // 1. Start background fade-out shortly after mount to trigger CSS transition
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 50);

    // Call onComplete after 6.0 seconds (6000ms - doubled from 3000ms)
    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 6000);

    // 2. Setup Particle Canvas Animation
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Seed arcade starfield particles with dual-color twinkle pairs
    const particles: Particle[] = [];
    const particleCount = 220;
    const colorPairs: Array<[[number, number, number], [number, number, number]]> = [
      [[248, 250, 252], [148, 163, 184]], // Bright Silver White <-> Steel Gray
      [[226, 232, 240], [99, 102, 241]],  // Pure Silver <-> Indigo Silver
      [[203, 213, 225], [100, 116, 139]], // Light Slate <-> Dark Charcoal
      [[255, 255, 255], [192, 132, 252]], // Crisp White <-> Violet Sparkle
      [[241, 245, 249], [56, 189, 248]],  // Ice White <-> Cyan Silver
    ];

    for (let i = 0; i < particleCount; i++) {
      const pair = colorPairs[Math.floor(Math.random() * colorPairs.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.pow(Math.random(), 2.5) * (height * 0.25),
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() * 2 + 0.5) * 0.75, // 75% fall rate
        size: Math.random() < 0.75 ? 1 : 2,
        color1: pair[0],
        color2: pair[1],
        colorPhase: Math.random() * Math.PI * 2,
        colorSpeed: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3,
        flickerSpeed: Math.random() * 0.08 + 0.04,
      });
    }

    let animationFrameId: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / 6000); // 0 to 1 over 6.0s

      ctx.clearRect(0, 0, width, height);

      // Draw and update each particle
      particles.forEach((p) => {
        // Flicker opacity
        p.alpha += (Math.random() - 0.5) * p.flickerSpeed * 2;
        p.alpha = Math.max(0.1, Math.min(1, p.alpha));

        // Physics: drift and diffuse downwards at 75% speed
        p.y += p.vy;
        p.x += p.vx;

        // Small horizontal drift diffusion
        p.vx += (Math.random() - 0.5) * 0.15;
        p.vx = Math.max(-1.5, Math.min(1.5, p.vx));

        // Gravity acceleration
        p.vy += 0.03;

        // Fade out overall towards the end of the 6s lifecycle
        const fadeFactor = 1 - progress;
        const currentAlpha = p.alpha * fadeFactor;

        // Asynchronous dual-color twinkle interpolation
        const mix = (Math.sin(elapsed * 0.003 * p.colorSpeed + p.colorPhase) + 1) / 2;
        const r = Math.round(p.color1[0] + (p.color2[0] - p.color1[0]) * mix);
        const g = Math.round(p.color1[1] + (p.color2[1] - p.color1[1]) * mix);
        const b = Math.round(p.color1[2] + (p.color2[2] - p.color1[2]) * mix);

        // Render pixel-perfect square arcade particle
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.globalAlpha = currentAlpha;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000000",
        opacity: opacity,
        transition: "opacity 2.9s cubic-bezier(0.75, 0, 0.9, 0.15)",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
