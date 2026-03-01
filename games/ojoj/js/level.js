class Level {
    constructor() {
        this.trackLength = TRACK_LENGTH;
        this.finishLineX = this.trackLength - 100;
        this.obstacles = [];
        this.ramps = [];
    }

    static getLevelData() {
        return {
            trackLength: TRACK_LENGTH,
            obstacles: [
                // Section 1 - gentle intro
                { type: 'fireball', x: 500, lane: 1, radius: 25 },
                { type: 'lavaball', x: 900, lane: 0, radius: 28 },

                // Section 2
                { type: 'fan', x: 1300, lane: 1 },
                { type: 'fireball', x: 1600, lane: 2, radius: 25 },

                // Section 3
                { type: 'lavaball', x: 2000, lane: 1, radius: 30 },
                { type: 'fan', x: 2400, lane: 0 },

                // Section 4 - midpoint
                { type: 'fireball', x: 2800, lane: 0, radius: 28 },
                { type: 'fireball', x: 2800, lane: 2, radius: 28 },

                // Section 5
                { type: 'lavaball', x: 3200, lane: 1, radius: 25 },
                { type: 'fan', x: 3600, lane: 2 },

                // Section 6
                { type: 'fireball', x: 4000, lane: 0, radius: 30 },
                { type: 'lavaball', x: 4400, lane: 2, radius: 28 },

                // Section 7 - harder
                { type: 'fan', x: 4800, lane: 1 },
                { type: 'fireball', x: 5100, lane: 0, radius: 25 },
                { type: 'fireball', x: 5100, lane: 2, radius: 25 },

                // Final stretch
                { type: 'lavaball', x: 5400, lane: 1, radius: 30 },
                { type: 'fan', x: 5700, lane: 0 },
            ],
            ramps: [
                { x: 400, lane: 1 },
                { x: 1200, lane: 2 },
                { x: 2200, lane: 0 },
                { x: 3000, lane: 1 },
                { x: 3800, lane: 2 },
                { x: 4600, lane: 0 },
                { x: 5300, lane: 1 },
            ]
        };
    }

    load() {
        const data = Level.getLevelData();
        this.trackLength = data.trackLength;
        this.finishLineX = this.trackLength - 100;

        // Create obstacles
        data.obstacles.forEach(obs => {
            const laneY = this.getLaneCenterY(obs.lane);

            switch (obs.type) {
                case 'fireball':
                    this.obstacles.push(new Fireball(obs.x, laneY, obs.radius || FIREBALL_RADIUS));
                    break;
                case 'lavaball':
                    this.obstacles.push(new LavaBall(obs.x, laneY, obs.radius || LAVABALL_RADIUS));
                    break;
                case 'fan':
                    const fanY = LANE_HEIGHT * (obs.lane + 1.2);
                    this.obstacles.push(new Fan(obs.x, fanY, FAN_WIDTH, FAN_HEIGHT, FAN_WIND_STRENGTH, FAN_WIND_RANGE));
                    break;
            }
        });

        // Create ramps
        data.ramps.forEach(ramp => {
            const rampY = LANE_HEIGHT * (ramp.lane + 1.5) - RAMP_HEIGHT;
            this.ramps.push(new Ramp(ramp.x, rampY, RAMP_WIDTH, RAMP_HEIGHT));
        });
    }

    getLaneCenterY(laneIndex) {
        return LANE_HEIGHT * (laneIndex + 1.5);
    }

    update(dt) {
        this.obstacles.forEach(obs => obs.update(dt));
    }

    reset() {
        this.obstacles = [];
        this.ramps = [];
        this.load();
    }
}
