
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { StationInterface } from './components/StationInterface';
import { RetroUI } from './components/RetroUI';
import { GameState, PlayerState, MineralType } from './types';
import { INITIAL_SHIP_CONFIG, STATION_POSITION } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  
  const [playerState, setPlayerState] = useState<PlayerState>({
    credits: 0,
    currentFuel: INITIAL_SHIP_CONFIG.maxFuel,
    cargo: {
      [MineralType.IRON]: 0,
      [MineralType.SILICON]: 0,
      [MineralType.GOLD]: 0,
      [MineralType.KRONOS]: 0,
    },
    shipConfig: INITIAL_SHIP_CONFIG,
    position: { x: STATION_POSITION.x + 100, y: STATION_POSITION.y + 100 }, // Start just outside
    velocity: { x: 0, y: 0 },
    rotation: -Math.PI / 2,
  });

  const handleDock = (finalState: PlayerState) => {
    setPlayerState({
      ...finalState,
      velocity: { x: 0, y: 0 },
      position: { x: STATION_POSITION.x, y: STATION_POSITION.y } // Snap to center
    });
    setGameState(GameState.DOCKED);
  };

  const handleLaunch = () => {
    // Reset position slightly outside to avoid instant redock
    setPlayerState(prev => ({
      ...prev,
      position: { x: STATION_POSITION.x, y: STATION_POSITION.y + 220 },
      velocity: { x: 0, y: 1 } // Little push out
    }));
    setGameState(GameState.PLAYING);
  };

  const handleStartGame = () => {
    // Attempt to go fullscreen
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Error attempting to enable full-screen mode:", err);
      });
    }
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = () => {
    setGameState(GameState.GAMEOVER);
  };

  const handleRestart = () => {
    setPlayerState({
      credits: 0,
      currentFuel: INITIAL_SHIP_CONFIG.maxFuel,
      cargo: {
        [MineralType.IRON]: 0,
        [MineralType.SILICON]: 0,
        [MineralType.GOLD]: 0,
        [MineralType.KRONOS]: 0,
      },
      shipConfig: INITIAL_SHIP_CONFIG,
      position: { x: STATION_POSITION.x, y: STATION_POSITION.y + 220 },
      velocity: { x: 0, y: 1 },
      rotation: -Math.PI / 2,
    });
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <RetroUI />
      
      {/* Game Layer */}
      {(gameState === GameState.PLAYING || gameState === GameState.DOCKED) && (
        <GameCanvas 
          gameState={gameState}
          playerState={playerState} 
          onDock={handleDock}
          onGameOver={handleGameOver}
        />
      )}

      {/* Start Screen */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center space-y-6 p-10 border-4 border-green-500 rounded shadow-[0_0_30px_#00ff00]">
            <h1 className="text-6xl font-bold text-green-500 font-mono retro-glow tracking-tighter">
              THE KRONOS BELT<br/>PROSPECTOR
            </h1>
            <p className="text-xl text-green-300 font-mono max-w-md mx-auto">
              Pilot your experimental Vector-Craft into the rings of Saturn. 
              Mine rare isotopes. Manage your fuel. Survive.
            </p>
            <div className="py-4">
              <p className="text-sm text-green-700">CONTROLS: WASD + MOUSE</p>
            </div>
            <button 
              onClick={handleStartGame}
              className="px-8 py-3 bg-green-600 text-black font-bold text-2xl rounded hover:bg-green-400 transition-all hover:scale-105 shadow-[0_0_15px_#00ff00]"
            >
              INITIATE LAUNCH SEQUENCE
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center space-y-6 border border-red-500 p-12 rounded bg-black">
            <h1 className="text-6xl font-bold text-red-600 font-mono retro-glow">SIGNAL LOST</h1>
            <p className="text-xl text-red-400 font-mono">
              Fuel reserves depleted. Life support failing.
            </p>
            <p className="text-lg text-yellow-500">
              Final Wealth: {Math.floor(playerState.credits)} Credits
            </p>
            <button 
              onClick={handleRestart}
              className="px-8 py-3 border border-red-500 text-red-500 font-bold text-xl rounded hover:bg-red-600 hover:text-black transition-all"
            >
              RESCUE & RESTART
            </button>
          </div>
        </div>
      )}

      {/* Docking Interface */}
      {gameState === GameState.DOCKED && (
        <StationInterface 
          playerState={playerState} 
          setPlayerState={setPlayerState} 
          onLaunch={handleLaunch} 
        />
      )}
    </div>
  );
};

export default App;
