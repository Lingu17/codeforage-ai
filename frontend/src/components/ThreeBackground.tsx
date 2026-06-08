"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  id: string;
  name: string;
  layer: number;
  relX: number; // relative X (0 to 1)
  relY: number; // relative Y (0 to 1)
  floatOffset: number;
  floatSpeed: number;
  amplitude: number;
  currentX: number;
  currentY: number;
}

interface Edge {
  from: string;
  to: string;
  particles: { progress: number; speed: number; color: string }[];
}

export default function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [targetMouse, setTargetMouse] = useState({ x: 0, y: 0 });

  // Mouse Move listener for Parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setTargetMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 45,
        y: (e.clientY / window.innerHeight - 0.5) * 45,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Handle Resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Initialize Nodes: Repository Intelligence Engine
    const nodes: Node[] = [
      // Layer 0: GitHub Repository
      { id: "repo", name: "GitHub Repository", layer: 0, relX: 0.1, relY: 0.5, floatOffset: 0, floatSpeed: 0.0006, amplitude: 10, currentX: 0, currentY: 0 },
      
      // Layer 1: Repository Scanner
      { id: "scanner", name: "Repository Scanner", layer: 1, relX: 0.25, relY: 0.5, floatOffset: 1, floatSpeed: 0.0007, amplitude: 12, currentX: 0, currentY: 0 },
      
      // Layer 2: Embedding Pipeline
      { id: "embedder", name: "Embedding Pipeline", layer: 2, relX: 0.4, relY: 0.5, floatOffset: 2, floatSpeed: 0.0008, amplitude: 14, currentX: 0, currentY: 0 },
      
      // Layer 3: Vector Database
      { id: "vectordb", name: "Vector Database", layer: 3, relX: 0.55, relY: 0.5, floatOffset: 3, floatSpeed: 0.0006, amplitude: 10, currentX: 0, currentY: 0 },
      
      // Layer 4: Parallel Engines
      { id: "arch_intel", name: "Architecture Engine", layer: 4, relX: 0.72, relY: 0.3, floatOffset: 4, floatSpeed: 0.0009, amplitude: 12, currentX: 0, currentY: 0 },
      { id: "security", name: "Security Scanner", layer: 4, relX: 0.72, relY: 0.5, floatOffset: 5, floatSpeed: 0.0007, amplitude: 10, currentX: 0, currentY: 0 },
      { id: "code_chat", name: "Codebase Chat", layer: 4, relX: 0.72, relY: 0.7, floatOffset: 6, floatSpeed: 0.0005, amplitude: 8, currentX: 0, currentY: 0 },
      
      // Layer 5: PR Review Engine
      { id: "pr_review", name: "PR Review Engine", layer: 5, relX: 0.88, relY: 0.5, floatOffset: 7, floatSpeed: 0.0006, amplitude: 10, currentX: 0, currentY: 0 },
    ];

    // Define Edges (connecting paths)
    const edges: Edge[] = [
      // Layer 0 to 1
      { from: "repo", to: "scanner", particles: [{ progress: 0.1, speed: 0.003, color: "#4F46E5" }, { progress: 0.6, speed: 0.002, color: "#10B981" }] },

      // Layer 1 to 2
      { from: "scanner", to: "embedder", particles: [{ progress: 0.3, speed: 0.0025, color: "#4F46E5" }, { progress: 0.8, speed: 0.003, color: "#F59E0B" }] },

      // Layer 2 to 3
      { from: "embedder", to: "vectordb", particles: [{ progress: 0.2, speed: 0.0028, color: "#4F46E5" }] },

      // Layer 3 to 4
      { from: "vectordb", to: "arch_intel", particles: [{ progress: 0.4, speed: 0.0026, color: "#4F46E5" }] },
      { from: "vectordb", to: "security", particles: [{ progress: 0.5, speed: 0.0022, color: "#EF4444" }] },
      { from: "vectordb", to: "code_chat", particles: [{ progress: 0.8, speed: 0.0025, color: "#10B981" }] },

      // Layer 4 to 5
      { from: "arch_intel", to: "pr_review", particles: [{ progress: 0.2, speed: 0.0028, color: "#4F46E5" }] },
      { from: "security", to: "pr_review", particles: [{ progress: 0.5, speed: 0.0026, color: "#EF4444" }] },
      { from: "code_chat", to: "pr_review", particles: [{ progress: 0.9, speed: 0.003, color: "#10B981" }] },
    ];

    let time = 0;
    let currentOffsetX = 0;
    let currentOffsetY = 0;

    // Animation Loop
    const render = () => {
      time += 0.4;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // Smooth interpolation for mouse parallax
      currentOffsetX += (targetMouse.x - currentOffsetX) * 0.04;
      currentOffsetY += (targetMouse.y - currentOffsetY) * 0.04;

      // Update Node positions (float animation)
      nodes.forEach((node) => {
        const floatY = Math.sin(time * node.floatSpeed + node.floatOffset) * node.amplitude;
        node.currentX = node.relX * width + currentOffsetX * (1 + node.layer * 0.12);
        node.currentY = node.relY * height + floatY + currentOffsetY * (1 + node.layer * 0.12);
      });

      // Draw Edges (Connection links)
      edges.forEach((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        // Draw Edge Line
        ctx.beginPath();
        ctx.moveTo(fromNode.currentX, fromNode.currentY);
        
        // Draw curvy connection lines
        const controlX = (fromNode.currentX + toNode.currentX) / 2;
        ctx.bezierCurveTo(
          controlX, fromNode.currentY,
          controlX, toNode.currentY,
          toNode.currentX, toNode.currentY
        );

        ctx.strokeStyle = "rgba(79, 70, 229, 0.08)"; // Very subtle Indigo path
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Update & Draw flowing particles along the curve
        edge.particles.forEach((p) => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;

          // Calculate point on bezier curve
          const t = p.progress;
          const cp1x = controlX;
          const cp1y = fromNode.currentY;
          const cp2x = controlX;
          const cp2y = toNode.currentY;

          // Bezier point formula
          const x =
            Math.pow(1 - t, 3) * fromNode.currentX +
            3 * Math.pow(1 - t, 2) * t * cp1x +
            3 * (1 - t) * Math.pow(t, 2) * cp2x +
            Math.pow(t, 3) * toNode.currentX;

          const y =
            Math.pow(1 - t, 3) * fromNode.currentY +
            3 * Math.pow(1 - t, 2) * t * cp1y +
            3 * (1 - t) * Math.pow(t, 2) * cp2y +
            Math.pow(t, 3) * toNode.currentY;

          // Draw particle
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.6;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
      });

      // Draw Nodes (Glass cards)
      nodes.forEach((node) => {
        const cardW = 126;
        const cardH = 34;
        const cardX = node.currentX - cardW / 2;
        const cardY = node.currentY - cardH / 2;

        // Draw rounded rectangle manually to avoid roundRect experimental crashes
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(cardX + r, cardY);
        ctx.lineTo(cardX + cardW - r, cardY);
        ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
        ctx.lineTo(cardX + cardW, cardY + cardH - r);
        ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
        ctx.lineTo(cardX + r, cardY + cardH);
        ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
        ctx.lineTo(cardX, cardY + r);
        ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
        ctx.closePath();

        ctx.fillStyle = "rgba(255, 255, 255, 0.75)"; // White card background
        ctx.strokeStyle = "rgba(79, 70, 229, 0.12)"; // Soft Indigo border
        ctx.lineWidth = 1;
        ctx.shadowColor = "rgba(0, 0, 0, 0.02)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow
        ctx.shadowOffsetY = 0;

        // Draw a small indicator circle on the card
        ctx.beginPath();
        ctx.arc(cardX + 14, cardY + cardH / 2, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = node.id === "pr_review" ? "#EF4444" : node.layer === 0 ? "#10B981" : "#4F46E5";
        ctx.fill();

        // Draw label text inside the card
        ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        ctx.fillStyle = "#111827"; // Slate Gray-900 text
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(node.name, cardX + 24, cardY + cardH / 2);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    // Cleanups
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [mouse]);

  return (
    <div className="fixed inset-0 -z-10 w-full h-full pointer-events-none overflow-hidden bg-[#F8FAFC]">
      {/* Radial soft indigo bloom */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-full blur-[130px] pointer-events-none" />
      
      {/* Clean Dotted Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1.5px,transparent_1.5px)] bg-[size:32px_32px] opacity-75" />

      {/* Repository Intelligence Graph Canvas (always visible, ~18% opacity overlay overall) */}
      <div className="absolute inset-0 w-full h-full opacity-18">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
