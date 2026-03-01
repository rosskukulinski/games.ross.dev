// Drawing Path Definitions
// Each drawing contains paths that will be animated sequentially

const DRAWINGS = {
    house: {
        id: 'house',
        name: 'House',
        acceptedAnswers: ['house', 'home', 'a house', 'the house', 'houses'],
        paths: [
            // Main square body
            {
                type: 'polyline',
                points: [
                    {x: 100, y: 250}, {x: 100, y: 150}, {x: 300, y: 150}, {x: 300, y: 250}, {x: 100, y: 250}
                ],
                strokeColor: '#333',
                strokeWidth: 3
            },
            // Roof (triangle)
            {
                type: 'polyline',
                points: [
                    {x: 80, y: 150}, {x: 200, y: 60}, {x: 320, y: 150}
                ],
                strokeColor: '#333',
                strokeWidth: 3
            },
            // Door
            {
                type: 'polyline',
                points: [
                    {x: 170, y: 250}, {x: 170, y: 190}, {x: 230, y: 190}, {x: 230, y: 250}
                ],
                strokeColor: '#333',
                strokeWidth: 3
            },
            // Door knob
            {
                type: 'arc',
                centerX: 220,
                centerY: 220,
                radius: 5,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#333',
                strokeWidth: 2,
                pointCount: 20
            },
            // Left window
            {
                type: 'polyline',
                points: [
                    {x: 120, y: 180}, {x: 120, y: 210}, {x: 150, y: 210}, {x: 150, y: 180}, {x: 120, y: 180}
                ],
                strokeColor: '#333',
                strokeWidth: 2
            },
            // Right window
            {
                type: 'polyline',
                points: [
                    {x: 250, y: 180}, {x: 250, y: 210}, {x: 280, y: 210}, {x: 280, y: 180}, {x: 250, y: 180}
                ],
                strokeColor: '#333',
                strokeWidth: 2
            }
        ]
    },

    tree: {
        id: 'tree',
        name: 'Tree',
        acceptedAnswers: ['tree', 'a tree', 'the tree', 'trees'],
        paths: [
            // Trunk
            {
                type: 'polyline',
                points: [
                    {x: 180, y: 280}, {x: 180, y: 180}, {x: 220, y: 180}, {x: 220, y: 280}
                ],
                strokeColor: '#8B4513',
                strokeWidth: 3
            },
            // Foliage - bottom layer
            {
                type: 'arc',
                centerX: 200,
                centerY: 150,
                radius: 60,
                startAngle: Math.PI * 0.8,
                endAngle: Math.PI * 0.2,
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 40
            },
            // Foliage - middle bump left
            {
                type: 'arc',
                centerX: 160,
                centerY: 120,
                radius: 40,
                startAngle: Math.PI * 0.7,
                endAngle: Math.PI * 0.1,
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 30
            },
            // Foliage - middle bump right
            {
                type: 'arc',
                centerX: 240,
                centerY: 120,
                radius: 40,
                startAngle: Math.PI * 0.9,
                endAngle: Math.PI * 0.3,
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 30
            },
            // Foliage - top
            {
                type: 'arc',
                centerX: 200,
                centerY: 90,
                radius: 35,
                startAngle: Math.PI * 0.8,
                endAngle: Math.PI * 0.2,
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 30
            }
        ]
    },

    rainbow: {
        id: 'rainbow',
        name: 'Rainbow',
        acceptedAnswers: ['rainbow', 'a rainbow', 'the rainbow', 'rainbows'],
        paths: [
            // Red arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 150,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#FF0000',
                strokeWidth: 10,
                pointCount: 60
            },
            // Orange arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 130,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#FF7F00',
                strokeWidth: 10,
                pointCount: 55
            },
            // Yellow arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 110,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#FFFF00',
                strokeWidth: 10,
                pointCount: 50
            },
            // Green arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 90,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#00FF00',
                strokeWidth: 10,
                pointCount: 45
            },
            // Blue arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 70,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#0000FF',
                strokeWidth: 10,
                pointCount: 40
            },
            // Purple arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 280,
                radius: 50,
                startAngle: Math.PI,
                endAngle: Math.PI * 2,
                strokeColor: '#8B00FF',
                strokeWidth: 10,
                pointCount: 35
            }
        ]
    },

    sun: {
        id: 'sun',
        name: 'Sun',
        acceptedAnswers: ['sun', 'the sun', 'a sun'],
        paths: [
            // Circle
            {
                type: 'arc',
                centerX: 200,
                centerY: 150,
                radius: 50,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FFD700',
                strokeWidth: 4,
                pointCount: 50
            },
            // Ray 1 (up)
            {
                type: 'polyline',
                points: [{x: 200, y: 90}, {x: 200, y: 50}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 2 (up-right)
            {
                type: 'polyline',
                points: [{x: 235, y: 105}, {x: 265, y: 75}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 3 (right)
            {
                type: 'polyline',
                points: [{x: 260, y: 150}, {x: 300, y: 150}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 4 (down-right)
            {
                type: 'polyline',
                points: [{x: 235, y: 195}, {x: 265, y: 225}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 5 (down)
            {
                type: 'polyline',
                points: [{x: 200, y: 210}, {x: 200, y: 250}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 6 (down-left)
            {
                type: 'polyline',
                points: [{x: 165, y: 195}, {x: 135, y: 225}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 7 (left)
            {
                type: 'polyline',
                points: [{x: 140, y: 150}, {x: 100, y: 150}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            },
            // Ray 8 (up-left)
            {
                type: 'polyline',
                points: [{x: 165, y: 105}, {x: 135, y: 75}],
                strokeColor: '#FFD700',
                strokeWidth: 3
            }
        ]
    },

    star: {
        id: 'star',
        name: 'Star',
        acceptedAnswers: ['star', 'a star', 'the star', 'stars'],
        paths: [
            // 5-point star
            {
                type: 'polyline',
                points: [
                    {x: 200, y: 50},   // Top point
                    {x: 230, y: 130},  // Inner right
                    {x: 320, y: 130},  // Right point
                    {x: 250, y: 180},  // Inner lower right
                    {x: 280, y: 270},  // Bottom right point
                    {x: 200, y: 210},  // Inner bottom
                    {x: 120, y: 270},  // Bottom left point
                    {x: 150, y: 180},  // Inner lower left
                    {x: 80, y: 130},   // Left point
                    {x: 170, y: 130},  // Inner left
                    {x: 200, y: 50}    // Back to top
                ],
                strokeColor: '#FFD700',
                strokeWidth: 3
            }
        ]
    },

    heart: {
        id: 'heart',
        name: 'Heart',
        acceptedAnswers: ['heart', 'a heart', 'the heart', 'hearts', 'love'],
        paths: [
            // Left curve of heart
            {
                type: 'bezier',
                start: {x: 200, y: 100},
                control1: {x: 100, y: 50},
                control2: {x: 50, y: 150},
                end: {x: 200, y: 280},
                strokeColor: '#FF6B6B',
                strokeWidth: 4,
                pointCount: 60
            },
            // Right curve of heart
            {
                type: 'bezier',
                start: {x: 200, y: 100},
                control1: {x: 300, y: 50},
                control2: {x: 350, y: 150},
                end: {x: 200, y: 280},
                strokeColor: '#FF6B6B',
                strokeWidth: 4,
                pointCount: 60
            }
        ]
    },

    flower: {
        id: 'flower',
        name: 'Flower',
        acceptedAnswers: ['flower', 'a flower', 'the flower', 'flowers'],
        paths: [
            // Stem
            {
                type: 'polyline',
                points: [{x: 200, y: 180}, {x: 200, y: 280}],
                strokeColor: '#228B22',
                strokeWidth: 4
            },
            // Left leaf
            {
                type: 'bezier',
                start: {x: 200, y: 230},
                control1: {x: 150, y: 220},
                control2: {x: 140, y: 250},
                end: {x: 200, y: 240},
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 30
            },
            // Right leaf
            {
                type: 'bezier',
                start: {x: 200, y: 250},
                control1: {x: 250, y: 240},
                control2: {x: 260, y: 270},
                end: {x: 200, y: 260},
                strokeColor: '#228B22',
                strokeWidth: 3,
                pointCount: 30
            },
            // Center
            {
                type: 'arc',
                centerX: 200,
                centerY: 130,
                radius: 20,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FFD700',
                strokeWidth: 4,
                pointCount: 30
            },
            // Petal 1 (top)
            {
                type: 'arc',
                centerX: 200,
                centerY: 90,
                radius: 25,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FF69B4',
                strokeWidth: 3,
                pointCount: 30
            },
            // Petal 2 (right)
            {
                type: 'arc',
                centerX: 240,
                centerY: 130,
                radius: 25,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FF69B4',
                strokeWidth: 3,
                pointCount: 30
            },
            // Petal 3 (bottom)
            {
                type: 'arc',
                centerX: 200,
                centerY: 170,
                radius: 25,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FF69B4',
                strokeWidth: 3,
                pointCount: 30
            },
            // Petal 4 (left)
            {
                type: 'arc',
                centerX: 160,
                centerY: 130,
                radius: 25,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FF69B4',
                strokeWidth: 3,
                pointCount: 30
            }
        ]
    },

    ball: {
        id: 'ball',
        name: 'Ball',
        acceptedAnswers: ['ball', 'a ball', 'the ball', 'balls', 'circle'],
        paths: [
            // Main circle
            {
                type: 'arc',
                centerX: 200,
                centerY: 160,
                radius: 80,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#E74C3C',
                strokeWidth: 4,
                pointCount: 60
            },
            // Curved line 1
            {
                type: 'arc',
                centerX: 200,
                centerY: 160,
                radius: 80,
                startAngle: Math.PI * 0.3,
                endAngle: Math.PI * 0.7,
                strokeColor: '#333',
                strokeWidth: 2,
                pointCount: 20
            },
            // Curved line 2
            {
                type: 'arc',
                centerX: 200,
                centerY: 160,
                radius: 80,
                startAngle: Math.PI * 1.3,
                endAngle: Math.PI * 1.7,
                strokeColor: '#333',
                strokeWidth: 2,
                pointCount: 20
            }
        ]
    },

    flag: {
        id: 'flag',
        name: 'Flag',
        acceptedAnswers: ['flag', 'a flag', 'the flag', 'flags'],
        paths: [
            // Pole
            {
                type: 'polyline',
                points: [{x: 120, y: 50}, {x: 120, y: 280}],
                strokeColor: '#8B4513',
                strokeWidth: 5
            },
            // Flag rectangle
            {
                type: 'polyline',
                points: [
                    {x: 120, y: 60}, {x: 300, y: 60}, {x: 300, y: 160}, {x: 120, y: 160}
                ],
                strokeColor: '#E74C3C',
                strokeWidth: 3
            },
            // Flag wave line 1
            {
                type: 'bezier',
                start: {x: 140, y: 110},
                control1: {x: 180, y: 90},
                control2: {x: 220, y: 130},
                end: {x: 280, y: 110},
                strokeColor: '#FFF',
                strokeWidth: 3,
                pointCount: 40
            },
            // Pole ball top
            {
                type: 'arc',
                centerX: 120,
                centerY: 50,
                radius: 8,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#FFD700',
                strokeWidth: 3,
                pointCount: 20
            }
        ]
    },

    hat: {
        id: 'hat',
        name: 'Hat',
        acceptedAnswers: ['hat', 'a hat', 'the hat', 'hats', 'cap'],
        paths: [
            // Brim (ellipse-like)
            {
                type: 'arc',
                centerX: 200,
                centerY: 200,
                radiusX: 140,
                radiusY: 30,
                startAngle: 0,
                endAngle: Math.PI * 2,
                strokeColor: '#333',
                strokeWidth: 3,
                pointCount: 60,
                isEllipse: true
            },
            // Top dome
            {
                type: 'bezier',
                start: {x: 100, y: 200},
                control1: {x: 100, y: 80},
                control2: {x: 300, y: 80},
                end: {x: 300, y: 200},
                strokeColor: '#333',
                strokeWidth: 3,
                pointCount: 50
            },
            // Band
            {
                type: 'polyline',
                points: [{x: 100, y: 180}, {x: 300, y: 180}],
                strokeColor: '#E74C3C',
                strokeWidth: 8
            }
        ]
    }
};

// Helper to get all drawing IDs
function getDrawingIds() {
    return Object.keys(DRAWINGS);
}

// Helper to get a random drawing
function getRandomDrawing(exclude = []) {
    const available = getDrawingIds().filter(id => !exclude.includes(id));
    if (available.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * available.length);
    return DRAWINGS[available[randomIndex]];
}
