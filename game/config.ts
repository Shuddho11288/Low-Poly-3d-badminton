import * as THREE from 'three';

// --- Types ---

export enum GameState {
  MENU,
  PLAYING,
  POINT_END,
  MATCH_END,
  PAUSED
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
  EXPERT = 'Expert'
}

export enum ShotType {
  NORMAL,
  SMASH,
  LOB,
  DROP
}

export interface GameConfig {
  targetScore: number;
  difficulty: Difficulty;
  isSmashMode: boolean;
}

export interface ScoreState {
  player: number;
  opponent: number;
  server: 'player' | 'opponent';
}

// --- Constants ---

// Dimensions
export const COURT_WIDTH = 900; 
export const COURT_LENGTH = 2800; 
export const NET_HEIGHT = 160; 

// Physics - Matrix / Moon Mode
// Extremely low gravity allows long hang time without high vertical speed
export const GRAVITY = 9.8 * 0.009; 
// Very low drag allows it to travel the full 2800 length at slow speeds
export const DRAG_AIR = 0.994; 
export const SHUTTLE_RADIUS = 15;

// Movement Limits
export const BOUNDARY_X = COURT_WIDTH / 2 + 100;
export const BOUNDARY_Z_BACK = COURT_LENGTH / 2 + 300;
export const BOUNDARY_Z_NET = 80;

// Colors
export const COLOR_COURT = 0x2e8b57;
export const COLOR_COURT_OUT = 0x1f6b3d;
export const COLOR_LINES = 0xffffff;
export const COLOR_NET = 0xeeeeee;
export const COLOR_SKIN = 0xffdbac;
export const COLOR_SHIRT_P1 = 0x3b82f6; 
export const COLOR_SHIRT_CPU = 0xef4444; 
export const COLOR_SHORTS = 0x111111;

// Camera 
export const CAM_OFFSET_X = 0;
export const CAM_OFFSET_Y = 800;
export const CAM_OFFSET_Z = 1400;

// Physics Logic
export const SMASH_POWER_MULT = 1.4; // Reduced multiplier
export const HIT_REACH_XZ = 350; // Increased reach
export const HIT_REACH_Y_MAX = 550; 

export const GROUND_Y = 0;

export const KEYS = {
  W: 'w',
  A: 'a',
  S: 's',
  D: 'd',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SPACE: ' '
};