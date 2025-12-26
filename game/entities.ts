import * as THREE from 'three';
import { 
  COURT_LENGTH, COURT_WIDTH, NET_HEIGHT, COLOR_COURT, COLOR_LINES, 
  COLOR_NET, COLOR_SHIRT_P1, COLOR_SKIN, COLOR_SHORTS, SHUTTLE_RADIUS,
  GROUND_Y, GRAVITY, DRAG_AIR
} from './config';

// --- Materials ---
const matCourt = new THREE.MeshLambertMaterial({ color: COLOR_COURT });
const matLine = new THREE.MeshBasicMaterial({ color: COLOR_LINES });
const matNet = new THREE.MeshBasicMaterial({ color: COLOR_NET, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
const matNetTop = new THREE.MeshBasicMaterial({ color: 0xffffff });

const matShuttleCork = new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
const matShuttleSkirt = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
const matShadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });

const matSkin = new THREE.MeshLambertMaterial({ color: COLOR_SKIN });
const matShorts = new THREE.MeshLambertMaterial({ color: COLOR_SHORTS });

// --- Environment (Simple Skybox to avoid Shader Errors) ---
export class WorldEnvironment {
  public mesh: THREE.Group;

  constructor() {
    this.mesh = new THREE.Group();
    this.createSkyDome();
    this.createClouds();
  }

  private createSkyDome() {
    // Simple gradient effect using vertex colors instead of custom shader
    // This is much safer for cross-browser compatibility
    const geometry = new THREE.SphereGeometry(6000, 32, 15);
    // Invert normal so we see inside
    geometry.scale(-1, 1, 1);

    const colors = [];
    const topColor = new THREE.Color(0x0077ff);
    const bottomColor = new THREE.Color(0xffffff);
    
    const posAttribute = geometry.attributes.position;
    
    for (let i = 0; i < posAttribute.count; i++) {
        const y = posAttribute.getY(i);
        // Normalize y somewhat from -radius to +radius
        // Focus gradient on the horizon (y=0 to y=2000)
        let t = (y + 1000) / 4000; 
        t = Math.max(0, Math.min(1, t));
        
        // Non-linear mix for nicer horizon
        t = Math.pow(t, 0.5);

        const color = bottomColor.clone().lerp(topColor, t);
        colors.push(color.r, color.g, color.b);
    }
    
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false
    });

    const sky = new THREE.Mesh(geometry, material);
    this.mesh.add(sky);

    // Sun
    const sunGeom = new THREE.SphereGeometry(150, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sun = new THREE.Mesh(sunGeom, sunMat);
    sun.position.set(800, 2000, -3000);
    this.mesh.add(sun);
    
    // Sun Flare
    const spriteMat = new THREE.SpriteMaterial({ 
        map: this.createGlowTexture(64, 'rgba(255, 200, 0,', 0.5), 
        color: 0xffaa00, 
        transparent: true, 
        blending: THREE.AdditiveBlending 
    });
    const sunSprite = new THREE.Sprite(spriteMat);
    sunSprite.scale.set(1200, 1200, 1.0);
    sun.add(sunSprite);
  }

  private createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        roughness: 0.9, 
        metalness: 0.0,
        transparent: true, 
        opacity: 0.8 
    });
    
    for (let i = 0; i < 20; i++) {
        const cloud = new THREE.Group();
        const chunks = 4 + Math.floor(Math.random() * 5);
        
        for (let j = 0; j < chunks; j++) {
            const size = 120 + Math.random() * 150;
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), cloudMat);
            sphere.position.set(
                (Math.random() - 0.5) * 300,
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 200
            );
            cloud.add(sphere);
        }

        cloud.position.set(
            (Math.random() - 0.5) * 6000,
            1200 + Math.random() * 800,
            -4000 + (Math.random() - 0.5) * 3000
        );
        this.mesh.add(cloud);
    }
  }

  private createGlowTexture(size: number, colorBase: string, opacity: number): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
          grad.addColorStop(0, `${colorBase}${opacity})`);
          grad.addColorStop(1, `${colorBase}0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0,0,size,size);
      }
      return new THREE.CanvasTexture(canvas);
  }
}

// --- Landing Marker ---
export class LandingMarker {
  public mesh: THREE.Group;
  private ring: THREE.Mesh;
  private disc: THREE.Mesh;
  private cylinder: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Group();

    const ringGeom = new THREE.RingGeometry(30, 40, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.ring = new THREE.Mesh(ringGeom, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 2;
    this.mesh.add(this.ring);

    const discGeom = new THREE.CircleGeometry(30, 32);
    const discMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
    this.disc = new THREE.Mesh(discGeom, discMat);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 3;
    this.mesh.add(this.disc);

    const cylGeom = new THREE.CylinderGeometry(30, 30, 150, 32, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    this.cylinder = new THREE.Mesh(cylGeom, cylMat);
    this.cylinder.position.y = 75;
    this.mesh.add(this.cylinder);

    this.setVisible(false);
  }

  public setVisible(visible: boolean) {
    this.mesh.visible = visible;
  }

  public setPosition(x: number, z: number) {
    this.mesh.position.set(x, 0, z);
    const s = 1 + Math.sin(Date.now() / 150) * 0.2;
    this.disc.scale.set(s, s, 1);
    this.ring.scale.set(1, 1, 1);
  }
}

// --- Court ---
export class Court {
  public mesh: THREE.Group;
  public bounds = {
    minX: -COURT_WIDTH / 2,
    maxX: COURT_WIDTH / 2,
    minZ: -COURT_LENGTH / 2,
    maxZ: COURT_LENGTH / 2
  };

  constructor() {
    this.mesh = new THREE.Group();
    this.createFloor();
    this.createNet();
  }

  private createFloor() {
    const geom = new THREE.PlaneGeometry(COURT_WIDTH + 800, COURT_LENGTH + 800);
    geom.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(geom, matCourt);
    floor.receiveShadow = true;
    this.mesh.add(floor);

    const outGeom = new THREE.PlaneGeometry(10000, 10000);
    outGeom.rotateX(-Math.PI / 2);
    const outFloor = new THREE.Mesh(outGeom, new THREE.MeshLambertMaterial({ color: 0x1f6b3d }));
    outFloor.position.y = -1;
    outFloor.receiveShadow = true;
    this.mesh.add(outFloor);

    const points = [];
    const w = COURT_WIDTH / 2;
    const l = COURT_LENGTH / 2;
    const h = 2.0; 
    
    // Outer Boundary
    points.push(
      new THREE.Vector3(-w, h, -l), new THREE.Vector3(w, h, -l),
      new THREE.Vector3(w, h, -l), new THREE.Vector3(w, h, l),
      new THREE.Vector3(w, h, l), new THREE.Vector3(-w, h, l),
      new THREE.Vector3(-w, h, l), new THREE.Vector3(-w, h, -l)
    );

    // Singles Side Lines
    const singlesOffset = 60; 
    points.push(
        new THREE.Vector3(-w + singlesOffset, h, -l), new THREE.Vector3(-w + singlesOffset, h, l),
        new THREE.Vector3(w - singlesOffset, h, -l), new THREE.Vector3(w - singlesOffset, h, l)
    );

    // Service Lines
    const serviceZ = l * 0.35; 
    points.push(
        new THREE.Vector3(0, h, -l + 100), new THREE.Vector3(0, h, -serviceZ),
        new THREE.Vector3(0, h, l - 100), new THREE.Vector3(0, h, serviceZ)
    );
    points.push(
        new THREE.Vector3(-w, h, -serviceZ), new THREE.Vector3(w, h, -serviceZ),
        new THREE.Vector3(-w, h, serviceZ), new THREE.Vector3(w, h, serviceZ)
    );
    const backServiceOffset = 100;
    points.push(
        new THREE.Vector3(-w, h, -l + backServiceOffset), new THREE.Vector3(w, h, -l + backServiceOffset),
        new THREE.Vector3(-w, h, l - backServiceOffset), new THREE.Vector3(w, h, l - backServiceOffset)
    );

    const geomLines = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(geomLines, matLine);
    this.mesh.add(lines);
  }

  private createNet() {
    const netGroup = new THREE.Group();
    const postGeom = new THREE.CylinderGeometry(5, 5, NET_HEIGHT, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const leftPost = new THREE.Mesh(postGeom, postMat);
    leftPost.position.set(-COURT_WIDTH/2 - 15, NET_HEIGHT/2, 0);
    const rightPost = new THREE.Mesh(postGeom, postMat);
    rightPost.position.set(COURT_WIDTH/2 + 15, NET_HEIGHT/2, 0);
    netGroup.add(leftPost);
    netGroup.add(rightPost);

    const netGeom = new THREE.PlaneGeometry(COURT_WIDTH + 30, 76);
    const netMesh = new THREE.Mesh(netGeom, matNet);
    netMesh.position.set(0, NET_HEIGHT - 38, 0);
    netGroup.add(netMesh);

    const tapeGeom = new THREE.PlaneGeometry(COURT_WIDTH + 30, 5);
    const tapeMesh = new THREE.Mesh(tapeGeom, matNetTop);
    tapeMesh.position.set(0, NET_HEIGHT - 2.5, 0);
    tapeMesh.receiveShadow = false; 
    netGroup.add(tapeMesh);

    this.mesh.add(netGroup);
  }
}

// --- Character ---
export class Character {
  public mesh: THREE.Group;
  public racket: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public speed: number = 16.0; 
  public isPlayer: boolean;
  public isSmashing: boolean = false;
  
  private root: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group; 
  private legL: THREE.Group;
  private legR: THREE.Group;
  
  private animTime: number = 0;
  private swingTimer: number = 0;
  private swingDuration: number = 20;

  private LEG_LEN = 85;
  private TORSO_H = 60;
  private TORSO_W = 45;
  private HEAD_SIZE = 28;
  
  constructor(isPlayer: boolean, color: number) {
    this.isPlayer = isPlayer;
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();

    this.root = new THREE.Group();
    this.mesh.add(this.root);

    const matShirt = new THREE.MeshLambertMaterial({ color });

    this.torso = new THREE.Group();
    this.torso.position.y = this.LEG_LEN + (this.TORSO_H / 2);
    
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(this.TORSO_W, this.TORSO_H, 25), matShirt);
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);
    this.root.add(this.torso);

    this.head = new THREE.Group();
    this.head.position.y = (this.TORSO_H / 2) + (this.HEAD_SIZE / 2);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(this.HEAD_SIZE * 0.8, this.HEAD_SIZE, this.HEAD_SIZE * 0.9), matSkin);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.torso.add(this.head);

    this.armL = this.createLimb(true, matSkin, matShirt);
    this.armL.position.set(-this.TORSO_W/2 - 5, this.TORSO_H/2 - 10, 0);
    this.torso.add(this.armL);

    this.armR = this.createLimb(false, matSkin, matShirt);
    this.armR.position.set(this.TORSO_W/2 + 5, this.TORSO_H/2 - 10, 0);
    this.torso.add(this.armR);

    this.legL = this.createLimb(true, matSkin, matShorts, true);
    this.legL.position.set(-12, -this.TORSO_H/2, 0);
    this.torso.add(this.legL);

    this.legR = this.createLimb(false, matSkin, matShorts, true);
    this.legR.position.set(12, -this.TORSO_H/2, 0);
    this.torso.add(this.legR);

    this.racket = this.createRacket();
    this.racket.position.set(0, -this.LEG_LEN * 0.8, 20); 
    this.racket.rotation.x = Math.PI / 2;
    this.armR.add(this.racket);
  }

  private createLimb(isLeft: boolean, skin: THREE.Material, clothing: THREE.Material, isLeg: boolean = false): THREE.Group {
    const group = new THREE.Group();
    const len = isLeg ? this.LEG_LEN : 60; 
    const width = isLeg ? 14 : 10;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(width, len, width), isLeg ? clothing : clothing); 
    upper.position.y = -len / 2;
    upper.castShadow = true;
    group.add(upper);
    return group;
  }

  private createRacket(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 45), new THREE.MeshLambertMaterial({color: 0x333333}));
    handle.position.y = 22;
    group.add(handle);
    const ringGeom = new THREE.TorusGeometry(18, 1.5, 8, 20);
    const ring = new THREE.Mesh(ringGeom, new THREE.MeshLambertMaterial({color: 0x222222})); 
    ring.position.y = 60;
    group.add(ring);
    const stringGeom = new THREE.CylinderGeometry(17, 17, 1, 8);
    const strings = new THREE.Mesh(stringGeom, new THREE.MeshBasicMaterial({color: 0x00ff00, transparent:true, opacity:0.6}));
    strings.position.y = 60;
    strings.rotation.x = Math.PI/2;
    group.add(strings);
    return group;
  }

  public update(dt: number, targetLookAt?: THREE.Vector3) {
    this.animTime += dt * 10;
    this.position.add(this.velocity);

    if (targetLookAt) {
      const targetPos = targetLookAt.clone();
      targetPos.y = this.position.y;
      this.mesh.lookAt(targetPos);
    } else {
       const lookZ = this.isPlayer ? 5000 : -5000;
       this.mesh.lookAt(this.position.x, this.position.y, lookZ);
    }

    const isMoving = this.velocity.lengthSq() > 0.1;
    if (isMoving) {
      this.legL.rotation.x = Math.sin(this.animTime) * 0.8;
      this.legR.rotation.x = Math.sin(this.animTime + Math.PI) * 0.8;
      this.armL.rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
      if (this.swingTimer <= 0) {
        this.armR.rotation.x = Math.sin(this.animTime) * 0.5;
        this.armR.rotation.z = 0;
      }
      this.root.position.y = Math.abs(Math.sin(this.animTime * 2)) * 2;
    } else {
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      this.root.position.y = 0;
      if (this.swingTimer <= 0) {
        this.armR.rotation.x = Math.sin(this.animTime * 0.5) * 0.1;
        this.armL.rotation.x = -Math.sin(this.animTime * 0.5) * 0.1;
      }
    }

    if (this.swingTimer > 0) {
      this.swingTimer -= dt * 60; 
      const progress = 1 - (this.swingTimer / this.swingDuration); 
      
      if (this.isSmashing) {
        if (progress < 0.3) {
          this.armR.rotation.x = -Math.PI; 
          this.armR.rotation.z = 0.5;
          this.root.position.y += 3; 
        } else {
          this.armR.rotation.x = Math.PI / 2 * (progress * 2.5); 
          this.armR.rotation.z = -0.5;
          this.root.position.y -= 3;
        }
      } else {
        if (progress < 0.5) {
             this.armR.rotation.x = -Math.PI / 1.5; 
             this.armR.rotation.z = 1.0;
        } else {
             this.armR.rotation.x = Math.PI / 4;
             this.armR.rotation.z = -1.0;
        }
      }
    }
  }

  public swing(isSmash: boolean) {
    if (this.swingTimer > 0) return; 
    this.swingTimer = this.swingDuration;
    this.isSmashing = isSmash;
  }
}

// --- Shuttle ---
export class Shuttle {
  public mesh: THREE.Group;
  public shadow: THREE.Mesh;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public inPlay: boolean = true;
  
  private glowSprite: THREE.Sprite;
  private glowLight: THREE.PointLight;
  private trailLine: THREE.Line;
  private trailPositions: THREE.Vector3[] = [];
  private trailColors: number[] = [];
  private trailMax: number = 30; // Longer trail

  constructor() {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();

    // Cork
    const cork = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 12), matShuttleCork);
    this.mesh.add(cork);
    
    // Skirt
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(15, 18, 12, 1, true), matShuttleSkirt);
    skirt.position.y = 9;
    skirt.rotation.x = Math.PI; 
    this.mesh.add(skirt);

    // Glow Halo 
    const map = new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+/PmQCNjbAAADFSURBVHja7JtBDsIwDATt/396QyokDo3t2I3tctJalKCN450dZ28751z4sR8EIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQj4TwLPzHl2X/d9+5xzn/d9+5z3fX+f/w9AAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQj4vAD1h/33/QcQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQ8C8B55z7x75v3/P+P+8/AAEIQAACEIAABCDg8wI8AQYADi12w2SK2ccAAAAASUVORK5CYII=');
    const spriteMat = new THREE.SpriteMaterial({ 
        map: map, 
        color: 0xffff00, 
        transparent: true, 
        blending: THREE.AdditiveBlending,
        opacity: 0.8
    });
    this.glowSprite = new THREE.Sprite(spriteMat);
    this.glowSprite.scale.set(80, 80, 1);
    this.glowSprite.visible = false;
    this.mesh.add(this.glowSprite);

    // Dynamic Light
    this.glowLight = new THREE.PointLight(0xffaa00, 2, 300);
    this.glowLight.visible = false;
    this.mesh.add(this.glowLight);

    // Shadow
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(16, 16), matShadow);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 2;

    // Trail with Vertex Colors
    const trailGeom = new THREE.BufferGeometry();
    // Initialize empty buffer
    const positions = new Float32Array(this.trailMax * 3);
    const colors = new Float32Array(this.trailMax * 3);
    trailGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, linewidth: 3 });
    this.trailLine = new THREE.Line(trailGeom, trailMat);
    this.trailLine.frustumCulled = false;
  }

  public getShadowMesh() { return this.shadow; }
  public getTrailMesh() { return this.trailLine; }

  public update(dt: number) {
    if (!this.inPlay) {
        this.shadow.visible = false;
        this.trailLine.visible = false;
        this.glowSprite.visible = false;
        this.glowLight.visible = false;
        return;
    }
    
    const speed = this.velocity.length();
    const isFlying = this.position.y > 20 && speed > 1;
    this.glowSprite.visible = isFlying;
    this.glowLight.visible = isFlying;
    this.shadow.visible = true;
    this.trailLine.visible = true;

    // Physics
    this.velocity.y -= GRAVITY;
    this.velocity.x *= DRAG_AIR;
    this.velocity.z *= DRAG_AIR;

    this.position.add(this.velocity);

    if (speed > 0.1) {
        const target = this.position.clone().add(this.velocity);
        this.mesh.lookAt(target);
        this.mesh.rotateX(-Math.PI / 2); 
    }

    if (this.position.y <= SHUTTLE_RADIUS) {
      this.position.y = SHUTTLE_RADIUS;
      this.velocity.set(0, 0, 0);
      this.inPlay = false;
    }

    // Shadow Logic
    this.shadow.position.set(this.position.x, 2, this.position.z);
    const dist = this.position.y;
    const opacity = Math.max(0.1, 0.4 - (dist / 1000));
    (this.shadow.material as THREE.Material).opacity = opacity;
    const scale = 1 + (dist / 200);
    this.shadow.scale.set(scale, scale, 1);

    // Dynamic Trail Logic
    this.updateTrail(speed);
  }

  private updateTrail(speed: number) {
      this.trailPositions.unshift(this.position.clone());
      
      // Determine color based on speed
      // Speed ranges: 0-10 (Slow, Blue), 10-25 (Med, Yellow), 25+ (Fast, Red/Orange)
      let r=1, g=1, b=1;
      if (speed > 25) { // Smash
          r = 1.0; g = 0.2; b = 0.0;
      } else if (speed > 12) { // Normal
          r = 1.0; g = 1.0; b = 0.0;
      } else { // Slow / Drop
          r = 0.0; g = 0.8; b = 1.0;
      }
      this.trailColors.unshift(r, g, b);

      if (this.trailPositions.length > this.trailMax) {
          this.trailPositions.pop();
          this.trailColors.pop();
          this.trailColors.pop();
          this.trailColors.pop();
      }
      
      const positions = new Float32Array(this.trailPositions.length * 3);
      const colors = new Float32Array(this.trailPositions.length * 3);

      for (let i = 0; i < this.trailPositions.length; i++) {
          positions[i*3] = this.trailPositions[i].x;
          positions[i*3+1] = this.trailPositions[i].y;
          positions[i*3+2] = this.trailPositions[i].z;

          // Fade out tail color
          const alpha = 1 - (i / this.trailPositions.length);
          colors[i*3] = this.trailColors[i*3] * alpha;
          colors[i*3+1] = this.trailColors[i*3+1] * alpha;
          colors[i*3+2] = this.trailColors[i*3+2] * alpha;
      }

      this.trailLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.trailLine.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      this.trailLine.geometry.computeBoundingSphere();
      
      // Reset range to draw only existing points
      this.trailLine.geometry.setDrawRange(0, this.trailPositions.length);
  }

  public reset(pos: THREE.Vector3) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.inPlay = true;
    this.mesh.rotation.set(0,0,0);
    this.trailPositions = [];
    this.trailColors = [];
    this.glowSprite.visible = false;
    this.glowLight.visible = false;
  }
}