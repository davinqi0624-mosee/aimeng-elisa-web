'use client';

import { useState } from 'react';
import Link from 'next/link';
import './AiChatBot.css';

export default function AiChatBot() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Tooltip */}
      {isHovered && (
        <div className="mb-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-xl shadow-lg animate-fadeIn whitespace-nowrap">
          我是AI小助手，有问题问我哦~ ✨
        </div>
      )}

      {/* AI Bot Button */}
      <Link href="/chat">
        <div
          className="relative w-16 h-16 cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-60 blur-md animate-pulse" />
          
          {/* Main body */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-purple-600 flex items-center justify-center animate-float shadow-lg border-2 border-white/30">
            {/* Eyes */}
            <div className="flex gap-2 items-center">
              <div className="relative">
                <div className="w-4 h-4 rounded-full bg-white animate-blink">
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-900" />
                </div>
              </div>
              <div className="relative">
                <div className="w-4 h-4 rounded-full bg-white animate-blink" style={{ animationDelay: '0.1s' }}>
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-900" />
                </div>
              </div>
            </div>
          </div>

          {/* Sparkles */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full animate-sparkle" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-pink-400 rounded-full animate-sparkle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-1/2 -left-2 w-1.5 h-1.5 bg-cyan-300 rounded-full animate-sparkle" style={{ animationDelay: '1s' }} />

          {/* Orbit ring */}
          <div className="absolute inset-[-4px] rounded-full border border-dashed border-purple-400/40 animate-spin" style={{ animationDuration: '8s' }} />
        </div>
      </Link>
    </div>
  );
}