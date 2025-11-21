
import React, { useRef, useEffect, useState } from 'react';
import { GameState, PlayerState, Asteroid, Point, MineralType, Particle, Loot, Alien } from '../types';
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
  LOOT_DESPAWN_TIME,
  ALIEN_CONFIG
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
  const alienRef = useRef<Alien | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number, y: number, isDown: boolean }>({ x: 0, y: 0, isDown: false });
  const particlesRef = useRef<Particle[]>([]);
  const lootRef = useRef<Loot[]>([]);
  const shakeRef = useRef(0); // Screen shake intensity
  
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
    alienRef.current = null;
    shakeRef.current = 0;
    
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
      soundManagerRef.current?.stopAlienHum();
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
      
      // Shake Decay
      if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
      }

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
              soundManagerRef.current?.stopAlienHum();
              onGameOver();
              return; // Stop loop
          }
      }

      // Camera Follow
      cameraRef.current.x = ship.position.x - width / 2;
      cameraRef.current.y = ship.position.y - height / 2;

      // --- Alien Logic ---
      // Spawn Alien
      if (!alienRef.current) {
          if (Math.random() < ALIEN_CONFIG.SPAWN_RATE) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.max(width, height) * 1.2; // Spawn outside view
              alienRef.current = {
                  id: `alien-${Date.now()}`,
                  x: ship.position.x + Math.cos(angle) * dist,
                  y: ship.position.y + Math.sin(angle) * dist,
                  vx: 0, vy: 0,
                  hp: ALIEN_CONFIG.HP,
                  maxHp: ALIEN_CONFIG.HP,
                  stolenCargo: {},
                  state: 'CHASING',
                  drainTimer: 0,
                  wobbleAngle: 0
              };
              soundManagerRef.current?.startAlienHum();
          }
      }

      // Update Alien
      if (alienRef.current) {
          const alien = alienRef.current;
          const dx = ship.position.x - alien.x;
          const dy = ship.position.y - alien.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          alien.wobbleAngle += 0.1;

          // AI Movement
          if (dist > ALIEN_CONFIG.DRAIN_RANGE * 0.7) {
              // Chase
              const angle = Math.atan2(dy, dx);
              alien.vx += Math.cos(angle) * 0.1;
              alien.vy += Math.sin(angle) * 0.1;
              alien.state = 'CHASING';
          } else {
              // Brake/Hover
              alien.vx *= 0.95;
              alien.vy *= 0.95;
              alien.state = 'DRAINING';
          }

          // Speed Cap
          const alienSpeed = Math.sqrt(alien.vx**2 + alien.vy**2);
          if (alienSpeed > ALIEN_CONFIG.SPEED) {
              alien.vx = (alien.vx / alienSpeed) * ALIEN_CONFIG.SPEED;
              alien.vy = (alien.vy / alienSpeed) * ALIEN_CONFIG.SPEED;
          }

          alien.x += alien.vx;
          alien.y += alien.vy;

          // Vampiric Drain
          if (alien.state === 'DRAINING' && dist < ALIEN_CONFIG.DRAIN_RANGE) {
              alien.drainTimer++;
              if (alien.drainTimer >= ALIEN_CONFIG.DRAIN_INTERVAL) {
                  // Steal Cargo
                  const availableTypes = (Object.keys(ship.cargo) as MineralType[])
                      .filter(t => ship.cargo[t] > 0);
                  
                  if (availableTypes.length > 0) {
                      const typeToSteal = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                      
                      // Transfer
                      ship.cargo[typeToSteal]--;
                      alien.stolenCargo[typeToSteal] = (alien.stolenCargo[typeToSteal] || 0) + 1;
                      
                      soundManagerRef.current?.playAlienZap();
                      
                      // Visual text on ship
                      particlesRef.current.push({
                          x: ship.position.x,
                          y: ship.position.y - 20,
                          vx: 0, vy: -1,
                          life: 60, maxLife: 60,
                          color: '#ef4444', // Red
                          size: 0,
                          text: `-1 ${typeToSteal}`
                      });
                  }
                  alien.drainTimer = 0;
              }
          }
      } else {
        soundManagerRef.current?.stopAlienHum();
      }


      // Mining & Combat Logic
      let miningTarget: Asteroid | null = null;
      let attackingAlien = false;

      const worldMouseX = mouseRef.current.x + cameraRef.current.x;
      const worldMouseY = mouseRef.current.y + cameraRef.current.y;

      if (mouseRef.current.isDown && ship.currentFuel > 0) {
          const noseOffset = 30;
          const lx = ship.position.x + Math.cos(ship.rotation) * noseOffset;
          const ly = ship.position.y + Math.sin(ship.rotation) * noseOffset;

          // 1. Check Alien Hit
          if (alienRef.current) {
              const alien = alienRef.current;
              // Simple Line to Circle collision check
              // Vector from laser start to alien center
              const ax = alien.x - lx;
              const ay = alien.y - ly;
              const alienDist = Math.sqrt(ax*ax + ay*ay);
              
              // Check if mouse is roughly over alien (aim assist)
              const mouseDx = worldMouseX - alien.x;
              const mouseDy = worldMouseY - alien.y;
              const mouseDist = Math.sqrt(mouseDx*mouseDx + mouseDy*mouseDy);

              if (mouseDist < 50 && alienDist < ship.shipConfig.miningRange) {
                  attackingAlien = true;
                  alien.hp -= ship.shipConfig.miningPower;
                  ship.currentFuel -= ship.shipConfig.thrustConsumptionRate * 0.5;
                  
                  soundManagerRef.current?.startLaser();
                  shakeRef.current = Math.max(shakeRef.current, 2);

                   // Hit particles
                   if (Math.random() > 0.5) {
                    particlesRef.current.push({
                        x: alien.x + (Math.random()-0.5)*30,
                        y: alien.y + (Math.random()-0.5)*30,
                        vx: (Math.random()-0.5)*5,
                        vy: (Math.random()-0.5)*5,
                        life: 20,
                        maxLife: 20,
                        color: ALIEN_CONFIG.COLOR_LIGHTS,
                        size: 2
                    });
                  }

                  if (alien.hp <= 0) {
                      // Alien Destroyed
                      soundManagerRef.current?.playExplosion();
                      soundManagerRef.current?.stopAlienHum();
                      shakeRef.current = 20;

                      // Drop stolen cargo
                      Object.keys(alien.stolenCargo).forEach(key => {
                          const type = key as MineralType;
                          const amount = alien.stolenCargo[type] || 0;
                          if (amount > 0) {
                              lootRef.current.push({
                                  id: `loot-alien-${Date.now()}-${type}`,
                                  x: alien.x,
                                  y: alien.y,
                                  vx: (Math.random() - 0.5) * 3,
                                  vy: (Math.random() - 0.5) * 3,
                                  type: type,
                                  amount: amount,
                                  life: LOOT_DESPAWN_TIME
                              });
                          }
                      });

                      // Explosion Particles
                      for(let k=0; k<30; k++) {
                        particlesRef.current.push({
                          x: alien.x,
                          y: alien.y,
                          vx: (Math.random()-0.5)*8,
                          vy: (Math.random()-0.5)*8,
                          life: 40 + Math.random() * 30,
                          maxLife: 70,
                          color: Math.random() > 0.5 ? ALIEN_CONFIG.COLOR_BODY : ALIEN_CONFIG.COLOR_LIGHTS,
                          size: 2 + Math.random() * 3
                        });
                      }

                      alienRef.current = null;
                  }
              }
          }

          // 2. Check Asteroids if not attacking alien
          if (!attackingAlien) {
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
      }

      // Logic for Asteroid Mining (Copied/Refined from previous)
      if (miningTarget) {
          miningTarget.isHeating = true;
          miningTarget.health -= ship.shipConfig.miningPower;
          ship.currentFuel -= ship.shipConfig.thrustConsumptionRate * 0.5;
          soundManagerRef.current?.startLaser();
          shakeRef.current = Math.max(shakeRef.current, 2);

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
              soundManagerRef.current?.playExplosion();
              shakeRef.current = 15;
              const lootAmount = Math.floor(miningTarget.radius / 5); 
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
              // Shatter effects...
              for(let k=0; k<8; k++) {
                  particlesRef.current.push({
                    x: miningTarget.x + (Math.random()-0.5) * miningTarget.radius * 0.5,
                    y: miningTarget.y + (Math.random()-0.5) * miningTarget.radius * 0.5,
                    vx: (Math.random()-0.5)*3,
                    vy: (Math.random()-0.5)*3,
                    life: 60 + Math.random() * 40,
                    maxLife: 100,
                    color: MINERAL_COLORS[miningTarget.type],
                    size: 3 + Math.random() * 4 
                  });
              }
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
            asteroidsRef.current = asteroidsRef.current.filter(a => a !== miningTarget);
          }
      } 
      
      if (!miningTarget && !attackingAlien) {
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
          if (speed < 0.5) {
              onDock(ship);
              return;
          }
      }


      // --- Rendering ---
      
      // Clear Screen
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // Apply Shake to Camera
      const shakeX = (Math.random() - 0.5) * shakeRef.current;
      const shakeY = (Math.random() - 0.5) * shakeRef.current;

      ctx.save();
      ctx.translate(-(cameraRef.current.x + shakeX), -(cameraRef.current.y + shakeY));

      // 0. Draw Deep Background (Nebulas)
      nebulasRef.current.forEach(neb => {
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
        ctx.globalAlpha = 0.3; 
        for(let arm = 0; arm < 2; arm++) {
          ctx.rotate(Math.PI); 
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

      // 1. Draw Stars
      starsRef.current.forEach(star => {
          const factor = (1 - star.depth);
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
              ctx.save(); 
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#000000';
              ctx.fillRect(barX, barY, barW, barH);
              const pct = Math.max(0, ast.health / ast.maxHealth);
              ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#22c55e';
              ctx.fillRect(barX, barY, barW * pct, barH);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(barX, barY, barW, barH);
              ctx.restore();
          }
          ast.isHeating = false; 
      });

      // Draw Alien
      if (alienRef.current) {
          const alien = alienRef.current;
          ctx.save();
          ctx.translate(alien.x, alien.y + Math.sin(alien.wobbleAngle)*5);
          
          // Lightning Effect
          if (alien.state === 'DRAINING' && Math.random() > 0.2) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              // Jagged line to ship
              const dx = ship.position.x - alien.x;
              const dy = ship.position.y - alien.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const segments = 5;
              for(let i=1; i<=segments; i++) {
                  const t = i/segments;
                  const jx = dx*t + (Math.random()-0.5)*20;
                  const jy = dy*t + (Math.random()-0.5)*20;
                  ctx.lineTo(jx, jy);
              }
              ctx.shadowColor = ALIEN_CONFIG.COLOR_LIGHTS;
              ctx.shadowBlur = 10;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
          }

          // Body
          ctx.shadowBlur = 15;
          ctx.shadowColor = ALIEN_CONFIG.COLOR_BODY;
          ctx.fillStyle = '#000000';
          ctx.strokeStyle = ALIEN_CONFIG.COLOR_BODY;
          ctx.lineWidth = 2;

          // Dome
          ctx.beginPath();
          ctx.arc(0, -5, 15, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = ALIEN_CONFIG.COLOR_BODY;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Saucer Ring
          ctx.beginPath();
          ctx.ellipse(0, 5, 30, 10, 0, 0, Math.PI*2);
          ctx.stroke();
          ctx.fillStyle = '#000';
          ctx.fill();

          // Lights
          const lights = 5;
          ctx.fillStyle = ALIEN_CONFIG.COLOR_LIGHTS;
          ctx.shadowColor = ALIEN_CONFIG.COLOR_LIGHTS;
          for(let i=0; i<lights; i++) {
              const la = (i/lights) * Math.PI * 2 + alien.wobbleAngle;
              const lx = Math.cos(la) * 25;
              const ly = Math.sin(la) * 8 + 5;
              ctx.beginPath();
              ctx.arc(lx, ly, 2, 0, Math.PI*2);
              ctx.fill();
          }

          // Alien HP Bar
          if (alien.hp < alien.maxHp) {
            const barW = 40;
            const barH = 4;
            const barX = -20;
            const barY = -30;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000000';
            ctx.fillRect(barX, barY, barW, barH);
            const pct = Math.max(0, alien.hp / alien.maxHp);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(barX, barY, barW * pct, barH);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
          }
          
          ctx.restore();
      }

      // Draw Loot
      lootRef.current.forEach(loot => {
          const color = MINERAL_COLORS[loot.type];
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.save();
          ctx.translate(loot.x, loot.y);
          ctx.beginPath();
          if (loot.type === MineralType.IRON) {
              ctx.fillRect(-4, -4, 8, 8);
          } else if (loot.type === MineralType.SILICON) {
              ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.fill();
          } else if (loot.type === MineralType.GOLD) {
              ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.fill();
          } else {
              for(let i=0; i<6; i++) {
                  const ang = i * Math.PI/3;
                  const lx = Math.cos(ang)*5;
                  const ly = Math.sin(ang)*5;
                  if (i===0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
              }
              ctx.fill();
          }
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
              ctx.font = '12px monospace';
              ctx.textAlign = 'center';
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 2;
              ctx.fillText(p.text, p.x, p.y);
              ctx.shadowBlur = 0;
          } else {
              ctx.fillRect(p.x, p.y, p.size, p.size);
          }
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      ctx.globalAlpha = 1.0;

      // Draw Mining Laser (Player)
      if (miningTarget || attackingAlien) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00ffff';
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2 + Math.random() * 2;
          
          const noseOffset = 30;
          const lx = ship.position.x + Math.cos(ship.rotation) * noseOffset;
          const ly = ship.position.y + Math.sin(ship.rotation) * noseOffset;

          const targetX = miningTarget ? miningTarget.x : (alienRef.current?.x || 0);
          const targetY = miningTarget ? miningTarget.y : (alienRef.current?.y || 0);

          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();
          
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
      ctx.strokeStyle = '#ffffff'; 
      ctx.lineWidth = 2;
      
      // Ship Body
      ctx.beginPath();
      ctx.moveTo(-10, -6); ctx.lineTo(10, -6);
      ctx.moveTo(-10, 6); ctx.lineTo(10, 6);
      ctx.stroke();
      
      // Nose
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.quadraticCurveTo(25, 0, 30, 0);
      ctx.quadraticCurveTo(25, 0, 10, 6);
      ctx.moveTo(10, -6); ctx.lineTo(10, 6);
      ctx.stroke();
      
      // Engine
      ctx.beginPath();
      ctx.moveTo(-10, -6); ctx.lineTo(-20, -10); ctx.lineTo(-20, 10); ctx.lineTo(-10, 6);
      ctx.moveTo(-10, -6); ctx.lineTo(-10, 6);
      ctx.moveTo(-20, -10); ctx.lineTo(-20, 10);
      ctx.stroke();

      // Fins
      ctx.beginPath();
      ctx.moveTo(-5, -6); ctx.lineTo(-15, -18); ctx.lineTo(-5, -10); ctx.lineTo(0, -6);
      ctx.moveTo(-5, 6); ctx.lineTo(-15, 18); ctx.lineTo(-5, 10); ctx.lineTo(0, 6);
      ctx.stroke();
      
      // Portholes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-6, 0, 2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#aaffaa'; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 0, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, 0, 1, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1.0;

      // Engine Exhaust
      if (isThrusting) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(-22, 0); ctx.lineTo(-45 - Math.random()*15, 0);
          ctx.moveTo(-21, -4); ctx.lineTo(-35 - Math.random()*10, -6);
          ctx.moveTo(-21, 4); ctx.lineTo(-35 - Math.random()*10, 6);
          ctx.stroke();
      }
      ctx.restore();


      // --- HUD ---
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
      const radarScale = radarSize / 2000;
      asteroidsRef.current.forEach(ast => {
          const dx = ast.x - ship.position.x;
          const dy = ast.y - ship.position.y;
          if (dx*dx + dy*dy < (2000*2000)) {
              const rx = radarX + dx * radarScale;
              const ry = radarY + dy * radarScale;
              const dist = Math.sqrt((rx-radarX)**2 + (ry-radarY)**2);
              if (dist < radarSize) {
                  ctx.fillStyle = MINERAL_COLORS[ast.type];
                  ctx.fillRect(rx-1, ry-1, 2, 2);
              }
          }
      });
      // Alien Blip
      if (alienRef.current) {
          const dx = alienRef.current.x - ship.position.x;
          const dy = alienRef.current.y - ship.position.y;
          if (dx*dx + dy*dy < (2000*2000)) {
              const rx = radarX + dx * radarScale;
              const ry = radarY + dy * radarScale;
              const dist = Math.sqrt((rx-radarX)**2 + (ry-radarY)**2);
              if (dist < radarSize) {
                  ctx.fillStyle = '#a855f7'; // Purple blip
                  ctx.fillRect(rx-2, ry-2, 4, 4);
              }
          }
      }

      // Station/Player Blip
      const stationDx = STATION_POSITION.x - ship.position.x;
      const stationDy = STATION_POSITION.y - ship.position.y;
      const sRx = radarX + stationDx * radarScale;
      const sRy = radarY + stationDy * radarScale;
      if (Math.sqrt((sRx-radarX)**2 + (sRy-radarY)**2) < radarSize) {
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(sRx-3, sRy-3, 6, 6);
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(radarX-1, radarY-1, 3, 3);

      // Gauges
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
      
      const currentCargo = Object.values(ship.cargo).reduce((a,b) => a+b, 0);
      ctx.fillText(`CARGO: ${Math.floor(currentCargo)} / ${ship.shipConfig.maxCargo}`, 20, height - 70);

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
  }, [gameState, onDock, onGameOver, dimensions]); 

  return (
    <canvas 
      ref={canvasRef} 
      width={dimensions.width} 
      height={dimensions.height} 
      className="block bg-black cursor-crosshair"
    />
  );
};