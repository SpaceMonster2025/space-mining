export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  DOCKED = 'DOCKED',
  GAMEOVER = 'GAMEOVER'
}

export enum MineralType {
  IRON = 'Iron',
  SILICON = 'Silicon',
  GOLD = 'Gold',
  KRONOS = 'Kronos Crystal'
}

export interface Point {
  x: number;
  y: number;
}

export interface Asteroid {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  vertices: Point[]; // For the jagged vector look
  type: MineralType;
  health: number;
  maxHealth: number;
  rotation: number;
  rotationSpeed: number;
  isHeating: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ShipConfig {
  maxFuel: number;
  fuelConsumptionRate: number; // Per frame idle
  thrustConsumptionRate: number; // Per frame thrusting
  maxCargo: number;
  acceleration: number;
  maxSpeed: number;
  rotationSpeed: number;
  miningPower: number;
  miningRange: number;
}

export interface PlayerState {
  credits: number;
  currentFuel: number;
  cargo: { [key in MineralType]: number };
  shipConfig: ShipConfig;
  position: Point;
  velocity: Point;
  rotation: number; // Radians
}

export interface UpgradeCost {
  level: number;
  cost: number;
  value: number; // The actual stat value
}
