
import React, { useRef, useEffect, useState } from 'react';
import { GameState, PlayerState, Asteroid, Point, MineralType, Particle, Loot } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  STATION_POSITION, 
  STATION_RADIUS, 
  DOCKING_RANGE, 
  ASTEROID_SPAWN_RADIUS,
  WORLD_BOUNDS,
  MINERAL_COLORS,
  LOOT_COLLECTION_RANGE,
  LOOT_DESPAWN_TIME
} from '../constants';
import { SoundManager } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  onDock: (finalPlayerState: PlayerState) => void;
  onGameOver: () => void;
  playerState: PlayerState; // Initial state when launching
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onDock, onGameOver, playerState: initialPlayerState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  
  // Use state for window dimensions to handle resizing
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Mutable game state refs to avoid re-renders during game loop
  const shipRef = useRef(initialPlayerState);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number, y: number, isDown: boolean }>({ x: 0, y: 0, isDown: false });
  const particlesRef = useRef<Particle[]>([]);
  const lootRef = useRef<Loot[]>([]);
  
  // Camera position (centered on ship usually, but smoothed)
  const cameraRef = useRef({ x: 0, y: 0 });

  // Background Elements
  const starsRef = useRef<{x: number, y: number, size: number, depth: number}[]>([]);
  const nebulasRef = useRef<{x: number, y: number, size: number, color: string, depth: number}[]>([]);
  const galaxiesRef = useRef<{x: number, y: number, size: number, rotation: number, color: string, depth: number}[]>([]);

  // --- Resize Listener ---
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Initialization ---
  useEffect(() => {
    shipRef.current = initialPlayerState;
    lootRef.current = [];
    particlesRef.current = [];
    
    // Init Audio
    soundManagerRef.current = new SoundManager();
    
    // Generate Stars
    const stars = [];
    for(let i=0; i<800; i++) {
      stars.push({
        x: (Math.random() - 0.5) * WORLD_BOUNDS * 1.5, // Widen the field
        y: (Math.random() - 0.5) * WORLD_BOUNDS * 1.5,
        size: Math.random() * 2,
        depth: 0.1 + Math.random() * 0.9 // Varying depth for parallax
      });
    }
    starsRef.current = stars;

    // Generate Nebulas (Faint colored clouds)
    const nebulas = [];
    for (let i = 0; i < 15; i++) {
        const colorBase = Math.random() > 0.5 ? '76, 29, 149' : '13, 148, 136'; // Violet or Teal
        nebulas.push({
            x: (Math.random() - 0.5) * WORLD_BOUNDS * 1.2,
            y: (Math.random() - 0.5) * WORLD_BOUNDS * 1.2,
            size: 600 + Math.random() * 800,
            color: `rgba(${colorBase}, 0.08)`,
            depth: 0.05 // Very distant
        });
    }
    nebulasRef.current = nebulas;

    // Generate Galaxies (Vector Spirals)
    const galaxies = [];
    for (let i = 0; i < 8; i++) {
        galaxies.push({
            x: (Math.random() - 0.5) * WORLD_BOUNDS * 1.2,
            y: (Math.random() - 0.5) * WORLD_BOUNDS * 1.2,
            size: 150 + Math.random() * 200,
            rotation: Math.random() * Math.PI * 2,
            color: Math.random() > 0.5 ? '#8b5cf6' : '#3b82f6', // Violet or Blue
            depth: 0.02 // Extremely distant
        });
    }
    galaxiesRef.current = galaxies;

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

    // Cleanup audio
    return () => {
      soundManagerRef.current?.stopThrust();
      soundManagerRef.current?.stopLaser();
    };
  }, [initialPlayerState]);


  // --- Input Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.code] = true; 
      // Resume audio context on first interaction if needed
      soundManagerRef.current?.resume();
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if(!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseDown = () => { 
      mouseRef.current.isDown = true;
      soundManagerRef.current?.resume();
    };
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
        
        // Play Thrust Sound
        soundManagerRef.current?.startThrust();

        // Spawn thrust particles
        // Offset to rear of ship (approx -22 relative X)
        const exhaustOffset = 22;
        const exX = ship.position.x - Math.cos(ship.rotation) * exhaustOffset;
        const exY = ship.position.y - Math.sin(ship.rotation) * exhaustOffset;

        particlesRef.current.push({
            x: exX,
            y: exY,
            vx: ship.velocity.x - Math.cos(ship.rotation) * 3 + (Math.random()-0.5),
            vy: ship.velocity.y - Math.sin(ship.rotation) * 3 + (Math.random()-0.5),
            life: 20,
            maxLife: 20,
            color: '#fbbf24', // Amber
            size: 2
        });
      } else {
        // Stop Thrust Sound
        soundManagerRef.current?.stopThrust();
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
              soundManagerRef.current?.stopLaser();
              soundManagerRef.current?.stopThrust();
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
          
          // Play Laser Sound
          soundManagerRef.current?.startLaser();

          // Spawn laser hit particles
          if (Math.random() > 0.5) {
             particlesRef.current.push({
                x: miningTarget.x + (Math.random()-0.5)*20,
                y: miningTarget.y + (Math.random()-0.5)*20,
                vx: (Math.random()-0.5)*3,
                vy: (Math.random()-0.5)*3,
                life: 15,
                maxLife: 15,
                color: '#ffffff',
                size: 1
             });
          }

          if (miningTarget.health <= 0) {
              // Destroyed!
              
              // Play Explosion
              soundManagerRef.current?.playExplosion();
              
              const lootAmount = Math.floor(miningTarget.radius / 5); 
              
              // --- Spawn Loot Drop ---
              lootRef.current.push({
                  id: `loot-${Date.now()}`,
                  x: miningTarget.x,
                  y: miningTarget.y,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: (Math.random() - 0.5) * 1.5,
                  type: miningTarget.type,
                  amount: lootAmount,
                  life: LOOT_DESPAWN_TIME
              });

              // --- Shatter Effect ---
              // Create "chunks" (larger debris)
              for(let k=0; k<8; k++) {
                  particlesRef.current.push({
                    x: miningTarget.x + (Math.random()-0.5) * miningTarget.radius * 0.5,
                    y: miningTarget.y + (Math.random()-0.5) * miningTarget.radius * 0.5,
                    vx: (Math.random()-0.5)*3,
                    vy: (Math.random()-0.5)*3,
                    life: 60 + Math.random() * 40,
                    maxLife: 100,
                    color: MINERAL_COLORS[miningTarget.type],
                    size: 3 + Math.random() * 4 // Chunkier
                  });
              }
              // Create "dust" (smaller particles)
              for(let k=0; k<15; k++) {
                particlesRef.current.push({
                  x: miningTarget.x + (Math.random()-0.5) * miningTarget.radius,
                  y: miningTarget.y + (Math.random()-0.5) * miningTarget.radius,
                  vx: (Math.random()-0.5)*6,
                  vy: (Math.random()-0.5)*6,
                  life: 30 + Math.random() * 20,
                  maxLife: 50,
                  color: MINERAL_COLORS[miningTarget.type],
                  size: 1 + Math.random() * 2
                });
            }

              // Remove asteroid
              asteroidsRef.current = asteroidsRef.current.filter(a => a !== miningTarget);
          }
      } else {
          // Stop Laser Sound
          soundManagerRef.current?.stopLaser();
      }
      
      // --- Loot Logic ---
      lootRef.current.forEach(loot => {
          // Physics (drag)
          loot.x += loot.vx;
          loot.y += loot.vy;
          loot.vx *= 0.95;
          loot.vy *= 0.95;
          loot.life--;
          
          // Collision with ship
          const dx = ship.position.x - loot.x;
          const dy = ship.position.y - loot.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < LOOT_COLLECTION_RANGE) {
              const currentCargoTotal = Object.values(ship.cargo).reduce((a,b) => a+b, 0);
              
              if (currentCargoTotal + loot.amount <= ship.shipConfig.maxCargo) {
                  // Collect
                  ship.cargo[loot.type] = (ship.cargo[loot.type] || 0) + loot.amount;
                  loot.life = 0; // Remove
                  
                  // Play Collect Sound
                  soundManagerRef.current?.playCollect();
                  
                  // Visual Feedback (Floating Text)
                  particlesRef.current.push({
                      x: loot.x,
                      y: loot.y,
                      vx: 0, vy: -1,
                      life: 60, maxLife: 60,
                      color: '#aaffaa',
                      size: 0,
                      text: `+${loot.amount} ${loot.type}`
                  });
              } else {
                  // Full
                  // Only show warning occasionally to avoid spam (using randomness as a cheap throttle)
                  if (Math.random() < 0.05) {
                      particlesRef.current.push({
                          x: loot.x,
                          y: loot.y,
                          vx: 0, vy: -0.5,
                          life: 40, maxLife: 40,
                          color: '#ef4444',
                          size: 0,
                          text: 'CARGO FULL'
                      });
                  }
              }
          }
      });
      lootRef.current = lootRef.current.filter(l => l.life > 0);

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

      // 0. Draw Deep Background (Nebulas)
      nebulasRef.current.forEach(neb => {
        // Deepest parallax
        const px = neb.x + (cameraRef.current.x * neb.depth);
        const py = neb.y + (cameraRef.current.y * neb.depth);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, neb.size);
        gradient.addColorStop(0, neb.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, neb.size, 0, Math.PI*2);
        ctx.fill();
      });

      // 0.5 Draw Distant Galaxies
      galaxiesRef.current.forEach(gal => {
        const px = gal.x + (cameraRef.current.x * gal.depth);
        const py = gal.y + (cameraRef.current.y * gal.depth);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(gal.rotation);
        ctx.strokeStyle = gal.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3; // Faint

        // Draw simple wireframe spirals
        for(let arm = 0; arm < 2; arm++) {
          ctx.rotate(Math.PI); // Rotate 180 for next arm
          ctx.beginPath();
          for(let t = 0; t < 20; t++) {
            const r = t * (gal.size / 20);
            const theta = t * 0.5;
            const lx = r * Math.cos(theta);
            const ly = r * Math.sin(theta);
            if (t===0) ctx.moveTo(lx, ly);
            else ctx.lineTo(lx, ly);
          }
          ctx.stroke();
        }
        
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      // 1. Draw Stars (Parallax)
      starsRef.current.forEach(star => {
          // Parallax: Move stars based on depth
          const factor = (1 - star.depth); // how much it follows camera. 0 = locked to world.
          const px = star.x + (cameraRef.current.x * factor);
          const py = star.y + (cameraRef.current.y * factor);
          
          ctx.globalAlpha = Math.random() * 0.5 + 0.3;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, star.size, 0, Math.PI*2);
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

          // Health Bar
          if (ast.health < ast.maxHealth) {
              const barW = 30;
              const barH = 4;
              const barX = ast.x - barW / 2;
              const barY = ast.y - ast.radius - 12;

              // Reset shadows for clean UI, save/restore to not affect next loop
              ctx.save(); 
              ctx.shadowBlur = 0;
              
              // Background
              ctx.fillStyle = '#000000';
              ctx.fillRect(barX, barY, barW, barH);
              
              // Fill
              const pct = Math.max(0, ast.health / ast.maxHealth);
              ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#22c55e';
              ctx.fillRect(barX, barY, barW * pct, barH);

              // Border
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(barX, barY, barW, barH);
              ctx.restore();
          }

          ast.isHeating = false; // Reset flag
      });
      
      // Draw Loot
      lootRef.current.forEach(loot => {
          const color = MINERAL_COLORS[loot.type];
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          
          // Draw Element Shape
          ctx.save();
          ctx.translate(loot.x, loot.y);
          
          // Shape based on type for visual variety
          ctx.beginPath();
          if (loot.type === MineralType.IRON) {
              // Square
              ctx.fillRect(-4, -4, 8, 8);
          } else if (loot.type === MineralType.SILICON) {
              // Triangle
              ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.fill();
          } else if (loot.type === MineralType.GOLD) {
              // Diamond
              ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.fill();
          } else {
              // Hexagon (Kronos)
              for(let i=0; i<6; i++) {
                  const ang = i * Math.PI/3;
                  const lx = Math.cos(ang)*5;
                  const ly = Math.sin(ang)*5;
                  if (i===0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
              }
              ctx.fill();
          }
          
          // Text Label
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${loot.type} [${loot.amount}]`, 0, -12);
          
          ctx.restore();
      });

      // Draw Particles
      particlesRef.current.forEach((p, i) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          
          if (p.text) {
              // Text Particle (Floating Text)
              ctx.font = '12px monospace';
              ctx.textAlign = 'center';
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 2;
              ctx.fillText(p.text, p.x, p.y);
              ctx.shadowBlur = 0;
          } else {
              // Standard Shape Particle
              ctx.fillRect(p.x, p.y, p.size, p.size);
          }
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      ctx.globalAlpha = 1.0;


      // Draw Mining Laser
      if (miningTarget) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00ffff';
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2 + Math.random() * 2;
          
          // Laser start point (Nose of ship)
          const noseOffset = 30;
          const lx = ship.position.x + Math.cos(ship.rotation) * noseOffset;
          const ly = ship.position.y + Math.sin(ship.rotation) * noseOffset;

          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(miningTarget.x, miningTarget.y);
          ctx.stroke();
          
          // Source flare
          ctx.beginPath();
          ctx.arc(lx, ly, 5, 0, Math.PI*2);
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
      
      // --- Retro Rocket Design ---
      
      // 1. Main Body (Elongated Cylinder)
      ctx.beginPath();
      // Top edge
      ctx.moveTo(-10, -6);
      ctx.lineTo(10, -6);
      // Bottom edge
      ctx.moveTo(-10, 6);
      ctx.lineTo(10, 6);
      ctx.stroke();
      
      // 2. Nose Cone (Pointy, delineated)
      ctx.beginPath();
      ctx.moveTo(10, -6);
      // Curve to a sharp point
      ctx.quadraticCurveTo(25, 0, 30, 0);
      ctx.quadraticCurveTo(25, 0, 10, 6);
      // Delineation line
      ctx.moveTo(10, -6);
      ctx.lineTo(10, 6);
      ctx.stroke();
      
      // 3. Aft Section / Thrust Cone
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(-20, -10); // Flared bell top
      ctx.lineTo(-20, 10);  // Flared bell bottom
      ctx.lineTo(-10, 6);
      // Delineation line
      ctx.moveTo(-10, -6);
      ctx.lineTo(-10, 6);
      // Engine grating/detail
      ctx.moveTo(-20, -10);
      ctx.lineTo(-20, 10);
      ctx.stroke();

      // 4. Fins (Swept back wings)
      ctx.beginPath();
      // Top Wing
      ctx.moveTo(-5, -6);
      ctx.lineTo(-15, -18); // Wing tip
      ctx.lineTo(-5, -10); // Trailing edge connection? Or just back to body
      ctx.lineTo(0, -6);
      // Bottom Wing
      ctx.moveTo(-5, 6);
      ctx.lineTo(-15, 18);
      ctx.lineTo(-5, 10);
      ctx.lineTo(0, 6);
      ctx.stroke();
      
      // 5. Portholes (Little circles)
      ctx.fillStyle = '#000'; // Mask background
      // Center porthole
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // Front porthole
      ctx.beginPath(); ctx.arc(6, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // Rear porthole
      ctx.beginPath(); ctx.arc(-6, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      
      // Add "Glass" glow to portholes
      ctx.fillStyle = '#aaffaa';
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 0, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, 0, 1, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;

      // Engine flare (if thrusting)
      if (isThrusting) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          // Main jet
          ctx.moveTo(-22, 0); // Start inside bell
          ctx.lineTo(-45 - Math.random()*15, 0);
          
          // Side jets
          ctx.moveTo(-21, -4);
          ctx.lineTo(-35 - Math.random()*10, -6);
          ctx.moveTo(-21, 4);
          ctx.lineTo(-35 - Math.random()*10, 6);
          
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

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, onDock, onGameOver, dimensions]); // Added dimensions to dependency

  return (
    <canvas 
      ref={canvasRef} 
      width={dimensions.width} 
      height={dimensions.height} 
      className="block bg-black cursor-crosshair"
    />
  );
};
