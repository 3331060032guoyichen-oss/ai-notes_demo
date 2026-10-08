"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const LANDING_CONFIG = {
  wheelDistance: 72,
  touchDistance: 44,
  onlyOnce: true,
} as const;

const DESIGN_SEED_HASH = "6D968B10C3CA0173773D304581E3BBE94AFD36D5FD2CD41A5871F691B05B84E9";

type LandingPageProps = {
  onEnter: () => void;
};

export function LandingPage({ onEnter }: LandingPageProps) {
  const [revealed, setRevealed] = useState(false);
  const wheelDistance = useRef(0);
  const touchStartY = useRef<number | null>(null);

  function reveal() {
    if (LANDING_CONFIG.onlyOnce && revealed) return;
    setRevealed(true);
  }

  function handleWheel(event: React.WheelEvent<HTMLElement>) {
    if (revealed) return;
    wheelDistance.current += Math.abs(event.deltaY);
    if (wheelDistance.current >= LANDING_CONFIG.wheelDistance) reveal();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (revealed || touchStartY.current === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    if (Math.abs(currentY - touchStartY.current) >= LANDING_CONFIG.touchDistance) reveal();
  }

  return (
    <main
      className={`landing-page${revealed ? " is-revealed" : ""}`}
      data-design-seed={DESIGN_SEED_HASH}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onKeyDown={(event) => {
        if (!revealed && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          reveal();
        }
      }}
      tabIndex={0}
    >
      <Image
        className="landing-art"
        src="/landing-knowledge-still-life.png"
        alt="笔记纸、线与节点组成的知识网络"
        fill
        priority
        sizes="100vw"
      />
      <div className="landing-wash" aria-hidden="true" />

      <header className="landing-nav">
        <div className="landing-brand"><span>AN</span><strong>AI Notes</strong></div>
        <p>给每一个还没成形的想法</p>
      </header>

      <section className="landing-intro" aria-label="AI Notes 简介">
        <p className="landing-kicker">大学生的生长式知识系统</p>
        <h1>把零散想法，<br /><em>长成自己的知识。</em></h1>
        <p className="landing-summary">先忠实记录，再由你决定哪些内容值得被整理、连接和长期保存。</p>
      </section>

      <div className="landing-gesture" aria-hidden={revealed}>
        <span className="gesture-line" />
        <p>滑动，让知识展开</p>
      </div>

      <section className="landing-welcome" aria-live="polite" aria-hidden={!revealed}>
        <div>
          <span className="welcome-mark">欢迎回来</span>
          <h2>今天想留下些什么？</h2>
          <p>工作台已经准备好。原始笔记由你写下，知识网络由你确认。</p>
        </div>
        <button type="button" onClick={onEnter}>进入工作台 <span aria-hidden="true">↗</span></button>
      </section>

      <div className="landing-frame" aria-hidden="true">
        <span className="frame-line frame-top" />
        <span className="frame-line frame-right" />
        <span className="frame-line frame-bottom" />
        <span className="frame-line frame-left" />
      </div>
    </main>
  );
}
