// Drawing Animation Engine
// Handles canvas rendering and pencil animation

const Drawing = {
    canvas: null,
    ctx: null,
    pencilEl: null,
    currentAnimation: null,
    isDrawing: false,
    canvasRect: null,
    scale: 1,

    init(canvasEl, pencilEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.pencilEl = pencilEl;
        this.setupCanvas();

        // Handle window resize
        window.addEventListener('resize', () => this.setupCanvas());
    },

    setupCanvas() {
        // Get the display size
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvasRect = rect;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        // Scale context for high DPI
        this.ctx.scale(dpr, dpr);

        // Calculate scale factor (drawings are designed for 400x300)
        this.scale = Math.min(rect.width / 400, rect.height / 300);

        // Set drawing styles
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    },

    startDrawing(drawingData, onComplete) {
        this.stopDrawing();
        // Re-setup canvas in case it was hidden before
        this.setupCanvas();
        this.clearCanvas();
        this.isDrawing = true;

        const allPoints = this.generateAllPoints(drawingData.paths);
        this.animatePoints(allPoints, onComplete);
    },

    generateAllPoints(paths) {
        const allPoints = [];

        paths.forEach((path, pathIndex) => {
            let points = [];

            switch (path.type) {
                case 'polyline':
                    points = this.interpolatePolyline(path);
                    break;
                case 'arc':
                    if (path.isEllipse) {
                        points = this.interpolateEllipse(path);
                    } else {
                        points = this.interpolateArc(path);
                    }
                    break;
                case 'bezier':
                    points = this.interpolateBezier(path);
                    break;
            }

            // Add path metadata to each point
            points.forEach((p, i) => {
                p.color = path.strokeColor || '#333';
                p.width = path.strokeWidth || 3;
                p.isFirst = i === 0;
            });

            if (points.length > 0) {
                allPoints.push(...points);
                // Add a "pen lift" marker between paths
                allPoints.push({ lift: true });
            }
        });

        return allPoints;
    },

    interpolatePolyline(path) {
        const points = [];
        const segmentPoints = 15; // Points per segment for smooth animation

        for (let i = 0; i < path.points.length - 1; i++) {
            const start = path.points[i];
            const end = path.points[i + 1];

            for (let j = 0; j <= segmentPoints; j++) {
                const t = j / segmentPoints;
                points.push({
                    x: start.x + (end.x - start.x) * t,
                    y: start.y + (end.y - start.y) * t
                });
            }
        }

        return points;
    },

    interpolateArc(arc) {
        const points = [];
        const angleRange = arc.endAngle - arc.startAngle;
        const steps = arc.pointCount || 50;

        for (let i = 0; i <= steps; i++) {
            const angle = arc.startAngle + (angleRange * i / steps);
            points.push({
                x: arc.centerX + Math.cos(angle) * arc.radius,
                y: arc.centerY + Math.sin(angle) * arc.radius
            });
        }

        return points;
    },

    interpolateEllipse(arc) {
        const points = [];
        const angleRange = arc.endAngle - arc.startAngle;
        const steps = arc.pointCount || 50;
        const radiusX = arc.radiusX || arc.radius;
        const radiusY = arc.radiusY || arc.radius;

        for (let i = 0; i <= steps; i++) {
            const angle = arc.startAngle + (angleRange * i / steps);
            points.push({
                x: arc.centerX + Math.cos(angle) * radiusX,
                y: arc.centerY + Math.sin(angle) * radiusY
            });
        }

        return points;
    },

    interpolateBezier(bezier) {
        const points = [];
        const steps = bezier.pointCount || 50;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Cubic bezier formula
            const x = Math.pow(1-t, 3) * bezier.start.x +
                      3 * Math.pow(1-t, 2) * t * bezier.control1.x +
                      3 * (1-t) * Math.pow(t, 2) * bezier.control2.x +
                      Math.pow(t, 3) * bezier.end.x;
            const y = Math.pow(1-t, 3) * bezier.start.y +
                      3 * Math.pow(1-t, 2) * t * bezier.control1.y +
                      3 * (1-t) * Math.pow(t, 2) * bezier.control2.y +
                      Math.pow(t, 3) * bezier.end.y;

            points.push({ x, y });
        }

        return points;
    },

    animatePoints(points, onComplete) {
        let index = 0;
        let lastPoint = null;

        // Time-based animation: complete drawing in ~20 seconds regardless of point count
        const targetDuration = 20000; // ms
        const startTime = performance.now();

        const animate = (timestamp) => {
            if (!this.isDrawing) return;

            // Determine how far along we should be based on elapsed time
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / targetDuration, 1);
            const targetIndex = Math.floor(progress * points.length);

            let lastNonLiftPoint = null;

            // Draw all points up to targetIndex
            while (index <= targetIndex && index < points.length) {
                const point = points[index];
                index++;

                if (point.lift) {
                    lastPoint = point;
                    continue;
                }

                // Scale point coordinates
                const scaledX = point.x * this.scale;
                const scaledY = point.y * this.scale;
                const scaledWidth = (point.width || 3) * this.scale;

                if (lastPoint && !lastPoint.lift && !point.isFirst) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = point.color || '#333';
                    this.ctx.lineWidth = scaledWidth;
                    this.ctx.moveTo(lastPoint.scaledX, lastPoint.scaledY);
                    this.ctx.lineTo(scaledX, scaledY);
                    this.ctx.stroke();
                }

                // Store scaled coordinates
                point.scaledX = scaledX;
                point.scaledY = scaledY;
                lastPoint = point;
                lastNonLiftPoint = point;
            }

            // Update pencil to last drawn position
            if (lastNonLiftPoint) {
                this.updatePencil(lastNonLiftPoint, lastNonLiftPoint);
            }

            if (index < points.length && this.isDrawing) {
                this.currentAnimation = requestAnimationFrame(animate);
            } else {
                this.hidePencil();
                this.isDrawing = false;
                if (onComplete) onComplete();
            }
        };

        this.showPencil();
        this.currentAnimation = requestAnimationFrame(animate);
    },

    updatePencil(point, prevPoint) {
        if (!this.pencilEl) return;

        const scaledX = point.x * this.scale;
        const scaledY = point.y * this.scale;

        // Calculate angle based on direction
        let angle = -45; // Default angle (pointing down-right)
        if (prevPoint && !prevPoint.lift) {
            const dx = scaledX - prevPoint.scaledX;
            const dy = scaledY - prevPoint.scaledY;
            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            }
        }

        // Position pencil with tip at the drawing point
        // The pencil tip is at the top of the SVG (y=0 after transform)
        const offsetX = 12; // Half pencil width
        const offsetY = 0;  // Tip is at origin

        this.pencilEl.style.transform =
            `translate(${scaledX - offsetX}px, ${scaledY - offsetY}px) rotate(${angle}deg)`;
    },

    stopDrawing() {
        this.isDrawing = false;
        if (this.currentAnimation) {
            cancelAnimationFrame(this.currentAnimation);
            this.currentAnimation = null;
        }
        this.hidePencil();
    },

    clearCanvas() {
        const rect = this.canvasRect || this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
    },

    showPencil() {
        if (this.pencilEl) {
            this.pencilEl.style.opacity = '1';
        }
    },

    hidePencil() {
        if (this.pencilEl) {
            this.pencilEl.style.opacity = '0';
        }
    }
};
