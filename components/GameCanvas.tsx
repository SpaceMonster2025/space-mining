import React, { useRef, useEffect, useState } from 'react';
import { GameState, PlayerState, Asteroid, Point, MineralType } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  STATION_POSITION, 
  STATION_RADIUS, 
  DOCKING_RANGE, 
  ASTEROID_SPAWN_RADIUS,
  WORLD_BOUNDS,
  MINERAL_COLORS
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  onDock: (finalPlayerState: PlayerState) => void;
  onGameOver: () => void;
  playerState: PlayerState; // Initial state when launching
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onDock, onGameOver, playerState: initialPlayerState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudState, setHudState] = useState<PlayerState | null>(null);

  // Mutable game state refs to avoid re-renders during game loop
  const shipRef = useRef(initialPlayerState);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number, y: number, isDown: boolean }>({ x: 0, y: 0, isDown: false });
  const particlesRef = useRef<{x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string}[]>([]);
  
  // Camera position (centered on ship usually, but smoothed)
  const cameraRef = useRef({ x: 0, y: 0 });

  // Stars for parallax
  const starsRef = useRef<{x: number, y: number, size: number, depth: number}[]>([]);

  // --- Initialization ---
  useEffect(() => {
    shipRef.current = initialPlayerState;
    
    // Generate Stars
    const stars = [];
    for(let i=0; i<200; i++) {
      stars.push({
        x: (Math.random() - 0.5) * CANVAS_WIDTH * 4,
        y: (Math.random() - 0.5) * CANVAS_HEIGHT * 4,
        size: Math.random() * 2,
        depth: 0.2 + Math.random() * 0.8
      });
    }
    starsRef.current = stars;

    // Generate Asteroids
    const asteroids: Asteroid[] = [];
    const count = 150;
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = ASTEROID_SPAWN_RADIUS + Math.random() * (WORLD_BOUNDS - ASTEROID_SPAWN_RADIUS);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      
      // Determine type based on distance rarity
      let type = MineralType.IRON;
      const rand = Math.random();
      if (dist > 3000 && rand > 0.8) type = MineralType.KRONOS;
      else if (dist > 2000 && rand > 0.7) type = MineralType.GOLD;
      else if (dist > 1000 && rand > 0.6) type = MineralType.SILICON;

      // Generate jagged vertices
      const radius = 20 + Math.random() * 40;
      const vertices: Point[] = [];
      const numVerts = 6 + Math.floor(Math.random() * 6);
      for (let v = 0; v < numVerts; v++) {
          const vAngle = (v / numVerts) * Math.PI * 2;
          const rOffset = radius * (0.8 + Math.random() * 0.4);
          vertices.push({
              x: Math.cos(vAngle) * rOffset,
              y: Math.sin(vAngle) * rOffset
          });
      }

      asteroids.push({
        id: `ast-${i}`,
        x, y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius,
        vertices,
        type,
        health: 100,
        maxHealth: 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        isHeating: false
      });
    }
    asteroidsRef.current = asteroids;

  }, [initialPlayerState]);


  // --- Input Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if(!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseDown = () => { mouseRef.current.isDown = true; };
    const handleMouseUp = () => { mouseRef.current.isDown = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Mouse events need to be attached to window or specific element depending on focus. 
    // For full screen games, window is safer for drag.
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);


  // --- Game Loop ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let animationFrameId: number;
    const ctx = canvasRef.current?.getContext('2d');

    const loop = () => {
      if (!ctx || !canvasRef.current) return;
      const ship = shipRef.current;
      const { width, height } = canvasRef.current;

      // 1. Physics & Logic
      
      // Rotation (A/D or Left/Right)
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) ship.rotation -= ship.shipConfig.rotationSpeed;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) ship.rotation += ship.shipConfig.rotationSpeed;

      // Thrust (W/Up)
      const isThrusting = keysRef.current['KeyW'] || keysRef.current['ArrowUp'];
      if (isThrusting && ship.currentFuel > 0) {
        ship.velocity.x += Math.cos(ship.rotation) * ship.shipConfig.acceleration;
        ship.velocity.y += Math.sin(ship.rotation) * ship.shipConfig.acceleration;
        ship.currentFuel -= ship.shipConfig.thrustConsumptionRate;
        
        // Spawn thrust particles
        particlesRef.current.push({
            x: ship.position.x - Math.cos(ship.rotation) * 15,
            y: ship.position.y - Math.sin(ship.rotation) * 15,
            vx: ship.velocity.x - Math.cos(ship.rotation) * 2 + (Math.random()-0.5),
            vy: ship.velocity.y - Math.sin(ship.rotation) * 2 + (Math.random()-0.5),
            life: 20,
            maxLife: 20,
            color: '#fbbf24' // Amber
        });
      }

      // Friction/Space Drag (Newtonian-lite)
      ship.velocity.x *= 0.99;
      ship.velocity.y *= 0.99;

      // Cap speed
      const speed = Math.sqrt(ship.velocity.x**2 + ship.velocity.y**2);
      if (speed > ship.shipConfig.maxSpeed) {
        ship.velocity.x = (ship.velocity.x / speed) * ship.shipConfig.maxSpeed;
        ship.velocity.y = (ship.velocity.y / speed) * ship.shipConfig.maxSpeed;
      }

      // Update Position
      ship.position.x += ship.velocity.x;
      ship.position.y += ship.velocity.y;

      // Idle Fuel Consumption
      if (ship.currentFuel > 0) {
        ship.currentFuel -= ship.shipConfig.fuelConsumptionRate;
      } else {
          // Game Over Check
          if (Math.abs(ship.velocity.x) < 0.1 && Math.abs(ship.velocity.y) < 0.1) {
              onGameOver();
              return; // Stop loop
          }
      }

      // Camera Follow
      cameraRef.current.x = ship.position.x - width / 2;
      cameraRef.current.y = ship.position.y - height / 2;

      // Mining Logic
      let miningTarget: Asteroid | null = null;
      const worldMouseX = mouseRef.current.x + cameraRef.current.x;
      const worldMouseY = mouseRef.current.y + cameraRef.current.y;

      if (mouseRef.current.isDown && ship.currentFuel > 0) {
          // Find asteroid under mouse
          for (let ast of asteroidsRef.current) {
              const dx = worldMouseX - ast.x;
              const dy = worldMouseY - ast.y;
              if (dx*dx + dy*dy < ast.radius * ast.radius) {
                  // Check range
                  const distToShip = Math.sqrt((ast.x - ship.position.x)**2 + (ast.y - ship.position.y)**2);
                  if (distToShip <= ship.shipConfig.miningRange) {
                      miningTarget = ast;
                      break; // Only mine one at a time
                  }
              }
          }
      }

      if (miningTarget) {
          miningTarget.isHeating = true;
          miningTarget.health -= ship.shipConfig.miningPower;
          ship.currentFuel -= ship.shipConfig.thrustConsumptionRate * 0.5; // Laser uses fuel too

          // Spawn laser hit particles
          if (Math.random() > 0.5) {
             particlesRef.current.push({
                x: miningTarget.x + (Math.random()-0.5)*20,
                y: miningTarget.y + (Math.random()-0.5)*20,
                vx: (Math.random()-0.5)*3,
                vy: (Math.random()-0.5)*3,
                life: 15,
                maxLife: 15,
                color: '#ffffff'
             });
          }

          if (miningTarget.health <= 0) {
              // Destroyed!
              const lootAmount = Math.floor(miningTarget.radius / 5); // simplified loot math
              const currentCargo = Object.values(ship.cargo).reduce((a,b) => a+b, 0);
              
              if (currentCargo < ship.shipConfig.maxCargo) {
                   ship.cargo[miningTarget.type] = (ship.cargo[miningTarget.type] || 0) + lootAmount;
                   // Clamp if overflow (simplified, just takes it all or stops at max)
                   if (Object.values(ship.cargo).reduce((a,b) => a+b, 0) > ship.shipConfig.maxCargo) {
                       // Ideally handle partial add, but this is fine for now
                   }
              }
              
              // Explosion particles
              for(let k=0; k<10; k++) {
                  particlesRef.current.push({
                    x: miningTarget.x,
                    y: miningTarget.y,
                    vx: (Math.random()-0.5)*5,
                    vy: (Math.random()-0.5)*5,
                    life: 40,
                    maxLife: 40,
                    color: MINERAL_COLORS[miningTarget.type]
                  });
              }

              // Remove asteroid
              asteroidsRef.current = asteroidsRef.current.filter(a => a !== miningTarget);
          }
      }

      // Docking Logic
      const distToStation = Math.sqrt(ship.position.x**2 + ship.position.y**2);
      if (distToStation < DOCKING_RANGE && speed < 2) {
          // Show docking hint?
          // If stopped, dock
          if (speed < 0.5) {
              onDock(ship);
              return;
          }
      }


      // --- Rendering ---
      
      // Clear Screen
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

      // Draw Stars (Parallax)
      ctx.fillStyle = '#ffffff';
      starsRef.current.forEach(star => {
          // Parallax: Move stars slightly based on camera
          const px = star.x + (cameraRef.current.x * (1 - star.depth));
          const py = star.y + (cameraRef.current.y * (1 - star.depth));
          
          // Wrap stars (infinite field illusion)
          // Simplified: just draw fixed stars relative to world for now to avoid complex wrapping logic bugs
          ctx.globalAlpha = Math.random() * 0.8 + 0.2;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
          ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Station
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ff00';
      ctx.beginPath();
      ctx.arc(STATION_POSITION.x, STATION_POSITION.y, STATION_RADIUS, 0, Math.PI*2);
      ctx.stroke();
      // Station details
      ctx.beginPath();
      ctx.arc(STATION_POSITION.x, STATION_POSITION.y, STATION_RADIUS * 0.4, 0, Math.PI*2);
      ctx.stroke();
      ctx.font = '20px monospace';
      ctx.fillStyle = '#00ff00';
      ctx.textAlign = 'center';
      ctx.fillText("RETRO-ROCKET STATION", STATION_POSITION.x, STATION_POSITION.y + STATION_RADIUS + 40);

      // Draw Asteroids
      asteroidsRef.current.forEach(ast => {
          ast.rotation += ast.rotationSpeed;
          
          ctx.shadowColor = ast.isHeating ? '#ff0000' : MINERAL_COLORS[ast.type];
          ctx.shadowBlur = ast.isHeating ? 20 : 5;
          ctx.strokeStyle = ast.isHeating ? '#ffffff' : MINERAL_COLORS[ast.type];
          ctx.fillStyle = '#000000';
          
          if (ast.isHeating) {
              // Vibrate
              ctx.save();
              ctx.translate(ast.x + (Math.random()-0.5)*2, ast.y + (Math.random()-0.5)*2);
          } else {
              ctx.save();
              ctx.translate(ast.x, ast.y);
          }
          
          ctx.rotate(ast.rotation);
          ctx.beginPath();
          ast.vertices.forEach((p, i) => {
              if (i===0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.fill();

          // Core glow
          ctx.fillStyle = ctx.shadowColor;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          ctx.restore();
          ast.isHeating = false; // Reset flag
      });

      // Draw Particles
      particlesRef.current.forEach((p, i) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillRect(p.x, p.y, 2, 2);
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      ctx.globalAlpha = 1.0;


      // Draw Mining Laser
      if (miningTarget) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00ffff';
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2 + Math.random() * 2;
          ctx.beginPath();
          ctx.moveTo(ship.position.x, ship.position.y);
          ctx.lineTo(miningTarget.x, miningTarget.y);
          ctx.stroke();
          
          // Source flare
          ctx.beginPath();
          ctx.arc(ship.position.x, ship.position.y, 5, 0, Math.PI*2);
          ctx.fillStyle = '#fff';
          ctx.fill();
      }


      // Draw Ship
      ctx.translate(ship.position.x, ship.position.y);
      ctx.rotate(ship.rotation);
      
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffffff'; // Main Hull
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      // Saucer shape
      ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
      ctx.moveTo(0, -15);
      ctx.lineTo(0, -25); // Cockpit spike
      ctx.stroke();

      // Engine flare (if thrusting)
      if (isThrusting) {
          ctx.strokeStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-25 - Math.random()*10, 0);
          ctx.moveTo(-10, 5);
          ctx.lineTo(-20 - Math.random()*5, 5);
          ctx.moveTo(-10, -5);
          ctx.lineTo(-20 - Math.random()*5, -5);
          ctx.stroke();
      }

      ctx.restore(); // End world space


      // --- HUD (On Canvas for style) ---
      
      // 1. Radar (Bottom Right)
      const radarSize = 100;
      const radarX = width - radarSize - 20;
      const radarY = height - radarSize - 20;
      
      ctx.fillStyle = '#001100';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
      
      ctx.beginPath();
      ctx.arc(radarX, radarY, radarSize, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // Radar Blips
      const radarScale = radarSize / 2000; // 2000 unit range
      asteroidsRef.current.forEach(ast => {
          const dx = ast.x - ship.position.x;
          const dy = ast.y - ship.position.y;
          if (dx*dx + dy*dy < (2000*2000)) {
              const rx = radarX + dx * radarScale;
              const ry = radarY + dy * radarScale;
              // Clip to circle
              const dist = Math.sqrt((rx-radarX)**2 + (ry-radarY)**2);
              if (dist < radarSize) {
                  ctx.fillStyle = MINERAL_COLORS[ast.type];
                  ctx.fillRect(rx-1, ry-1, 2, 2);
              }
          }
      });
      // Station Blip
      const stationDx = STATION_POSITION.x - ship.position.x;
      const stationDy = STATION_POSITION.y - ship.position.y;
      const sRx = radarX + stationDx * radarScale;
      const sRy = radarY + stationDy * radarScale;
      if (Math.sqrt((sRx-radarX)**2 + (sRy-radarY)**2) < radarSize) {
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(sRx-3, sRy-3, 6, 6);
      }
      // Player Blip
      ctx.fillStyle = '#fff';
      ctx.fillRect(radarX-1, radarY-1, 3, 3);

      // 2. Fuel Gauge (Bottom Left)
      const fuelPct = ship.currentFuel / ship.shipConfig.maxFuel;
      ctx.fillStyle = '#001100';
      ctx.strokeStyle = fuelPct < 0.2 ? '#ff0000' : '#00ff00';
      ctx.lineWidth = 2;
      ctx.fillRect(20, height - 40, 200, 20);
      ctx.strokeRect(20, height - 40, 200, 20);
      ctx.fillStyle = fuelPct < 0.2 ? '#ff0000' : '#00ff00';
      ctx.fillRect(22, height - 38, 196 * fuelPct, 16);
      
      ctx.font = '16px monospace';
      ctx.fillStyle = '#00ff00';
      ctx.fillText(`FUEL: ${Math.floor(ship.currentFuel)}`, 20, height - 45);

      // 3. Cargo (Bottom Left, above fuel)
      const currentCargo = Object.values(ship.cargo).reduce((a,b) => a+b, 0);
      ctx.fillText(`CARGO: ${Math.floor(currentCargo)} / ${ship.shipConfig.maxCargo}`, 20, height - 70);

      // 4. Docking Indicator
      if (distToStation < DOCKING_RANGE) {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.font = '20px monospace';
          if (speed < 0.5) ctx.fillText("DOCKING SEQUENCE INITIATED...", width/2, height - 100);
          else ctx.fillText("REDUCE SPEED TO DOCK", width/2, height - 100);
      }

      // Sync important state to React for overlay updates (throttled or just when pausing)
      // Here we just keep refs.

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, onDock, onGameOver]);

  return (
    <canvas 
      ref={canvasRef} 
      width={CANVAS_WIDTH} 
      height={CANVAS_HEIGHT} 
      className="block bg-black cursor-crosshair"
    />
  );
};