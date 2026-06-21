"use client";

import { useEffect, useRef } from "react";

interface Thread {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  width: number;
  hue: number;
  points: { x: number; y: number }[];
  opacity: number;
  seed: number;
}

function createThread(w: number, h: number, seed: number): Thread {
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number, vx: number, vy: number;

  switch (edge) {
    case 0: // top
      x = Math.random() * w;
      y = -10;
      vx = (Math.random() - 0.5) * 1.2;
      vy = 0.3 + Math.random() * 0.7;
      break;
    case 1: // right
      x = w + 10;
      y = Math.random() * h;
      vx = -(0.3 + Math.random() * 0.7);
      vy = (Math.random() - 0.5) * 1.2;
      break;
    case 2: // bottom
      x = Math.random() * w;
      y = h + 10;
      vx = (Math.random() - 0.5) * 1.2;
      vy = -(0.3 + Math.random() * 0.7);
      break;
    default: // left
      x = -10;
      y = Math.random() * h;
      vx = 0.3 + Math.random() * 0.7;
      vy = (Math.random() - 0.5) * 1.2;
      break;
  }

  const maxLife = 300 + Math.random() * 400;
  // Hue range: 170-210 (teal to blue, matching Threadzy accent)
  const hue = 170 + Math.random() * 40;

  return {
    x,
    y,
    vx,
    vy,
    life: 0,
    maxLife,
    width: 0.5 + Math.random() * 1.5,
    hue,
    points: [{ x, y }],
    opacity: 0,
    seed,
  };
}

function noise(x: number, seed: number): number {
  const s = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export default function AnimatedThreadsBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threadsRef = useRef<Thread[]>([]);
  const frameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const resizeInterval = setInterval(resize, 5000);

    const TARGET_THREADS = 25;

    function spawnThreads() {
      const threads = threadsRef.current;
      while (threads.length < TARGET_THREADS) {
        threads.push(createThread(w, h, Math.random() * 10000));
      }
    }

    spawnThreads();

    function animate() {
      if (!ctx) return;
      frameRef.current++;
      const frame = frameRef.current;

      ctx.clearRect(0, 0, w, h);

      const threads = threadsRef.current;

      for (let i = threads.length - 1; i >= 0; i--) {
        const t = threads[i];
        t.life++;

        // Organic movement with noise-based wandering
        const noiseX = noise(t.life * 0.02, t.seed) - 0.5;
        const noiseY = noise(t.life * 0.02, t.seed + 100) - 0.5;
        t.vx += noiseX * 0.08;
        t.vy += noiseY * 0.08;

        // Gentle speed dampening
        const speed = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
        if (speed > 2) {
          t.vx *= 0.98;
          t.vy *= 0.98;
        }

        t.x += t.vx;
        t.y += t.vy;

        // Store trail points (keep last 80 for smooth curves)
        t.points.push({ x: t.x, y: t.y });
        if (t.points.length > 80) t.points.shift();

        // Fade in and out
        const lifeRatio = t.life / t.maxLife;
        if (lifeRatio < 0.1) {
          t.opacity = lifeRatio / 0.1;
        } else if (lifeRatio > 0.8) {
          t.opacity = (1 - lifeRatio) / 0.2;
        } else {
          t.opacity = 1;
        }

        // Draw the thread as a smooth curve
        if (t.points.length > 2) {
          ctx.beginPath();
          ctx.moveTo(t.points[0].x, t.points[0].y);

          for (let j = 1; j < t.points.length - 1; j++) {
            const xc = (t.points[j].x + t.points[j + 1].x) / 2;
            const yc = (t.points[j].y + t.points[j + 1].y) / 2;
            ctx.quadraticCurveTo(t.points[j].x, t.points[j].y, xc, yc);
          }

          const last = t.points[t.points.length - 1];
          ctx.lineTo(last.x, last.y);

          ctx.strokeStyle = `hsla(${t.hue}, 70%, 55%, ${t.opacity * 0.15})`;
          ctx.lineWidth = t.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();

          // Glow effect on the leading tip
          if (t.opacity > 0.3) {
            ctx.beginPath();
            ctx.arc(last.x, last.y, t.width * 2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${t.hue}, 80%, 65%, ${t.opacity * 0.08})`;
            ctx.fill();
          }
        }

        // Branch: occasionally spawn a child thread splitting off
        if (
          t.life > 50 &&
          t.life % 120 === 0 &&
          threads.length < TARGET_THREADS + 10 &&
          Math.random() < 0.3
        ) {
          const child = createThread(w, h, Math.random() * 10000);
          child.x = t.x;
          child.y = t.y;
          child.vx = t.vx + (Math.random() - 0.5) * 1.5;
          child.vy = t.vy + (Math.random() - 0.5) * 1.5;
          child.points = [{ x: t.x, y: t.y }];
          child.hue = t.hue + (Math.random() - 0.5) * 20;
          child.width = t.width * 0.7;
          child.maxLife = 150 + Math.random() * 200;
          threads.push(child);
        }

        // Remove dead threads
        if (t.life > t.maxLife) {
          threads.splice(i, 1);
        }
      }

      // Occasionally draw subtle connection lines between nearby threads
      if (frame % 3 === 0) {
        for (let i = 0; i < threads.length; i++) {
          for (let j = i + 1; j < threads.length; j++) {
            const dx = threads[i].x - threads[j].x;
            const dy = threads[i].y - threads[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120 && dist > 20) {
              const connAlpha =
                (1 - dist / 120) *
                0.04 *
                Math.min(threads[i].opacity, threads[j].opacity);
              ctx.beginPath();
              ctx.moveTo(threads[i].x, threads[i].y);
              ctx.lineTo(threads[j].x, threads[j].y);
              ctx.strokeStyle = `hsla(190, 60%, 60%, ${connAlpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      // Maintain thread count
      spawnThreads();

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      clearInterval(resizeInterval);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
