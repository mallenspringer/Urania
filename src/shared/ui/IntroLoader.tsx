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
  color: string;
  alpha: number;
  flickerSpeed: number;
}

export const IntroLoader: React.FC<IntroLoaderProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // 1. Start background fade-out shortly after mount to trigger CSS transition
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 50);

    // Call onComplete after 1.5 seconds (1500ms)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1500);

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

    // Seed particles: highly dense at the top
    const particles: Particle[] = [];
    const particleCount = 200;
    const colors = [
      "rgb(239, 68, 68)",  // Bright Red
      "rgb(34, 197, 94)",  // Bright Green
      "rgb(59, 130, 246)", // Bright Blue
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        // Denser at the top: square the random to skew towards 0
        y: Math.pow(Math.random(), 2.5) * (height * 0.25),
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 2 + 0.5, // positive y velocity (drifting down)
        size: Math.random() * 3 + 2, // 2px to 5px
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.7 + 0.3,
        flickerSpeed: Math.random() * 0.1 + 0.05,
      });
    }

    let animationFrameId: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / 1500); // 0 to 1

      ctx.clearRect(0, 0, width, height);

      // Draw and update each particle
      particles.forEach((p) => {
        // Flicker opacity
        p.alpha += (Math.random() - 0.5) * p.flickerSpeed * 2;
        p.alpha = Math.max(0.1, Math.min(1, p.alpha));

        // Physics: drift and diffuse downwards
        p.y += p.vy;
        p.x += p.vx;

        // Apply a small random walk to horizontal velocity for diffusion look
        p.vx += (Math.random() - 0.5) * 0.2;
        p.vx = Math.max(-2, Math.min(2, p.vx));

        // Gravity acceleration
        p.vy += 0.04;

        // Fade out overall towards the end of the 1.5s lifecycle
        const fadeFactor = 1 - progress;
        const currentAlpha = p.alpha * fadeFactor;

        // Render pixel
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
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
  }, [onComplete]);

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
        transition: "opacity 1.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
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
