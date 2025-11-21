
import { MineralType, ShipConfig, UpgradeCost } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const FPS = 60;

export const STATION_POSITION = { x: 0, y: 0 };
export const STATION_RADIUS = 150;
export const DOCKING_RANGE = 200;
export const LOOT_COLLECTION_RANGE = 60;
export const LOOT_DESPAWN_TIME = 1800; // 30 seconds at 60fps

export const INITIAL_SHIP_CONFIG: ShipConfig = {
  maxFuel: 1000,
  fuelConsumptionRate: 0.05,
  thrustConsumptionRate: 0.5,
  maxCargo: 20,
  acceleration: 0.15,
  maxSpeed: 8,
  rotationSpeed: 0.08,
  miningPower: 1.5,
  miningRange: 350,
};

export const ALIEN_CONFIG = {
  SPAWN_RATE: 0.001, // ~Once every 16 seconds roughly
  HP: 300,
  SPEED: 3.0,
  DRAIN_RANGE: 300,
  DRAIN_INTERVAL: 45, // Frames between cargo steals
  COLOR_BODY: '#a855f7', // Purple
  COLOR_LIGHTS: '#22c55e', // Green
};

export const MINERAL_VALUES: Record<MineralType, number> = {
  [MineralType.IRON]: 10,
  [MineralType.SILICON]: 25,
  [MineralType.GOLD]: 100,
  [MineralType.KRONOS]: 500,
};

export const MINERAL_COLORS: Record<MineralType, string> = {
  [MineralType.IRON]: '#a3a3a3', // Grey
  [MineralType.SILICON]: '#60a5fa', // Blue
  [MineralType.GOLD]: '#fbbf24', // Gold
  [MineralType.KRONOS]: '#d946ef', // Magenta
};

export const ASTEROID_SPAWN_RADIUS = 600; // Minimum distance from station to spawn
export const WORLD_BOUNDS = 5000; // +/- 5000 units

// Upgrade multipliers
export const UPGRADE_COST_BASE = 200;
export const UPGRADE_COST_MULTIPLIER = 1.8;