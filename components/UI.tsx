import React, { useState } from 'react';
import { GameState, ScoreState, GameConfig, Difficulty } from '../game/config';

interface UIProps {
  state: GameState;
  score: ScoreState;
  onStart: (config: GameConfig) => void;
  onResume: () => void;
  onRestart: () => void;
  onSmashToggle: (enabled: boolean) => void;
}

export const UI: React.FC<UIProps> = ({ state, score, onStart, onResume, onRestart, onSmashToggle }) => {
  const [targetScore, setTargetScore] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [smashOn, setSmashOn] = useState(false);

  const toggleSmash = () => {
      const newVal = !smashOn;
      setSmashOn(newVal);
      onSmashToggle(newVal);
  };

  // MENU STATE
  if (state === GameState.MENU) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50">
        <div className="bg-gray-900 p-8 rounded-xl border border-blue-500 shadow-2xl max-w-md w-full">
          <h1 className="text-4xl font-bold text-center mb-8 text-blue-400 italic uppercase tracking-wider">Pro Smash 3D</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Match Points</label>
              <div className="flex gap-2">
                {[3, 5, 10].map(p => (
                  <button 
                    key={p}
                    onClick={() => setTargetScore(p)}
                    className={`flex-1 py-2 rounded font-bold transition-all ${targetScore === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Difficulty</label>
              <select 
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-gray-800 text-white p-3 rounded border border-gray-700 focus:border-blue-500 outline-none"
              >
                {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <button 
              onClick={() => onStart({ targetScore, difficulty, isSmashMode: false })}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-4 rounded-lg font-bold text-xl hover:from-blue-500 hover:to-indigo-500 transform hover:scale-[1.02] transition-all shadow-lg"
            >
              START MATCH
            </button>
          </div>
          
          <div className="mt-6 text-xs text-center text-gray-500">
            <p>Controls: WASD to Move • Drag Mouse to Swing</p>
          </div>
        </div>
      </div>
    );
  }

  // GAME OVER STATE
  if (state === GameState.MATCH_END) {
     const playerWon = score.player > score.opponent;
     return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white z-50">
            <div className="text-center">
                <h1 className={`text-6xl font-black mb-4 ${playerWon ? 'text-green-500' : 'text-red-500'}`}>
                    {playerWon ? 'VICTORY!' : 'DEFEAT'}
                </h1>
                <p className="text-2xl mb-8">Score: {score.player} - {score.opponent}</p>
                <button 
                  onClick={onRestart}
                  className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                >
                    PLAY AGAIN
                </button>
            </div>
        </div>
     );
  }

  // HUD STATE
  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* Top Bar HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className={`flex flex-col bg-black/50 p-3 rounded-lg backdrop-blur-sm border ${score.server === 'player' ? 'border-yellow-400' : 'border-white/10'}`}>
            <span className="text-xs text-blue-300 font-bold uppercase tracking-widest flex items-center gap-2">
               Player {score.server === 'player' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>}
            </span>
            <span className="text-4xl font-black text-white">{score.player}</span>
        </div>

        <div className="flex flex-col items-center mt-2">
             <div className="bg-black/60 px-4 py-1 rounded-full text-xs font-mono text-gray-300 mb-2 border border-white/10">
                Target: {targetScore}
             </div>
             
             {/* Serve Indicator */}
             {state === GameState.PLAYING && (
               <div className="text-center">
                  {score.server === 'player' ? (
                      <div className="text-yellow-400 font-bold text-sm animate-pulse shadow-black drop-shadow-md">
                         DRAG TO SERVE
                      </div>
                  ) : (
                      <div className="text-red-400 font-bold text-sm">
                         OPPONENT SERVING...
                      </div>
                  )}
               </div>
             )}

             {state === GameState.PAUSED && (
                 <div className="bg-yellow-500 text-black font-bold px-3 py-1 rounded animate-pulse mt-2">
                     PAUSED
                 </div>
             )}
        </div>

        <div className={`flex flex-col bg-black/50 p-3 rounded-lg backdrop-blur-sm border items-end ${score.server === 'opponent' ? 'border-yellow-400' : 'border-white/10'}`}>
            <span className="text-xs text-red-300 font-bold uppercase tracking-widest flex items-center gap-2">
              {score.server === 'opponent' && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>} Opponent
            </span>
            <span className="text-4xl font-black text-white">{score.opponent}</span>
        </div>
      </div>

      {/* Controls Buttons */}
      <div className="absolute bottom-6 right-6 pointer-events-auto flex flex-col gap-3">
         <button 
           onClick={toggleSmash}
           className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xs border-4 shadow-lg transition-all ${smashOn ? 'bg-red-600 border-red-400 text-white scale-110' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
         >
            SMASH
            <br/>
            {smashOn ? 'ON' : 'OFF'}
         </button>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-auto">
         <button 
            onClick={onResume}
            className="w-12 h-12 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 border border-gray-600"
         >
            {state === GameState.PAUSED ? '▶' : 'II'}
         </button>
      </div>
      
      {/* Mobile Virtual Joystick Placeholder */}
      <div className="absolute bottom-10 left-10 w-32 h-32 border-2 border-white/10 rounded-full pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
      </div>
    </div>
  );
};