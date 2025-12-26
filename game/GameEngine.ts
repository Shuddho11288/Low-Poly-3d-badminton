import * as THREE from 'three';
import { 
  GameState, ScoreState, GameConfig, Difficulty, ShotType,
  COURT_LENGTH, COURT_WIDTH, NET_HEIGHT, CAM_OFFSET_X, CAM_OFFSET_Y, CAM_OFFSET_Z,
  HIT_REACH_XZ, HIT_REACH_Y_MAX, SMASH_POWER_MULT, KEYS, SHUTTLE_RADIUS, GRAVITY, DRAG_AIR,
  BOUNDARY_X, BOUNDARY_Z_BACK, BOUNDARY_Z_NET
} from './config';
import { Court, Character, Shuttle, WorldEnvironment, LandingMarker } from './entities';
import { soundManager } from './SoundManager';

export class GameEngine {
  // Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private animationId: number = 0;
  private clock: THREE.Clock;
  private resizeObserver: ResizeObserver;

  // Game Objects
  private court: Court;
  private player: Character;
  private opponent: Character;
  private shuttle: Shuttle;
  private environment: WorldEnvironment;
  private landingMarker: LandingMarker;
  
  // Visual Helpers
  private dragGuideLine: THREE.Line;
  
  // Game State
  public state: GameState = GameState.MENU;
  public score: ScoreState = { player: 0, opponent: 0, server: 'player' };
  public config: GameConfig = { targetScore: 5, difficulty: Difficulty.MEDIUM, isSmashMode: false };
  public isWaitingForServe: boolean = false;
  
  // Input
  private keysPressed: {[key: string]: boolean} = {};
  private dragStart: {x: number, y: number} | null = null;
  private currentMouse: {x: number, y: number} | null = null;
  
  // Mobile Input
  public joystickMove: {x: number, y: number} = {x: 0, y: 0};

  // Callbacks
  private onScoreUpdate: (score: ScoreState) => void;
  private onStateChange: (state: GameState) => void;

  constructor(
    container: HTMLElement, 
    onScoreUpdate: (s: ScoreState) => void,
    onStateChange: (s: GameState) => void
  ) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onStateChange = onStateChange;

    // Safety check for dimensions to prevent 0-size canvas or Infinity aspect ratio
    let width = container.clientWidth;
    let height = container.clientHeight;
    
    // Fallback to window size if container is not yet measured (common in prod)
    if (width === 0) width = window.innerWidth;
    if (height === 0) height = window.innerHeight;

    // Init Three
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 4000, 10000);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 10, 10000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Set a background color just in case environment fails
    this.renderer.setClearColor(0x87CEEB); 
    container.appendChild(this.renderer.domElement);

    // Setup ResizeObserver for robust layout handling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.clock = new THREE.Clock();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -2000;
    dirLight.shadow.camera.right = 2000;
    dirLight.shadow.camera.top = 2000;
    dirLight.shadow.camera.bottom = -2000;
    this.scene.add(dirLight);

    // Environment
    this.environment = new WorldEnvironment();
    this.scene.add(this.environment.mesh);

    // Objects
    this.court = new Court();
    this.scene.add(this.court.mesh);

    this.player = new Character(true, 0x3b82f6);
    this.player.position.set(0, 0, COURT_LENGTH/2 - 200);
    this.scene.add(this.player.mesh);

    this.opponent = new Character(false, 0xef4444);
    this.opponent.position.set(0, 0, -COURT_LENGTH/2 + 200);
    this.opponent.mesh.rotation.y = Math.PI; // Face player
    this.scene.add(this.opponent.mesh);

    this.shuttle = new Shuttle();
    this.scene.add(this.shuttle.mesh);
    this.scene.add(this.shuttle.getShadowMesh());
    this.scene.add(this.shuttle.getTrailMesh());

    this.landingMarker = new LandingMarker();
    this.scene.add(this.landingMarker.mesh);

    // Drag Guide
    const guideGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,50)]);
    const guideMat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });
    this.dragGuideLine = new THREE.Line(guideGeom, guideMat);
    this.dragGuideLine.visible = false;
    this.scene.add(this.dragGuideLine);

    this.setupInputs();
    this.resetRound();
    
    // Initial Camera
    this.updateCamera();

    // Start Loop
    this.animate();
  }

  private handleResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Ignore invalid sizes
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => this.keysPressed[e.key] = true);
    window.addEventListener('keyup', (e) => this.keysPressed[e.key] = false);
    
    // Mouse Drag for Shot
    const onDown = (x: number, y: number) => {
      if (this.state !== GameState.PLAYING) return;
      this.dragStart = {x, y};
      this.currentMouse = {x, y};
    };
    
    const onMove = (x: number, y: number) => {
        if (this.dragStart) {
            this.currentMouse = {x, y};
        }
    };
    
    const onUp = (x: number, y: number) => {
      if (!this.dragStart || this.state !== GameState.PLAYING) return;
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      
      this.attemptHit(dx, dy);
      this.dragStart = null;
      this.currentMouse = null;
      this.dragGuideLine.visible = false;
    };

    this.container.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => onUp(e.clientX, e.clientY));

    this.container.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onDown(t.clientX, t.clientY);
    });
    window.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
    });
    window.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        onUp(t.clientX, t.clientY);
    });
  }

  private resetRound() {
    this.shuttle.inPlay = true;
    this.shuttle.velocity.set(0, 0, 0);
    this.isWaitingForServe = true; // Hold phase

    // Reset Positions (Back of court)
    this.player.position.set(0, 0, COURT_LENGTH/2 - 200);
    this.opponent.position.set(0, 0, -COURT_LENGTH/2 + 200);
    this.player.velocity.set(0,0,0);
    this.opponent.velocity.set(0,0,0);

    // Initial Shuttle Position (Hovering)
    this.updateShuttleServePos();
    this.landingMarker.setVisible(false);

    // If opponent serves, trigger it after delay
    if (this.score.server === 'opponent') {
       setTimeout(() => this.opponentServe(), 1500);
    }
  }

  private updateShuttleServePos() {
      if (!this.isWaitingForServe) return;

      if (this.score.server === 'player') {
          // Hover in front of player
          this.shuttle.position.copy(this.player.position);
          this.shuttle.position.y += 100; // Waist height roughly
          this.shuttle.position.z -= 40; // Slightly in front
          this.shuttle.velocity.set(0,0,0);
      } else {
          // Hover in front of opponent
          this.shuttle.position.copy(this.opponent.position);
          this.shuttle.position.y += 100;
          this.shuttle.position.z += 40;
          this.shuttle.velocity.set(0,0,0);
      }
  }

  private opponentServe() {
    if (this.state !== GameState.PLAYING || this.score.server !== 'opponent' || !this.isWaitingForServe) return;
    
    // Release serve
    this.isWaitingForServe = false;
    this.performHit(this.opponent, new THREE.Vector3(0, 9, 14), false);
  }

  // Calculate shot properties from drag vector, returns velocity vector
  private calculateShotVector(dx: number, dy: number): THREE.Vector3 {
      const dragLen = Math.sqrt(dx*dx + dy*dy);
      // Reduce power caps for low gravity
      let power = Math.min(dragLen / 4.5, 38); 
      if (power < 10) power = 10; // Min power

      // Normalized drag vector in screen space
      // -dy is forward (screen up)
      const forward = -dy; 
      const right = dx;
      
      const shotDir = new THREE.Vector3(right * 0.15, 0, forward * 0.15).normalize();
      
      const finalVel = new THREE.Vector3(shotDir.x, 0, -1).normalize(); 
      finalVel.x += shotDir.x * 0.6; // Influence horizontal aim

      // Arc calc
      let isSmash = this.config.isSmashMode;
      
      // Can only smash if high enough
      if (this.shuttle.position.y < 180) isSmash = false;
      // Serve is never a smash
      if (this.isWaitingForServe) isSmash = false;

      if (isSmash) {
        finalVel.y = -0.25; 
        finalVel.multiplyScalar(power * SMASH_POWER_MULT);
      } else {
        // Flat arc for low gravity long range
        finalVel.y = 0.55 + (power / 90); 
        finalVel.multiplyScalar(power * 1.3);
      }
      return finalVel;
  }

  private attemptHit(dx: number, dy: number) {
    // If waiting for serve, ONLY player can trigger it if it's their turn
    if (this.isWaitingForServe) {
        if (this.score.server === 'player') {
            this.isWaitingForServe = false;
            // Serve vector
            const vel = this.calculateShotVector(dx, dy);
            // Ensure serve goes up slightly
            vel.y = Math.abs(vel.y) + 0.2; 
            this.performHit(this.player, vel, false);
        }
        return;
    }

    // Normal Gameplay Hit
    const distXZ = new THREE.Vector2(this.player.position.x, this.player.position.z)
                    .distanceTo(new THREE.Vector2(this.shuttle.position.x, this.shuttle.position.z));
    const distY = Math.abs(this.player.position.y - this.shuttle.position.y);
    const height = this.shuttle.position.y;

    // Hit Window
    if (distXZ < HIT_REACH_XZ && height < HIT_REACH_Y_MAX && height > SHUTTLE_RADIUS) {
        
        let isSmash = false;
        if (this.config.isSmashMode && height > 220 && this.shuttle.position.z > 0) {
            isSmash = true;
        }

        const velocity = this.calculateShotVector(dx, dy);
        this.performHit(this.player, velocity, isSmash);
    } else {
        // Miss swing
        this.player.swing(false);
    }
  }

  private performHit(actor: Character, velocity: THREE.Vector3, isSmash: boolean) {
    actor.swing(isSmash);
    this.shuttle.velocity.copy(velocity);
    soundManager.playHit(isSmash);
  }

  private updatePhysics() {
    const dt = 0.016; 

    this.movePlayer(dt);
    this.moveOpponent(dt);

    // Shuttle Physics
    if (this.isWaitingForServe) {
        this.updateShuttleServePos();
        this.landingMarker.setVisible(false);
    } else {
        this.shuttle.update(dt);
        this.updateLandingPrediction();
    }

    if (this.shuttle.inPlay && !this.isWaitingForServe) {
        const prevZ = this.shuttle.position.z - this.shuttle.velocity.z;
        const currZ = this.shuttle.position.z;
        
        // Net Collision
        if ((prevZ > 0 && currZ <= 0) || (prevZ < 0 && currZ >= 0)) {
            if (this.shuttle.position.y < NET_HEIGHT) {
                this.shuttle.velocity.z *= -0.2; 
                this.shuttle.velocity.x *= 0.5;
                soundManager.playNetHit();
            }
        }
    }

    // Ground Collision Resolution
    if (!this.shuttle.inPlay && this.state === GameState.PLAYING) {
        soundManager.playBounce();
        this.resolvePoint();
    }
  }

  private updateLandingPrediction() {
      if (!this.shuttle.inPlay || this.shuttle.velocity.lengthSq() < 0.1) {
          this.landingMarker.setVisible(false);
          return;
      }

      // Quick simulation
      const simPos = this.shuttle.position.clone();
      const simVel = this.shuttle.velocity.clone();
      
      let landed = false;
      // Simulate up to 600 frames ahead for very floaty physics
      for (let i = 0; i < 600; i++) {
          simVel.y -= GRAVITY;
          simVel.x *= DRAG_AIR;
          simVel.z *= DRAG_AIR;
          simPos.add(simVel);
          
          if (simPos.y <= 0) {
              landed = true;
              break;
          }
      }

      if (landed) {
          this.landingMarker.setPosition(simPos.x, simPos.z);
          this.landingMarker.setVisible(true);
      } else {
          this.landingMarker.setVisible(false);
      }
  }

  private resolvePoint() {
    const s = this.shuttle.position;
    const inBoundsX = s.x > -COURT_WIDTH/2 && s.x < COURT_WIDTH/2;
    const inBoundsZ = s.z > -COURT_LENGTH/2 && s.z < COURT_LENGTH/2;
    const isPlayerSide = s.z > 0;
    
    let playerWin = false;

    // Basic Badminton Rules
    if (isPlayerSide) {
        // Landed on player side
        if (inBoundsX && inBoundsZ) {
            playerWin = false; // Player missed it, it landed in
        } else {
            playerWin = true; // Opponent hit it out
        }
    } else {
        // Landed on opponent side
        if (inBoundsX && inBoundsZ) {
            playerWin = true; // Player hit it in
        } else {
            playerWin = false; // Player hit it out
        }
    }

    if (playerWin) {
        this.score.player++;
        this.score.server = 'player';
        soundManager.playScore(true);
    } else {
        this.score.opponent++;
        this.score.server = 'opponent';
        soundManager.playScore(false);
    }
    
    this.onScoreUpdate({...this.score});

    if (this.score.player >= this.config.targetScore || this.score.opponent >= this.config.targetScore) {
        this.state = GameState.MATCH_END;
        this.onStateChange(GameState.MATCH_END);
    } else {
        this.state = GameState.POINT_END;
        setTimeout(() => {
             if (this.state === GameState.POINT_END) {
                 this.resetRound();
                 this.state = GameState.PLAYING;
             }
        }, 2000);
    }
  }

  private movePlayer(dt: number) {
    let dx = 0;
    let dz = 0;

    if (this.keysPressed[KEYS.W] || this.keysPressed[KEYS.ARROW_UP]) dz -= 1;
    if (this.keysPressed[KEYS.S] || this.keysPressed[KEYS.ARROW_DOWN]) dz += 1;
    if (this.keysPressed[KEYS.A] || this.keysPressed[KEYS.ARROW_LEFT]) dx -= 1;
    if (this.keysPressed[KEYS.D] || this.keysPressed[KEYS.ARROW_RIGHT]) dx += 1;

    if (this.joystickMove.x !== 0 || this.joystickMove.y !== 0) {
        dx = this.joystickMove.x;
        dz = this.joystickMove.y;
    }

    const len = Math.sqrt(dx*dx + dz*dz);
    if (len > 0) {
        dx /= len;
        dz /= len;
    }

    this.player.velocity.set(dx * this.player.speed, 0, dz * this.player.speed);
    
    // Constraints
    const nextX = this.player.position.x + this.player.velocity.x;
    const nextZ = this.player.position.z + this.player.velocity.z;

    // Clamp X (Width boundary)
    if (nextX < -BOUNDARY_X) this.player.velocity.x = 0;
    if (nextX > BOUNDARY_X) this.player.velocity.x = 0;

    // Clamp Z (Player Side: Positive Z)
    if (nextZ < BOUNDARY_Z_NET) this.player.velocity.z = 0; 
    if (nextZ > BOUNDARY_Z_BACK) this.player.velocity.z = 0;
    
    this.player.update(dt);
  }

  private moveOpponent(dt: number) {
    const ballPos = this.shuttle.position;
    const incomingToOpponent = this.shuttle.velocity.z < 0;

    let targetX = 0;
    let targetZ = -COURT_LENGTH/2 + 200; // Default base pos

    if (incomingToOpponent && this.shuttle.position.z < 0 && !this.isWaitingForServe) {
        // Track ball
        targetX = ballPos.x;
        targetZ = ballPos.z - 50; // Try to get behind it
    }

    const diffX = targetX - this.opponent.position.x;
    const diffZ = targetZ - this.opponent.position.z;
    
    let speedFactor = 0.5; 
    if (this.config.difficulty === Difficulty.HARD) speedFactor = 0.8;
    if (this.config.difficulty === Difficulty.EXPERT) speedFactor = 1.0;
    if (this.config.difficulty === Difficulty.EASY) speedFactor = 0.3;

    this.opponent.velocity.set(diffX * speedFactor * 0.1, 0, diffZ * speedFactor * 0.1);
    this.opponent.velocity.clampLength(0, this.opponent.speed);

    // Constraints
    const nextX = this.opponent.position.x + this.opponent.velocity.x;
    const nextZ = this.opponent.position.z + this.opponent.velocity.z;

    if (nextX < -BOUNDARY_X) this.opponent.velocity.x = 0;
    if (nextX > BOUNDARY_X) this.opponent.velocity.x = 0;

    // Clamp Z (Opponent Side: Negative Z)
    if (nextZ > -BOUNDARY_Z_NET) this.opponent.velocity.z = 0;
    if (nextZ < -BOUNDARY_Z_BACK) this.opponent.velocity.z = 0;

    // Look at shuttle
    this.opponent.update(dt, this.shuttle.position); 

    // AI Hit Logic
    if (incomingToOpponent && this.shuttle.inPlay && !this.isWaitingForServe) {
        const distXZ = new THREE.Vector2(this.opponent.position.x, this.opponent.position.z)
                    .distanceTo(new THREE.Vector2(ballPos.x, ballPos.z));
        const height = ballPos.y;

        // If close enough (increased reach for AI too)
        if (distXZ < HIT_REACH_XZ - 20 && height < HIT_REACH_Y_MAX) {
             const tX = (Math.random() - 0.5) * COURT_WIDTH * 0.8;
             const tZ = COURT_LENGTH/3 + (Math.random() * 200);
             
             const dir = new THREE.Vector3(tX - ballPos.x, 0, tZ - ballPos.z).normalize();
             
             const power = 14 + Math.random() * 8;
             const vel = dir.multiplyScalar(power);
             vel.y = 8 + power * 0.25; 

             let smash = false;
             if (this.config.difficulty !== Difficulty.EASY && ballPos.y > 150) {
                if (Math.random() > 0.6) {
                    smash = true;
                    vel.y = -5;
                    vel.multiplyScalar(1.5);
                }
             }

             this.performHit(this.opponent, vel, smash);
        }
    }
  }

  private updateCamera() {
    const idealX = this.player.position.x * 0.2 + CAM_OFFSET_X;
    const idealY = CAM_OFFSET_Y;
    const idealZ = this.player.position.z + CAM_OFFSET_Z;

    this.camera.position.x += (idealX - this.camera.position.x) * 0.1;
    this.camera.position.y += (idealY - this.camera.position.y) * 0.1;
    this.camera.position.z += (idealZ - this.camera.position.z) * 0.1;
    
    this.camera.lookAt(0, 0, -200); // Look slightly ahead
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    if (this.state === GameState.PLAYING || this.state === GameState.POINT_END) {
        this.updatePhysics();
    }
    
    // Visualize Drag Guide
    if (this.dragStart && this.currentMouse && this.state === GameState.PLAYING) {
        const dx = this.currentMouse.x - this.dragStart.x;
        const dy = this.currentMouse.y - this.dragStart.y;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            const shotVel = this.calculateShotVector(dx, dy);
            
            const start = this.player.position.clone();
            start.y += 100;
            // Draw predictive arc (Capped to avoid infinite lines)
            const pts = [];
            const guidePos = start.clone();
            const guideVel = shotVel.clone().multiplyScalar(4); 
            // Reduced iteration count slightly to prevent super long lines
            for(let i=0; i<12; i++) {
                pts.push(guidePos.clone());
                guidePos.add(guideVel);
                guideVel.y -= GRAVITY * 2; 
            }
            
            const positions = new Float32Array(pts.length * 3);
            for(let i=0; i<pts.length; i++) {
                positions[i*3] = pts[i].x;
                positions[i*3+1] = pts[i].y;
                positions[i*3+2] = pts[i].z;
            }
            this.dragGuideLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.dragGuideLine.geometry.setDrawRange(0, pts.length);
            this.dragGuideLine.visible = true;
        } else {
            this.dragGuideLine.visible = false;
        }
    } else {
        this.dragGuideLine.visible = false;
    }
    
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };

  public startGame(config: GameConfig) {
      this.config = config;
      this.score = { player: 0, opponent: 0, server: 'player' };
      this.state = GameState.PLAYING;
      this.onStateChange(GameState.PLAYING);
      soundManager.resume();
      soundManager.playWhistle();
      this.resetRound();
  }

  public pause() {
      if (this.state === GameState.PLAYING) {
          this.state = GameState.PAUSED;
          this.onStateChange(GameState.PAUSED);
      } else if (this.state === GameState.PAUSED) {
          this.state = GameState.PLAYING;
          this.onStateChange(GameState.PLAYING);
      }
  }
  
  public setSmashMode(enabled: boolean) {
      this.config.isSmashMode = enabled;
  }

  public dispose() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}