/**
 * @file FluidSpringSolver.ts
 * @description 20-Node Coupled 1D Shallow-Water Spring-Mass Wave Physics Engine.
 * Simulates fluid sloshing, surface waves, inertia response to container acceleration,
 * capillary meniscus elevation, and cubic-bezier SVG path generation at 120 FPS.
 */

export interface WavePoint {
    x: number;
    y: number;
}

export interface WavePaths {
    frontPolygon: string;
    backPolygon: string;
    meniscusStroke: string;
}

export class FluidSpringSolver {
    readonly nodeCount: number;
    readonly y: Float32Array;
    readonly vy: Float32Array;
    
    private lastX: number;
    private lastVx: number;
    private lastTime: number;
    public sloshVelocity: number = 0;

    // Physical constants
    public springK: number = 0.28;       // Coupling tension between neighboring nodes
    public damping: number = 0.94;       // Viscous fluid energy dissipation
    public maxDisplacement: number = 20; // Maximum slosh wave height in SVG px
    public baselineY: number = 18;       // Neutral liquid baseline in SVG viewport (0-36)
    public svgWidth: number = 200;       // Standard SVG coordinate space width
    public svgHeight: number = 36;       // Standard SVG coordinate space height

    constructor(nodeCount: number = 20, initialX: number = 500) {
        this.nodeCount = nodeCount;
        this.y = new Float32Array(nodeCount);
        this.vy = new Float32Array(nodeCount);
        this.lastX = initialX;
        this.lastVx = 0;
        this.lastTime = performance.now();
    }

    /**
     * Resets wave nodes to equilibrium.
     */
    public reset(currentX: number = 500): void {
        this.y.fill(0);
        this.vy.fill(0);
        this.lastX = currentX;
        this.lastVx = 0;
        this.lastTime = performance.now();
        this.sloshVelocity = 0;
    }

    /**
     * Injects an external physical impulse at a specific horizontal fraction (0 = left, 1 = right).
     */
    public applyImpulse(strength: number, locationNorm: number = 0.5): void {
        const centerIdx = Math.round(locationNorm * (this.nodeCount - 1));
        const radius = Math.max(2, Math.floor(this.nodeCount * 0.2));

        for (let i = 0; i < this.nodeCount; i++) {
            const dist = Math.abs(i - centerIdx);
            if (dist <= radius) {
                const factor = 1 - dist / (radius + 1);
                this.vy[i] += strength * factor;
            }
        }
    }

    /**
     * Advances the fluid slosh simulation by one frame.
     * @param now Current timestamp from performance.now()
     * @param currentX Current horizontal position of the container
     * @param isBoiling Whether active boiling turbulence should be applied
     * @param viscosity Viscosity multiplier (default 1.0; higher = more damping)
     */
    public step(
        now: number, 
        currentX: number, 
        isBoiling: boolean = false,
        viscosity: number = 1.0
    ): void {
        const dt = Math.min(0.033, Math.max(0.008, (now - this.lastTime) / 1000));
        this.lastTime = now;

        // Instantaneous container velocity & horizontal acceleration
        const instVx = (currentX - this.lastX) / dt;
        const ax = (instVx - this.lastVx) / dt;
        this.lastX = currentX;
        this.lastVx = instVx;
        this.sloshVelocity = instVx;

        const N = this.nodeCount;
        // Horizontal beaker acceleration (F = -m * a) projected as antisymmetric slosh torque
        const clampedAccel = Math.max(-20, Math.min(20, ax * 0.45));
        const effectiveDamping = Math.pow(this.damping, Math.max(0.5, viscosity));

        for (let i = 0; i < N; i++) {
            const normX = (i / (N - 1)) - 0.5; // [-0.5, +0.5]
            const sloshForce = -clampedAccel * normX * 2.0;

            // Hooke's Law coupled tension across neighboring nodes
            const yLeft = i > 0 ? this.y[i - 1] : this.y[i];
            const yRight = i < N - 1 ? this.y[i + 1] : this.y[i];
            const spread = (this.springK / Math.max(0.5, viscosity)) * ((yLeft - this.y[i]) + (yRight - this.y[i]));

            // Thermal boiling micro-turbulence
            const boilJitter = isBoiling ? (Math.random() - 0.5) * 4.2 : 0;

            // Restoring force pulling back to baseline
            const restoringForce = -0.065 * this.y[i];

            this.vy[i] += (spread + sloshForce + boilJitter + restoringForce) * (dt * 60);
            this.vy[i] *= effectiveDamping;
        }

        // Integrate position and clamp within physical glass wall boundaries
        for (let i = 0; i < N; i++) {
            this.y[i] += this.vy[i] * (dt * 60);
            this.y[i] = Math.max(-this.maxDisplacement, Math.min(this.maxDisplacement, this.y[i]));
        }
    }

    /**
     * Generates smooth SVG path geometry with capillary meniscus elevation.
     */
    public generatePaths(): WavePaths {
        const N = this.nodeCount;
        const wavePoints: WavePoint[] = [];

        for (let i = 0; i < N; i++) {
            const x = (i / (N - 1)) * this.svgWidth;
            // Authentic capillary climb (+4px upwards against glass walls at meniscus edges)
            const capillary = (i === 0 || i === N - 1) ? -4.0 : (i === 1 || i === N - 2) ? -1.5 : 0;
            const y = Math.max(2, Math.min(this.svgHeight - 2, this.baselineY + this.y[i] + capillary));
            wavePoints.push({ x, y });
        }

        // Front primary wave - Quadratic Bézier spline
        let frontWavePath = `M 0,${wavePoints[0].y.toFixed(1)}`;
        for (let i = 0; i < N - 1; i++) {
            const p0 = wavePoints[i];
            const p1 = wavePoints[i + 1];
            const mx = (p0.x + p1.x) / 2;
            const my = (p0.y + p1.y) / 2;
            frontWavePath += ` Q ${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
        }
        frontWavePath += ` T ${wavePoints[N - 1].x.toFixed(1)},${wavePoints[N - 1].y.toFixed(1)}`;

        const frontPolygon = `${frontWavePath} L ${this.svgWidth},${this.svgHeight} L 0,${this.svgHeight} Z`;
        const meniscusStroke = frontWavePath;

        // Depth perspective secondary wave (back wall reflection)
        let backWavePath = `M 0,${Math.max(2, Math.min(this.svgHeight - 2, this.baselineY - this.y[0] * 0.65 - 2)).toFixed(1)}`;
        for (let i = 1; i < N; i++) {
            const px = (i / (N - 1)) * this.svgWidth;
            const py = Math.max(2, Math.min(this.svgHeight - 2, this.baselineY - this.y[i] * 0.65));
            backWavePath += ` L ${px.toFixed(1)},${py.toFixed(1)}`;
        }
        const backPolygon = `${backWavePath} L ${this.svgWidth},${this.svgHeight} L 0,${this.svgHeight} Z`;

        return { frontPolygon, backPolygon, meniscusStroke };
    }
}
