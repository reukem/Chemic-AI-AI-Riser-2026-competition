/**
 * @file ContainerParticleSystem.ts
 * @description Dedicated Canvas 2D Particle Engine for Chemic-AI Lab Glassware.
 * Renders effervescent bubbling, boiling nucleation, aerosol vapor plumes,
 * PbI2 Golden Rain hexagonal crystal flutters, alkali sparks, and precipitate sediment settling.
 */

import { ThermodynamicState } from '../ThermodynamicEngine';

export interface LabParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    life: number;
    decay: number;
    isGoldenFlake?: boolean;
    isVaporMist?: boolean;
    isBoilingBubble?: boolean;
    isExplosion?: boolean;
    surfaceY?: number;
    phase?: number;
    rotSpeed?: number;
}

export class ContainerParticleSystem {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private particles: LabParticle[] = [];
    private animFrameId: number | null = null;
    private dpr: number = 1.0;

    constructor() {}

    /**
     * Mounts the particle system to a glass container canvas element.
     */
    public mount(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
    }

    /**
     * Unmounts and cleans up resources.
     */
    public unmount(): void {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Resizes the canvas to match parent bounds with high-DPI scaling.
     */
    public resize(): void {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        if (this.ctx) {
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        }
    }

    /**
     * Spawns an impulsive particle burst (e.g. from pouring, drop impact, or explosion).
     */
    public spawnBurst(
        effect: string,
        r: number,
        g: number,
        b: number,
        volume: number,
        maxVol: number
    ): void {
        if (!this.canvas) return;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const liquidTopY = h - (volume / Math.max(1, maxVol)) * h;

        let numParticles = 15;
        const isExp = effect === 'explosion';
        if (isExp) numParticles = 45;
        else if (effect === 'fizz') numParticles = 40;

        for (let i = 0; i < numParticles; i++) {
            const color = isExp
                ? (Math.random() > 0.5 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(239, 68, 68, 0.9)')
                : `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, ${0.5 + Math.random() * 0.5})`;

            const vx = (Math.random() - 0.5) * (isExp ? 3.5 : 2.0);
            const vy = -(isExp ? (3.5 + Math.random() * 4.5) : (1.0 + Math.random() * 3.0));
            const radius = isExp ? (1.8 + Math.random() * 3.5) : (1.0 + Math.random() * 3.0);
            const decay = isExp ? (0.018 + Math.random() * 0.02) : (0.01 + Math.random() * 0.02);

            this.particles.push({
                x: Math.random() * w,
                y: Math.max(liquidTopY, h - Math.random() * (h - liquidTopY)),
                vx,
                vy,
                radius,
                color,
                life: 1.0,
                decay,
                isExplosion: isExp
            });
        }
    }

    /**
     * Advances simulation and renders one frame onto the canvas.
     */
    public tick(
        isPaused: boolean,
        isEffervescing: boolean,
        thermoState: ThermodynamicState | null,
        contents: Record<string, number> | undefined,
        volume: number,
        maxVol: number
    ): void {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;

        ctx.clearRect(0, 0, w, h);

        const liquidHeightPx = (volume / Math.max(1, maxVol)) * h;
        const liquidTopY = h - liquidHeightPx;

        if (!isPaused && volume > 0) {
            // 1. Effervescent Bubbling Spawn
            if (isEffervescing) {
                const count = Math.floor(Math.random() * 3) + 1;
                for (let k = 0; k < count; k++) {
                    this.particles.push({
                        x: 12 + Math.random() * (w - 24),
                        y: h - 6 - Math.random() * (liquidHeightPx * 0.8),
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: -(2.5 + Math.random() * 4.0),
                        radius: 0.8 + Math.random() * 2.2,
                        color: 'rgba(255, 255, 255, 0.85)',
                        life: 1.0,
                        decay: 0.02,
                        isBoilingBubble: true,
                        surfaceY: liquidTopY
                    });
                }
            }

            // 2. Thermodynamic Boiling Nucleation & Vapor Plumes
            if (thermoState && (thermoState.isBoiling || thermoState.isSimmering)) {
                if (Math.random() < 0.45) {
                    this.particles.push({
                        x: w * 0.5 + (Math.random() - 0.5) * 24,
                        y: liquidTopY - 4,
                        vx: (Math.random() - 0.5) * 1.2,
                        vy: -(1.5 + Math.random() * 2.5),
                        radius: 3.0 + Math.random() * 5.5,
                        color: 'rgba(240, 248, 255, 0.4)',
                        life: 1.0,
                        decay: 0.018,
                        isVaporMist: true
                    });
                }

                const spawnProb = thermoState.isBoiling ? 0.85 : 0.35;
                if (Math.random() < spawnProb) {
                    this.particles.push({
                        x: 14 + Math.random() * (w - 28),
                        y: h - 6,
                        vx: (Math.random() - 0.5) * (thermoState.isBoiling ? 1.5 : 0.6),
                        vy: -(thermoState.isBoiling ? (3.0 + Math.random() * 3.5) : (1.4 + Math.random() * 1.5)),
                        radius: thermoState.isBoiling ? (1.5 + Math.random() * 3.2) : (1.0 + Math.random() * 1.8),
                        color: 'rgba(255, 255, 255, 0.9)',
                        life: 1.0,
                        decay: 0.015,
                        isBoilingBubble: true,
                        surfaceY: liquidTopY
                    });
                }
            }

            // 3. Golden Rain (PbI2) Hexagonal Crystal Flutter
            if (contents && (contents['PbI2_PRECIPITATE'] || 0) > 0.001) {
                if (Math.random() < 0.6) {
                    this.particles.push({
                        x: 10 + Math.random() * (w - 20),
                        y: liquidTopY + Math.random() * 10,
                        vx: (Math.random() - 0.5) * 0.6,
                        vy: 0.8 + Math.random() * 1.4,
                        radius: 2.2 + Math.random() * 3.5,
                        color: 'rgba(250, 204, 21, 0.95)',
                        life: 1.0,
                        decay: 0.006,
                        isGoldenFlake: true,
                        phase: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.12
                    });
                }
            }

            // 4. Molten Alkali Skittering Sparks (Na, K, Li)
            const hasAlkali = contents && (
                (contents['SODIUM'] || 0) > 0.001 || 
                (contents['POTASSIUM'] || 0) > 0.001 || 
                (contents['LITHIUM'] || 0) > 0.001
            );
            if (hasAlkali && Math.random() < 0.7) {
                const alkaliColor = (contents['POTASSIUM'] || 0) > 0.001 
                    ? 'rgba(216, 180, 254, 0.95)' 
                    : 'rgba(251, 191, 36, 0.95)';
                this.particles.push({
                    x: w * 0.5 + Math.sin(Date.now() * 0.006) * (w * 0.32),
                    y: liquidTopY - 1,
                    vx: (Math.random() - 0.5) * 2.2,
                    vy: -(1.2 + Math.random() * 2.4),
                    radius: 0.9 + Math.random() * 1.8,
                    color: alkaliColor,
                    life: 0.7,
                    decay: 0.035,
                    isExplosion: true
                });
            }
        }

        // 5. Update & Draw All Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (!isPaused) {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= p.decay;

                if (p.isGoldenFlake) {
                    p.x += Math.sin((p.phase || 0) + p.y * 0.05) * 0.8;
                    p.phase = ((p.phase || 0) + (p.rotSpeed || 0.05)) % (Math.PI * 2);
                } else if (p.isVaporMist) {
                    p.radius += 0.12;
                    p.vx += (Math.random() - 0.5) * 0.1;
                } else if (p.isBoilingBubble) {
                    p.x += Math.sin(p.y * 0.2) * 0.5;
                    // Pop at meniscus surface with aerosol droplet burst
                    if (p.surfaceY !== undefined && p.y <= p.surfaceY) {
                        p.life = 0;
                        if (Math.random() < 0.35) {
                            this.particles.push({
                                x: p.x,
                                y: p.surfaceY - 1,
                                vx: (Math.random() - 0.5) * 1.8,
                                vy: -(1.5 + Math.random() * 2.0),
                                radius: 0.6 + Math.random() * 0.8,
                                color: 'rgba(255, 255, 255, 0.8)',
                                life: 0.5,
                                decay: 0.05
                            });
                        }
                    }
                }
            }

            if (p.life > 0) {
                ctx.globalAlpha = Math.max(0, p.life);

                if (p.isGoldenFlake) {
                    // Draw 6-sided hexagonal micro-crystal flake with glint
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.phase || 0);
                    ctx.beginPath();
                    const hr = p.radius;
                    for (let a = 0; a < 6; a++) {
                        const angle = (a * Math.PI) / 3;
                        const hx = Math.cos(angle) * hr;
                        const hy = Math.sin(angle) * hr * 0.6;
                        if (a === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.95)';
                    ctx.shadowColor = 'rgba(234, 179, 8, 0.9)';
                    ctx.shadowBlur = 4;
                    ctx.fill();
                    ctx.restore();
                } else if (p.isBoilingBubble) {
                    // Draw transparent bubble with light refraction rim & specular highlight
                    const br = Math.max(0.6, p.radius);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fill();
                    ctx.lineWidth = Math.max(0.6, br * 0.28);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.stroke();

                    if (br > 1.2) {
                        ctx.beginPath();
                        ctx.arc(p.x - br * 0.35, p.y - br * 0.35, br * 0.32, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.fill();
                    }
                } else {
                    // Standard circular particle
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                }

                ctx.globalAlpha = 1.0;
            } else if (!isPaused) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Returns the active particle count for telemetry.
     */
    public get activeCount(): number {
        return this.particles.length;
    }
}
