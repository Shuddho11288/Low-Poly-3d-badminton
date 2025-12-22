import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { UI } from './components/UI';
import { GameState, ScoreState, GameConfig } from './game/config';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState<ScoreState>({ player: 0, opponent: 0, server: 'player' });

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(
      containerRef.current,
      (newScore) => setScore(newScore),
      (newState) => setGameState(newState)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
    };
  }, []);

  // Handle Joystick (DOM Overlay for touch)
  const handleJoystick = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!engineRef.current) return;
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      
      const dx = (touch.clientX - cx) / (rect.width/2);
      const dy = (touch.clientY - cy) / (rect.height/2);
      
      engineRef.current.joystickMove = { x: dx, y: dy };
  };

  const resetJoystick = () => {
      if (engineRef.current) engineRef.current.joystickMove = { x: 0, y: 0 };
  };

  const handleStart = (config: GameConfig) => {
    engineRef.current?.startGame(config);
  };

  const handleResume = () => {
    engineRef.current?.pause();
  };

  const handleRestart = () => {
    setGameState(GameState.MENU);
  };

  const handleSmashToggle = (val: boolean) => {
    engineRef.current?.setSmashMode(val);
  };

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden font-sans">
      <div ref={containerRef} className="w-full h-full touch-none" />
      
      <UI 
        state={gameState} 
        score={score} 
        onStart={handleStart}
        onResume={handleResume}
        onRestart={handleRestart}
        onSmashToggle={handleSmashToggle}
      />

      {/* Invisible Touch Zone for Virtual Joystick (Bottom Left) */}
      {gameState === GameState.PLAYING && (
          <div 
            className="absolute bottom-8 left-8 w-40 h-40 z-30 touch-none"
            onTouchStart={handleJoystick}
            onTouchMove={handleJoystick}
            onTouchEnd={resetJoystick}
          />
      )}
    </div>
  );
}