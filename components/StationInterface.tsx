import React from 'react';
import { PlayerState, MineralType, GameState } from '../types';
import { MINERAL_VALUES, MINERAL_COLORS, INITIAL_SHIP_CONFIG, UPGRADE_COST_BASE, UPGRADE_COST_MULTIPLIER } from '../constants';

interface StationInterfaceProps {
  playerState: PlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  onLaunch: () => void;
}

export const StationInterface: React.FC<StationInterfaceProps> = ({ playerState, setPlayerState, onLaunch }) => {

  const calculateUpgradeCost = (level: number) => {
    return Math.floor(UPGRADE_COST_BASE * Math.pow(UPGRADE_COST_MULTIPLIER, level));
  };

  // Simple level calculation based on current stat vs initial stat (simplified logic)
  const getLevel = (current: number, initial: number, step: number) => {
    return Math.round((current - initial) / step);
  };

  const sellAll = () => {
    let totalValue = 0;
    const newCargo = { ...playerState.cargo };
    (Object.keys(newCargo) as MineralType[]).forEach(type => {
      totalValue += newCargo[type] * MINERAL_VALUES[type];
      newCargo[type] = 0;
    });

    setPlayerState(prev => ({
      ...prev,
      credits: prev.credits + totalValue,
      cargo: newCargo,
      currentFuel: prev.shipConfig.maxFuel // Refuel on dock logic? Or make it paid? Let's make refuel paid but cheap.
    }));
  };

  const refuel = () => {
    const fuelNeeded = playerState.shipConfig.maxFuel - playerState.currentFuel;
    const cost = Math.ceil(fuelNeeded * 0.1); // 0.1 credit per fuel unit

    if (playerState.credits >= cost) {
      setPlayerState(prev => ({
        ...prev,
        credits: prev.credits - cost,
        currentFuel: prev.shipConfig.maxFuel
      }));
    } else {
      // Partial refuel
      const fuelAffordable = Math.floor(playerState.credits / 0.1);
      setPlayerState(prev => ({
        ...prev,
        credits: 0,
        currentFuel: prev.currentFuel + fuelAffordable
      }));
    }
  };

  const upgradeStat = (statKey: keyof typeof INITIAL_SHIP_CONFIG, step: number, cost: number) => {
    if (playerState.credits >= cost) {
      setPlayerState(prev => ({
        ...prev,
        credits: prev.credits - cost,
        shipConfig: {
          ...prev.shipConfig,
          [statKey]: prev.shipConfig[statKey as keyof typeof INITIAL_SHIP_CONFIG] + step
        }
      }));
    }
  };

  // Derived levels for display
  const engineLevel = getLevel(playerState.shipConfig.acceleration, INITIAL_SHIP_CONFIG.acceleration, 0.02);
  const cargoLevel = getLevel(playerState.shipConfig.maxCargo, INITIAL_SHIP_CONFIG.maxCargo, 10);
  const laserLevel = getLevel(playerState.shipConfig.miningPower, INITIAL_SHIP_CONFIG.miningPower, 0.5);
  const fuelLevel = getLevel(playerState.shipConfig.maxFuel, INITIAL_SHIP_CONFIG.maxFuel, 200);

  const engineCost = calculateUpgradeCost(engineLevel);
  const cargoCost = calculateUpgradeCost(cargoLevel);
  const laserCost = calculateUpgradeCost(laserLevel);
  const fuelCost = calculateUpgradeCost(fuelLevel);

  const fuelMissing = playerState.shipConfig.maxFuel - playerState.currentFuel;
  const refuelCost = Math.ceil(fuelMissing * 0.1);

  const totalCargoCount = Object.values(playerState.cargo).reduce((a, b) => a + b, 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 text-green-500 font-mono p-4">
      <div className="w-full max-w-4xl border-2 border-green-500 p-6 bg-black shadow-[0_0_20px_rgba(0,255,0,0.3)] rounded-lg relative">
        {/* Header */}
        <div className="flex justify-between items-end border-b-2 border-green-800 pb-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold retro-glow">RETRO-ROCKET STATION</h1>
            <p className="text-sm opacity-80">DOCKING BAY 94 // WELCOME PROSPECTOR</p>
          </div>
          <div className="text-right">
            <p className="text-2xl text-yellow-400 retro-glow-amber">CREDITS: {Math.floor(playerState.credits)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Market & Status */}
          <div className="space-y-6">
            
            {/* Cargo Manifest */}
            <div className="border border-green-900 p-4 rounded bg-green-900/10">
              <h2 className="text-xl mb-4 border-b border-green-800 inline-block">CARGO MANIFEST</h2>
              <div className="space-y-2">
                {(Object.keys(playerState.cargo) as MineralType[]).map(type => (
                  <div key={type} className="flex justify-between items-center">
                    <span style={{ color: MINERAL_COLORS[type] }}>{type}</span>
                    <span>{Math.floor(playerState.cargo[type])} units</span>
                  </div>
                ))}
                <div className="mt-4 pt-2 border-t border-green-800 flex justify-between text-yellow-400">
                  <span>CAPACITY: {Math.floor(totalCargoCount)} / {playerState.shipConfig.maxCargo}</span>
                  <button 
                    onClick={sellAll}
                    disabled={totalCargoCount === 0}
                    className="bg-green-900 hover:bg-green-700 text-white px-3 py-1 text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    Sell All Cargo
                  </button>
                </div>
              </div>
            </div>

            {/* Refuel */}
            <div className="border border-green-900 p-4 rounded bg-green-900/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl">FUEL SYSTEMS</h2>
                <div className="w-full bg-gray-800 h-2 mt-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-yellow-500 h-full" 
                    style={{ width: `${(playerState.currentFuel / playerState.shipConfig.maxFuel) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs mt-1 text-gray-400">{Math.floor(playerState.currentFuel)} / {playerState.shipConfig.maxFuel}</p>
              </div>
              <button 
                onClick={refuel}
                disabled={fuelMissing <= 1}
                className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                REFUEL ({refuelCost}cr)
              </button>
            </div>

          </div>

          {/* Right Column: Engineering */}
          <div className="border border-green-900 p-4 rounded bg-green-900/10">
             <h2 className="text-xl mb-4 border-b border-green-800 inline-block">ENGINEERING / UPGRADES</h2>
             <div className="space-y-4">
               
               {/* Engine */}
               <div className="flex justify-between items-center group">
                 <div>
                   <h3 className="text-lg">ION THRUSTERS</h3>
                   <p className="text-xs text-gray-400">Increase acceleration & top speed.</p>
                   <p className="text-xs text-green-400">Lvl {engineLevel + 1}</p>
                 </div>
                 <button 
                    onClick={() => upgradeStat('acceleration', 0.02, engineCost)}
                    disabled={playerState.credits < engineCost}
                    className="border border-green-600 hover:bg-green-600 hover:text-black px-3 py-1 text-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-600"
                 >
                   INSTALL ({engineCost}cr)
                 </button>
               </div>

               {/* Cargo */}
               <div className="flex justify-between items-center group">
                 <div>
                   <h3 className="text-lg">CARGO HOLD</h3>
                   <p className="text-xs text-gray-400">Increase storage capacity.</p>
                   <p className="text-xs text-green-400">Lvl {cargoLevel + 1}</p>
                 </div>
                 <button 
                    onClick={() => upgradeStat('maxCargo', 10, cargoCost)}
                    disabled={playerState.credits < cargoCost}
                    className="border border-green-600 hover:bg-green-600 hover:text-black px-3 py-1 text-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-600"
                 >
                   EXPAND ({cargoCost}cr)
                 </button>
               </div>

               {/* Laser */}
               <div className="flex justify-between items-center group">
                 <div>
                   <h3 className="text-lg">FOCAL LENS</h3>
                   <p className="text-xs text-gray-400">Faster mining speed.</p>
                   <p className="text-xs text-green-400">Lvl {laserLevel + 1}</p>
                 </div>
                 <button 
                    onClick={() => upgradeStat('miningPower', 0.5, laserCost)}
                    disabled={playerState.credits < laserCost}
                    className="border border-green-600 hover:bg-green-600 hover:text-black px-3 py-1 text-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-600"
                 >
                   CALIBRATE ({laserCost}cr)
                 </button>
               </div>

                {/* Tank */}
               <div className="flex justify-between items-center group">
                 <div>
                   <h3 className="text-lg">FUEL CELLS</h3>
                   <p className="text-xs text-gray-400">Increase max fuel capacity.</p>
                   <p className="text-xs text-green-400">Lvl {fuelLevel + 1}</p>
                 </div>
                 <button 
                    onClick={() => upgradeStat('maxFuel', 200, fuelCost)}
                    disabled={playerState.credits < fuelCost}
                    className="border border-green-600 hover:bg-green-600 hover:text-black px-3 py-1 text-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green-600"
                 >
                   UPGRADE ({fuelCost}cr)
                 </button>
               </div>

             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-center">
          <button 
            onClick={onLaunch}
            className="bg-green-600 text-black text-xl font-bold px-12 py-3 rounded hover:bg-white hover:shadow-[0_0_15px_#fff] transition-all transform hover:scale-105"
          >
            LAUNCH MISSION
          </button>
        </div>

      </div>
    </div>
  );
};
