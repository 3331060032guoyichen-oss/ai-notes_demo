"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { LandingCrystalScene } from "./landing-crystal-scene";

const LANDING_CONFIG = {
  wheelDistance: 96,
  touchDistance: 48,
  onlyOnce: true,
} as const;

type LandingPageProps = {
  onEnter: () => void;
};

export function LandingPage({ onEnter }: LandingPageProps) {
  const [revealed, setRevealed] = useState(false);
  const pageRef = useRef<HTMLElement>(null);
  const wheelDistance = useRef(0);
  const touchStartY = useRef<number | null>(null);

  function paintProgress(value: number) {
    const progress = Math.min(Math.max(value, 0), 1);
    pageRef.current?.style.setProperty("--reveal-progress", progress.toFixed(3));
    pageRef.current?.setAttribute("data-reveal-progress", progress.toFixed(2));
  }

  function reveal() {
    if (LANDING_CONFIG.onlyOnce && revealed) return;
    paintProgress(1);
    setRevealed(true);
  }

  function handleWheel(event: React.WheelEvent<HTMLElement>) {
    if (revealed) return;
    wheelDistance.current += Math.abs(event.deltaY);
    const progress = wheelDistance.current / LANDING_CONFIG.wheelDistance;
    paintProgress(progress);
    if (progress >= 1) reveal();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (revealed || touchStartY.current === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    const progress = Math.abs(currentY - touchStartY.current) / LANDING_CONFIG.touchDistance;
    paintProgress(progress);
    if (progress >= 1) reveal();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
    const style = event.currentTarget.style;

    style.setProperty("--light-x", `${(x * bounds.width).toFixed(1)}px`);
    style.setProperty("--light-y", `${(y * bounds.height).toFixed(1)}px`);
    style.setProperty("--light-opacity", "0.42");
    style.setProperty("--art-x", `${((0.5 - x) * 14).toFixed(2)}px`);
    style.setProperty("--art-y", `${((0.5 - y) * 10).toFixed(2)}px`);
  }

  function resetPointerDepth(event: React.PointerEvent<HTMLElement>) {
    const style = event.currentTarget.style;
    style.setProperty("--light-opacity", "0");
    style.setProperty("--art-x", "0px");
    style.setProperty("--art-y", "0px");
  }

  return (
    <main
      ref={pageRef}
      className={`landing-page${revealed ? " is-revealed" : ""}`}
      data-reveal-progress="0.00"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { touchStartY.current = null; }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerDepth}
      onKeyDown={(event) => {
        if (!revealed && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          reveal();
        }
      }}
      aria-describedby="landing-instruction"
      tabIndex={0}
    >
      <Image
        className="landing-art"
        src="/landing-knowledge-still-life-lit-v2.png"
        alt="笔记纸、线与节点组成的知识网络"
        fill
        priority
        sizes="100vw"
      />
      <LandingCrystalScene revealed={revealed} />
      <div className="landing-wash" aria-hidden="true" />
      <div className="landing-depth-light" aria-hidden="true" />

      <header className="landing-nav">
        <div className="landing-brand"><span>AN</span><strong>AI Notes</strong></div>
        <div className="landing-console-state" aria-label="本地编辑台已就绪">
          <span className="landing-console-signal" aria-hidden="true" />
          <span>本地编辑台</span>
          <strong>就绪</strong>
        </div>
      </header>

      <section className="landing-intro" aria-label="AI Notes 简介">
        <p className="landing-kicker">你的私人知识编辑室</p>
        <h1>先留下原话，<br /><em>再形成自己的<br className="landing-mobile-break" />理解。</em></h1>
        <p className="landing-summary">AI 帮你整理与连接，但每一次收录都由你决定。</p>
      </section>

      <div className="landing-gesture" aria-hidden={revealed}>
        <button className="landing-reveal-control" type="button" data-sound="select" tabIndex={revealed ? -1 : 0} onClick={reveal} aria-label="打开编辑室">
          <span className="landing-reveal-key" aria-hidden="true">按下</span>
          <span><strong id="landing-instruction">打开编辑室</strong><small>也可以向上滑动</small></span>
        </button>
      </div>

      <section className="landing-welcome" aria-live="polite" aria-hidden={!revealed}>
        <div>
          <span className="welcome-mark">编辑室已就绪</span>
          <h2>从一段原话开始。</h2>
          <p>把材料留下，审阅整理建议，再决定什么值得成为你的知识。</p>
        </div>
        <button type="button" tabIndex={revealed ? 0 : -1} data-sound="press" onClick={onEnter}>开始整理</button>
      </section>

      <div className="landing-frame" aria-hidden="true" />
    </main>
  );
}
