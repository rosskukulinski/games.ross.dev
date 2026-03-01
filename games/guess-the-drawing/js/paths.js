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
                centerY: 250,
                radius: 150,
                startAngle: Math.PI,
                endAngle: 0,
                strokeColor: '#FF0000',
                strokeWidth: 10,
                pointCount: 60
            },
            // Orange arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 250,
                radius: 130,
                startAngle: Math.PI,
                endAngle: 0,
                strokeColor: '#FF7F00',
                strokeWidth: 10,
                pointCount: 55
            },
            // Yellow arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 250,
                radius: 110,
                startAngle: Math.PI,
                endAngle: 0,
                strokeColor: '#FFFF00',
                strokeWidth: 10,
                pointCount: 50
            },
            // Green arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 250,
                radius: 90,
                startAngle: Math.PI,
                endAngle: 0,
                strokeColor: '#00FF00',
                strokeWidth: 10,
                pointCount: 45
            },
            // Blue arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 250,
                radius: 70,
                startAngle: Math.PI,
                endAngle: 0,
                strokeColor: '#0000FF',
                strokeWidth: 10,
                pointCount: 40
            },
            // Purple arc
            {
                type: 'arc',
                centerX: 200,
                centerY: 250,
                radius: 50,
                startAngle: Math.PI,
                endAngle: 0,
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
    },

    cat: {
        id: 'cat',
        name: 'Cat',
        acceptedAnswers: ['cat', 'a cat', 'the cat', 'cats', 'kitty', 'kitten'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 155, radius: 65, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 3, pointCount: 60 },
            { type: 'polyline', points: [{x:148,y:105},{x:168,y:60},{x:196,y:105}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:204,y:105},{x:232,y:60},{x:252,y:105}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'arc', centerX: 175, centerY: 140, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 225, centerY: 140, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'polyline', points: [{x:194,y:162},{x:200,y:170},{x:206,y:162}], strokeColor: '#FF69B4', strokeWidth: 3 },
            { type: 'polyline', points: [{x:118,y:158},{x:193,y:162}], strokeColor: '#777', strokeWidth: 1 },
            { type: 'polyline', points: [{x:118,y:168},{x:193,y:168}], strokeColor: '#777', strokeWidth: 1 },
            { type: 'polyline', points: [{x:207,y:162},{x:282,y:158}], strokeColor: '#777', strokeWidth: 1 },
            { type: 'polyline', points: [{x:207,y:168},{x:282,y:168}], strokeColor: '#777', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:170},{x:186,y:180}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:170},{x:214,y:180}], strokeColor: '#555', strokeWidth: 3 }
        ]
    },

    dog: {
        id: 'dog',
        name: 'Dog',
        acceptedAnswers: ['dog', 'a dog', 'the dog', 'dogs', 'puppy', 'doggy'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 145, radius: 60, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#8B6914', strokeWidth: 3, pointCount: 60 },
            { type: 'bezier', start: {x:148,y:118}, control1: {x:95,y:130}, control2: {x:100,y:195}, end: {x:152,y:192}, strokeColor: '#6B4F10', strokeWidth: 4, pointCount: 40 },
            { type: 'bezier', start: {x:252,y:118}, control1: {x:305,y:130}, control2: {x:300,y:195}, end: {x:248,y:192}, strokeColor: '#6B4F10', strokeWidth: 4, pointCount: 40 },
            { type: 'arc', centerX: 175, centerY: 125, radius: 8, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 225, centerY: 125, radius: 8, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 152, radiusX: 15, radiusY: 10, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 30, isEllipse: true },
            { type: 'polyline', points: [{x:185,y:168},{x:200,y:180},{x:215,y:168}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 186, radius: 10, startAngle: Math.PI, endAngle: 0, strokeColor: '#FF69B4', strokeWidth: 3, pointCount: 20 }
        ]
    },

    fish: {
        id: 'fish',
        name: 'Fish',
        acceptedAnswers: ['fish', 'a fish', 'the fish', 'fishes'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 155, radiusX: 88, radiusY: 48, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#4169E1', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'polyline', points: [{x:112,y:155},{x:68,y:115},{x:68,y:195},{x:112,y:155}], strokeColor: '#4169E1', strokeWidth: 3 },
            { type: 'arc', centerX: 260, centerY: 138, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 20 },
            { type: 'bezier', start: {x:160,y:112}, control1: {x:195,y:68}, control2: {x:232,y:68}, end: {x:242,y:112}, strokeColor: '#4169E1', strokeWidth: 2, pointCount: 30 },
            { type: 'bezier', start: {x:218,y:122}, control1: {x:205,y:140}, control2: {x:205,y:172}, end: {x:218,y:188}, strokeColor: '#4169E1', strokeWidth: 2, pointCount: 30 }
        ]
    },

    bird: {
        id: 'bird',
        name: 'Bird',
        acceptedAnswers: ['bird', 'a bird', 'the bird', 'birds'],
        paths: [
            { type: 'arc', centerX: 195, centerY: 162, radiusX: 55, radiusY: 27, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E67E22', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'arc', centerX: 248, centerY: 140, radius: 23, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E67E22', strokeWidth: 3, pointCount: 30 },
            { type: 'polyline', points: [{x:264,y:133},{x:293,y:140},{x:264,y:147}], strokeColor: '#FFD700', strokeWidth: 3 },
            { type: 'arc', centerX: 255, centerY: 134, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 15 },
            { type: 'bezier', start: {x:165,y:152}, control1: {x:195,y:108}, control2: {x:235,y:118}, end: {x:242,y:158}, strokeColor: '#C0392B', strokeWidth: 2, pointCount: 30 },
            { type: 'polyline', points: [{x:140,y:162},{x:100,y:147},{x:140,y:177}], strokeColor: '#E67E22', strokeWidth: 3 }
        ]
    },

    rabbit: {
        id: 'rabbit',
        name: 'Rabbit',
        acceptedAnswers: ['rabbit', 'a rabbit', 'the rabbit', 'rabbits', 'bunny', 'bunny rabbit'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 172, radius: 55, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#999', strokeWidth: 3, pointCount: 60 },
            { type: 'bezier', start: {x:180,y:126}, control1: {x:162,y:88}, control2: {x:162,y:45}, end: {x:185,y:45}, strokeColor: '#999', strokeWidth: 3, pointCount: 40 },
            { type: 'bezier', start: {x:185,y:45}, control1: {x:186,y:62}, control2: {x:183,y:98}, end: {x:183,y:128}, strokeColor: '#999', strokeWidth: 3, pointCount: 40 },
            { type: 'bezier', start: {x:215,y:126}, control1: {x:233,y:88}, control2: {x:230,y:45}, end: {x:212,y:45}, strokeColor: '#999', strokeWidth: 3, pointCount: 40 },
            { type: 'bezier', start: {x:212,y:45}, control1: {x:214,y:62}, control2: {x:217,y:98}, end: {x:217,y:128}, strokeColor: '#999', strokeWidth: 3, pointCount: 40 },
            { type: 'arc', centerX: 178, centerY: 160, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 222, centerY: 160, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 175, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FF69B4', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:200,y:180},{x:190,y:190}], strokeColor: '#999', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:180},{x:210,y:190}], strokeColor: '#999', strokeWidth: 3 }
        ]
    },

    elephant: {
        id: 'elephant',
        name: 'Elephant',
        acceptedAnswers: ['elephant', 'an elephant', 'the elephant', 'elephants'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 192, radiusX: 85, radiusY: 58, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#888', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'arc', centerX: 278, centerY: 148, radius: 45, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#888', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:312,y:168}, control1: {x:348,y:200}, control2: {x:342,y:242}, end: {x:308,y:250}, strokeColor: '#888', strokeWidth: 3, pointCount: 40 },
            { type: 'bezier', start: {x:308,y:250}, control1: {x:282,y:258}, control2: {x:272,y:238}, end: {x:285,y:242}, strokeColor: '#888', strokeWidth: 2, pointCount: 30 },
            { type: 'arc', centerX: 248, centerY: 148, radiusX: 38, radiusY: 42, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#777', strokeWidth: 2, pointCount: 50, isEllipse: true },
            { type: 'arc', centerX: 278, centerY: 135, radius: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:258,y:248},{x:258,y:292}], strokeColor: '#888', strokeWidth: 4 },
            { type: 'polyline', points: [{x:278,y:248},{x:278,y:292}], strokeColor: '#888', strokeWidth: 4 },
            { type: 'polyline', points: [{x:148,y:248},{x:148,y:292}], strokeColor: '#888', strokeWidth: 4 },
            { type: 'polyline', points: [{x:168,y:248},{x:168,y:292}], strokeColor: '#888', strokeWidth: 4 },
            { type: 'polyline', points: [{x:115,y:192},{x:95,y:182},{x:90,y:195}], strokeColor: '#888', strokeWidth: 3 }
        ]
    },

    snake: {
        id: 'snake',
        name: 'Snake',
        acceptedAnswers: ['snake', 'a snake', 'the snake', 'snakes', 'serpent'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 68, radiusX: 20, radiusY: 13, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#228B22', strokeWidth: 3, pointCount: 30, isEllipse: true },
            { type: 'bezier', start: {x:215,y:72}, control1: {x:282,y:78}, control2: {x:282,y:152}, end: {x:215,y:158}, strokeColor: '#228B22', strokeWidth: 5, pointCount: 50 },
            { type: 'bezier', start: {x:215,y:158}, control1: {x:148,y:162}, control2: {x:148,y:235}, end: {x:215,y:242}, strokeColor: '#228B22', strokeWidth: 5, pointCount: 50 },
            { type: 'polyline', points: [{x:200,y:60},{x:200,y:50}], strokeColor: '#CC0000', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:50},{x:194,y:44}], strokeColor: '#CC0000', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:50},{x:206,y:44}], strokeColor: '#CC0000', strokeWidth: 2 },
            { type: 'arc', centerX: 210, centerY: 62, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 15 }
        ]
    },

    butterfly: {
        id: 'butterfly',
        name: 'Butterfly',
        acceptedAnswers: ['butterfly', 'a butterfly', 'the butterfly', 'butterflies'],
        paths: [
            { type: 'bezier', start: {x:205,y:140}, control1: {x:298,y:58}, control2: {x:308,y:142}, end: {x:210,y:155}, strokeColor: '#9B59B6', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:210,y:155}, control1: {x:298,y:168}, control2: {x:268,y:228}, end: {x:205,y:170}, strokeColor: '#9B59B6', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:195,y:140}, control1: {x:102,y:58}, control2: {x:92,y:142}, end: {x:190,y:155}, strokeColor: '#9B59B6', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:190,y:155}, control1: {x:102,y:168}, control2: {x:132,y:228}, end: {x:195,y:170}, strokeColor: '#9B59B6', strokeWidth: 3, pointCount: 50 },
            { type: 'arc', centerX: 200, centerY: 155, radiusX: 7, radiusY: 40, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 30, isEllipse: true },
            { type: 'bezier', start: {x:197,y:118}, control1: {x:175,y:93}, control2: {x:165,y:78}, end: {x:168,y:72}, strokeColor: '#333', strokeWidth: 2, pointCount: 30 },
            { type: 'bezier', start: {x:203,y:118}, control1: {x:225,y:93}, control2: {x:235,y:78}, end: {x:232,y:72}, strokeColor: '#333', strokeWidth: 2, pointCount: 30 },
            { type: 'arc', centerX: 168, centerY: 72, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 232, centerY: 72, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 15 }
        ]
    },

    spider: {
        id: 'spider',
        name: 'Spider',
        acceptedAnswers: ['spider', 'a spider', 'the spider', 'spiders'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 168, radius: 25, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 30 },
            { type: 'arc', centerX: 200, centerY: 128, radius: 16, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 25 },
            { type: 'polyline', points: [{x:183,y:140},{x:122,y:108}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:182,y:153},{x:112,y:148}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:182,y:165},{x:115,y:178}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:183,y:175},{x:125,y:210}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:217,y:140},{x:278,y:108}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:218,y:153},{x:288,y:148}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:218,y:165},{x:285,y:178}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:217,y:175},{x:275,y:210}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'arc', centerX: 194, centerY: 122, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 206, centerY: 122, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 2, pointCount: 15 }
        ]
    },

    whale: {
        id: 'whale',
        name: 'Whale',
        acceptedAnswers: ['whale', 'a whale', 'the whale', 'whales'],
        paths: [
            { type: 'arc', centerX: 192, centerY: 155, radiusX: 115, radiusY: 58, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#2980B9', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'bezier', start: {x:307,y:155}, control1: {x:345,y:128}, control2: {x:352,y:118}, end: {x:330,y:138}, strokeColor: '#2980B9', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:307,y:155}, control1: {x:345,y:180}, control2: {x:352,y:190}, end: {x:330,y:170}, strokeColor: '#2980B9', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:235,y:97}, control1: {x:252,y:55}, control2: {x:272,y:62}, end: {x:272,y:97}, strokeColor: '#2980B9', strokeWidth: 3, pointCount: 30 },
            { type: 'arc', centerX: 282, centerY: 138, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 82, centerY: 155, radius: 15, startAngle: -0.4, endAngle: 0.4, strokeColor: '#2980B9', strokeWidth: 3, pointCount: 20 },
            { type: 'bezier', start: {x:192,y:97}, control1: {x:185,y:68}, control2: {x:178,y:52}, end: {x:182,y:42}, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 30 },
            { type: 'bezier', start: {x:192,y:97}, control1: {x:198,y:68}, control2: {x:205,y:52}, end: {x:202,y:42}, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 30 }
        ]
    },

    car: {
        id: 'car',
        name: 'Car',
        acceptedAnswers: ['car', 'a car', 'the car', 'cars', 'automobile', 'vehicle'],
        paths: [
            { type: 'polyline', points: [{x:75,y:195},{x:75,y:225},{x:325,y:225},{x:325,y:195},{x:290,y:170},{x:255,y:155},{x:165,y:155},{x:130,y:170},{x:75,y:195}], strokeColor: '#E74C3C', strokeWidth: 3 },
            { type: 'polyline', points: [{x:145,y:170},{x:162,y:158},{x:248,y:158},{x:268,y:172},{x:145,y:172}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'arc', centerX: 135, centerY: 225, radius: 30, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 4, pointCount: 40 },
            { type: 'arc', centerX: 265, centerY: 225, radius: 30, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 4, pointCount: 40 },
            { type: 'arc', centerX: 312, centerY: 188, radius: 8, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 88, centerY: 205, radius: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:200,y:170},{x:200,y:220}], strokeColor: '#CC0000', strokeWidth: 2 },
            { type: 'polyline', points: [{x:208,y:198},{x:220,y:198}], strokeColor: '#FFD700', strokeWidth: 2 }
        ]
    },

    sailboat: {
        id: 'sailboat',
        name: 'Sailboat',
        acceptedAnswers: ['sailboat', 'a sailboat', 'the sailboat', 'sailboats', 'boat', 'sailing boat', 'sail boat'],
        paths: [
            { type: 'polyline', points: [{x:80,y:215},{x:78,y:228},{x:322,y:228},{x:320,y:215},{x:80,y:215}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:215},{x:200,y:62}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:72},{x:200,y:212},{x:315,y:212},{x:200,y:72}], strokeColor: '#F5F5DC', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:88},{x:200,y:212},{x:108,y:212},{x:200,y:88}], strokeColor: '#F5F5DC', strokeWidth: 2 },
            { type: 'polyline', points: [{x:50,y:232},{x:350,y:232}], strokeColor: '#2980B9', strokeWidth: 4 },
            { type: 'polyline', points: [{x:200,y:62},{x:220,y:70},{x:200,y:78}], strokeColor: '#E74C3C', strokeWidth: 2 }
        ]
    },

    airplane: {
        id: 'airplane',
        name: 'Airplane',
        acceptedAnswers: ['airplane', 'an airplane', 'the airplane', 'airplanes', 'plane', 'aeroplane', 'jet'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 158, radiusX: 112, radiusY: 20, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#BDC3C7', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'polyline', points: [{x:172,y:165},{x:145,y:212},{x:285,y:212},{x:248,y:165}], strokeColor: '#95A5A6', strokeWidth: 3 },
            { type: 'polyline', points: [{x:92,y:150},{x:85,y:115},{x:112,y:138},{x:112,y:152}], strokeColor: '#95A5A6', strokeWidth: 3 },
            { type: 'polyline', points: [{x:92,y:158},{x:68,y:178},{x:112,y:178}], strokeColor: '#95A5A6', strokeWidth: 3 },
            { type: 'arc', centerX: 175, centerY: 155, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 155, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 225, centerY: 155, radius: 7, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 310, centerY: 158, radius: 8, startAngle: Math.PI * 1.5, endAngle: Math.PI * 0.5, strokeColor: '#BDC3C7', strokeWidth: 3, pointCount: 20 }
        ]
    },

    bicycle: {
        id: 'bicycle',
        name: 'Bicycle',
        acceptedAnswers: ['bicycle', 'a bicycle', 'the bicycle', 'bicycles', 'bike', 'a bike', 'the bike'],
        paths: [
            { type: 'arc', centerX: 128, centerY: 205, radius: 52, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 50 },
            { type: 'arc', centerX: 270, centerY: 205, radius: 52, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 50 },
            { type: 'polyline', points: [{x:128,y:205},{x:208,y:205}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:208,y:205},{x:198,y:145}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:198,y:145},{x:128,y:205}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:198,y:145},{x:265,y:162}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:265,y:162},{x:208,y:205}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:265,y:162},{x:270,y:205}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:182,y:145},{x:218,y:145}], strokeColor: '#333', strokeWidth: 4 },
            { type: 'polyline', points: [{x:265,y:162},{x:268,y:148},{x:280,y:148},{x:280,y:165}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'arc', centerX: 208, centerY: 205, radius: 8, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#777', strokeWidth: 2, pointCount: 20 }
        ]
    },

    rocket: {
        id: 'rocket',
        name: 'Rocket',
        acceptedAnswers: ['rocket', 'a rocket', 'the rocket', 'rockets', 'rocket ship', 'spaceship'],
        paths: [
            { type: 'polyline', points: [{x:185,y:80},{x:200,y:38},{x:215,y:80}], strokeColor: '#E74C3C', strokeWidth: 3 },
            { type: 'polyline', points: [{x:185,y:80},{x:185,y:222},{x:215,y:222},{x:215,y:80}], strokeColor: '#BDC3C7', strokeWidth: 3 },
            { type: 'polyline', points: [{x:185,y:222},{x:158,y:268},{x:185,y:252}], strokeColor: '#E74C3C', strokeWidth: 3 },
            { type: 'polyline', points: [{x:215,y:222},{x:242,y:268},{x:215,y:252}], strokeColor: '#E74C3C', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 140, radius: 18, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#87CEEB', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:193,y:222}, control1: {x:185,y:248}, control2: {x:182,y:265}, end: {x:200,y:258}, strokeColor: '#FF4500', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:200,y:222}, control1: {x:194,y:255}, control2: {x:206,y:282}, end: {x:200,y:285}, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:207,y:222}, control1: {x:215,y:248}, control2: {x:218,y:265}, end: {x:200,y:258}, strokeColor: '#FF4500', strokeWidth: 3, pointCount: 30 }
        ]
    },

    train: {
        id: 'train',
        name: 'Train',
        acceptedAnswers: ['train', 'a train', 'the train', 'trains', 'steam engine', 'locomotive'],
        paths: [
            { type: 'polyline', points: [{x:232,y:158},{x:232,y:218},{x:312,y:218},{x:312,y:158},{x:232,y:158}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:242,y:165},{x:242,y:195},{x:302,y:195},{x:302,y:165},{x:242,y:165}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:152,y:172},{x:152,y:218},{x:242,y:218},{x:242,y:172},{x:152,y:172}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'arc', centerX: 152, centerY: 195, radius: 23, startAngle: Math.PI * 0.5, endAngle: Math.PI * 1.5, strokeColor: '#555', strokeWidth: 3, pointCount: 30 },
            { type: 'polyline', points: [{x:188,y:152},{x:188,y:172},{x:202,y:172},{x:202,y:152}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:185,y:152},{x:205,y:152}], strokeColor: '#333', strokeWidth: 4 },
            { type: 'arc', centerX: 188, centerY: 222, radius: 30, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 40 },
            { type: 'arc', centerX: 135, centerY: 222, radius: 18, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 30 },
            { type: 'arc', centerX: 268, centerY: 222, radius: 18, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 30 },
            { type: 'arc', centerX: 298, centerY: 222, radius: 18, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 30 },
            { type: 'polyline', points: [{x:128,y:218},{x:118,y:228},{x:148,y:218}], strokeColor: '#555', strokeWidth: 2 },
            { type: 'polyline', points: [{x:312,y:215},{x:328,y:215}], strokeColor: '#555', strokeWidth: 4 }
        ]
    },

    guitar: {
        id: 'guitar',
        name: 'Guitar',
        acceptedAnswers: ['guitar', 'a guitar', 'the guitar', 'guitars', 'acoustic guitar'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 232, radiusX: 72, radiusY: 65, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#8B4513', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'arc', centerX: 200, centerY: 158, radiusX: 52, radiusY: 48, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#8B4513', strokeWidth: 3, pointCount: 50, isEllipse: true },
            { type: 'polyline', points: [{x:148,y:178},{x:148,y:208}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:252,y:178},{x:252,y:208}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:184,y:110},{x:184,y:62},{x:216,y:62},{x:216,y:110}], strokeColor: '#DEB887', strokeWidth: 3 },
            { type: 'polyline', points: [{x:178,y:62},{x:178,y:42},{x:222,y:42},{x:222,y:62}], strokeColor: '#DEB887', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 210, radius: 24, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#5C3317', strokeWidth: 3, pointCount: 35 },
            { type: 'polyline', points: [{x:174,y:255},{x:226,y:255}], strokeColor: '#333', strokeWidth: 4 },
            { type: 'polyline', points: [{x:192,y:255},{x:190,y:62}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:196,y:255},{x:196,y:62}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:255},{x:200,y:62}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:204,y:255},{x:204,y:62}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:208,y:255},{x:210,y:62}], strokeColor: '#888', strokeWidth: 1 }
        ]
    },

    umbrella: {
        id: 'umbrella',
        name: 'Umbrella',
        acceptedAnswers: ['umbrella', 'an umbrella', 'the umbrella', 'umbrellas', 'parasol'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 178, radius: 122, startAngle: Math.PI, endAngle: 0, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 60 },
            { type: 'polyline', points: [{x:200,y:178},{x:200,y:56}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:178},{x:268,y:118}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:178},{x:322,y:178}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:178},{x:132,y:118}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:178},{x:78,y:178}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:178},{x:200,y:258}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'bezier', start: {x:200,y:258}, control1: {x:200,y:282}, control2: {x:178,y:282}, end: {x:175,y:265}, strokeColor: '#8B4513', strokeWidth: 3, pointCount: 30 }
        ]
    },

    key: {
        id: 'key',
        name: 'Key',
        acceptedAnswers: ['key', 'a key', 'the key', 'keys'],
        paths: [
            { type: 'arc', centerX: 170, centerY: 130, radius: 40, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 40 },
            { type: 'polyline', points: [{x:210,y:130},{x:305,y:130}], strokeColor: '#FFD700', strokeWidth: 4 },
            { type: 'polyline', points: [{x:235,y:130},{x:235,y:150}], strokeColor: '#FFD700', strokeWidth: 4 },
            { type: 'polyline', points: [{x:260,y:130},{x:260,y:158}], strokeColor: '#FFD700', strokeWidth: 4 },
            { type: 'polyline', points: [{x:285,y:130},{x:285,y:142}], strokeColor: '#FFD700', strokeWidth: 4 },
            { type: 'arc', centerX: 170, centerY: 130, radius: 18, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 2, pointCount: 25 }
        ]
    },

    crown: {
        id: 'crown',
        name: 'Crown',
        acceptedAnswers: ['crown', 'a crown', 'the crown', 'crowns', 'tiara'],
        paths: [
            { type: 'polyline', points: [{x:78,y:228},{x:78,y:178},{x:322,y:178},{x:322,y:228},{x:78,y:228}], strokeColor: '#FFD700', strokeWidth: 3 },
            { type: 'polyline', points: [{x:78,y:178},{x:138,y:108},{x:192,y:178},{x:200,y:102},{x:208,y:178},{x:262,y:108},{x:322,y:178}], strokeColor: '#FFD700', strokeWidth: 3 },
            { type: 'arc', centerX: 138, centerY: 130, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E74C3C', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 122, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#2980B9', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 262, centerY: 130, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#27AE60', strokeWidth: 2, pointCount: 20 }
        ]
    },

    anchor: {
        id: 'anchor',
        name: 'Anchor',
        acceptedAnswers: ['anchor', 'an anchor', 'the anchor', 'anchors'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 80, radius: 26, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 3, pointCount: 35 },
            { type: 'polyline', points: [{x:148,y:110},{x:252,y:110}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:106},{x:200,y:255}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'bezier', start: {x:200,y:255}, control1: {x:200,y:278}, control2: {x:143,y:272}, end: {x:138,y:250}, strokeColor: '#555', strokeWidth: 3, pointCount: 40 },
            { type: 'bezier', start: {x:200,y:255}, control1: {x:200,y:278}, control2: {x:257,y:272}, end: {x:262,y:250}, strokeColor: '#555', strokeWidth: 3, pointCount: 40 },
            { type: 'polyline', points: [{x:200,y:106},{x:200,y:54},{x:174,y:54}], strokeColor: '#777', strokeWidth: 2 }
        ]
    },

    sword: {
        id: 'sword',
        name: 'Sword',
        acceptedAnswers: ['sword', 'a sword', 'the sword', 'swords'],
        paths: [
            { type: 'polyline', points: [{x:196,y:235},{x:196,y:90},{x:200,y:48},{x:204,y:90},{x:204,y:235}], strokeColor: '#BDC3C7', strokeWidth: 3 },
            { type: 'polyline', points: [{x:148,y:238},{x:252,y:238}], strokeColor: '#8B4513', strokeWidth: 5 },
            { type: 'polyline', points: [{x:191,y:238},{x:191,y:278},{x:209,y:278},{x:209,y:238}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 290, radius: 14, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 25 },
            { type: 'polyline', points: [{x:200,y:90},{x:200,y:238}], strokeColor: '#999', strokeWidth: 1 }
        ]
    },

    glasses: {
        id: 'glasses',
        name: 'Glasses',
        acceptedAnswers: ['glasses', 'spectacles', 'eyeglasses', 'a pair of glasses', 'sunglasses'],
        paths: [
            { type: 'arc', centerX: 152, centerY: 155, radius: 40, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 40 },
            { type: 'arc', centerX: 248, centerY: 155, radius: 40, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 40 },
            { type: 'polyline', points: [{x:192,y:155},{x:208,y:155}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'bezier', start: {x:112,y:155}, control1: {x:82,y:155}, control2: {x:72,y:162}, end: {x:68,y:170}, strokeColor: '#333', strokeWidth: 3, pointCount: 25 },
            { type: 'bezier', start: {x:288,y:155}, control1: {x:318,y:155}, control2: {x:328,y:162}, end: {x:332,y:170}, strokeColor: '#333', strokeWidth: 3, pointCount: 25 }
        ]
    },

    clock: {
        id: 'clock',
        name: 'Clock',
        acceptedAnswers: ['clock', 'a clock', 'the clock', 'clocks', 'watch'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 150, radius: 105, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 4, pointCount: 60 },
            { type: 'arc', centerX: 200, centerY: 150, radius: 95, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 1, pointCount: 60 },
            { type: 'polyline', points: [{x:200,y:150},{x:158,y:108}], strokeColor: '#333', strokeWidth: 5 },
            { type: 'polyline', points: [{x:200,y:150},{x:240,y:108}], strokeColor: '#333', strokeWidth: 4 },
            { type: 'arc', centerX: 200, centerY: 150, radius: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 20 },
            { type: 'polyline', points: [{x:200,y:50},{x:200,y:62}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:300,y:150},{x:288,y:150}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:248},{x:200,y:236}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:100,y:150},{x:112,y:150}], strokeColor: '#333', strokeWidth: 3 }
        ]
    },

    phone: {
        id: 'phone',
        name: 'Phone',
        acceptedAnswers: ['phone', 'a phone', 'the phone', 'phones', 'smartphone', 'cell phone', 'mobile phone', 'mobile'],
        paths: [
            { type: 'polyline', points: [{x:148,y:52},{x:148,y:282},{x:252,y:282},{x:252,y:52},{x:148,y:52}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:158,y:82},{x:158,y:258},{x:242,y:258},{x:242,y:82},{x:158,y:82}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'arc', centerX: 200, centerY: 68, radius: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 200, centerY: 270, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 2, pointCount: 20 },
            { type: 'polyline', points: [{x:185,y:72},{x:215,y:72}], strokeColor: '#555', strokeWidth: 3 }
        ]
    },

    pencil: {
        id: 'pencil',
        name: 'Pencil',
        acceptedAnswers: ['pencil', 'a pencil', 'the pencil', 'pencils'],
        paths: [
            { type: 'polyline', points: [{x:182,y:72},{x:182,y:248},{x:218,y:248},{x:218,y:72},{x:182,y:72}], strokeColor: '#FFD700', strokeWidth: 3 },
            { type: 'polyline', points: [{x:182,y:72},{x:218,y:72},{x:218,y:92},{x:182,y:92}], strokeColor: '#FF69B4', strokeWidth: 3 },
            { type: 'polyline', points: [{x:182,y:92},{x:218,y:92},{x:218,y:108},{x:182,y:108}], strokeColor: '#888', strokeWidth: 3 },
            { type: 'polyline', points: [{x:182,y:248},{x:200,y:278},{x:218,y:248}], strokeColor: '#DEB887', strokeWidth: 3 },
            { type: 'polyline', points: [{x:195,y:268},{x:200,y:278},{x:205,y:268}], strokeColor: '#333', strokeWidth: 2 }
        ]
    },

    book: {
        id: 'book',
        name: 'Book',
        acceptedAnswers: ['book', 'a book', 'the book', 'books', 'open book'],
        paths: [
            { type: 'polyline', points: [{x:98,y:95},{x:98,y:258},{x:200,y:268},{x:200,y:95},{x:98,y:95}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:95},{x:200,y:268},{x:302,y:258},{x:302,y:95},{x:200,y:95}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:95},{x:200,y:268}], strokeColor: '#8B4513', strokeWidth: 4 },
            { type: 'polyline', points: [{x:110,y:118},{x:190,y:118}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:110,y:132},{x:190,y:132}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:110,y:146},{x:190,y:146}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:110,y:160},{x:190,y:160}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:110,y:174},{x:190,y:174}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:210,y:118},{x:292,y:118}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:210,y:132},{x:292,y:132}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:210,y:146},{x:292,y:146}], strokeColor: '#888', strokeWidth: 1 },
            { type: 'polyline', points: [{x:210,y:160},{x:292,y:160}], strokeColor: '#888', strokeWidth: 1 }
        ]
    },

    diamond: {
        id: 'diamond',
        name: 'Diamond',
        acceptedAnswers: ['diamond', 'a diamond', 'the diamond', 'diamonds', 'gem', 'jewel'],
        paths: [
            { type: 'polyline', points: [{x:153,y:102},{x:200,y:78},{x:247,y:102}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:128,y:145},{x:153,y:102},{x:247,y:102},{x:272,y:145},{x:128,y:145}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:128,y:145},{x:200,y:252},{x:272,y:145}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:78},{x:128,y:145}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:78},{x:272,y:145}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:145},{x:200,y:252}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:128,y:145},{x:272,y:145}], strokeColor: '#87CEEB', strokeWidth: 2 }
        ]
    },

    camera: {
        id: 'camera',
        name: 'Camera',
        acceptedAnswers: ['camera', 'a camera', 'the camera', 'cameras'],
        paths: [
            { type: 'polyline', points: [{x:88,y:128},{x:88,y:248},{x:312,y:248},{x:312,y:128},{x:88,y:128}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'arc', centerX: 195, centerY: 192, radius: 45, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#555', strokeWidth: 3, pointCount: 40 },
            { type: 'arc', centerX: 195, centerY: 192, radius: 32, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 2, pointCount: 35 },
            { type: 'arc', centerX: 195, centerY: 192, radius: 22, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#87CEEB', strokeWidth: 2, pointCount: 30 },
            { type: 'polyline', points: [{x:94,y:135},{x:94,y:155},{x:122,y:155},{x:122,y:135},{x:94,y:135}], strokeColor: '#FFD700', strokeWidth: 2 },
            { type: 'polyline', points: [{x:238,y:132},{x:238,y:150},{x:302,y:150},{x:302,y:132},{x:238,y:132}], strokeColor: '#555', strokeWidth: 2 },
            { type: 'arc', centerX: 158, centerY: 122, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 }
        ]
    },

    candle: {
        id: 'candle',
        name: 'Candle',
        acceptedAnswers: ['candle', 'a candle', 'the candle', 'candles'],
        paths: [
            { type: 'polyline', points: [{x:182,y:132},{x:182,y:262},{x:218,y:262},{x:218,y:132},{x:182,y:132}], strokeColor: '#FFFACD', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:132},{x:200,y:118}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'bezier', start: {x:200,y:122}, control1: {x:184,y:115}, control2: {x:182,y:95}, end: {x:200,y:76}, strokeColor: '#FF4500', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:200,y:76}, control1: {x:218,y:95}, control2: {x:216,y:115}, end: {x:200,y:122}, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:185,y:148}, control1: {x:182,y:158}, control2: {x:178,y:165}, end: {x:180,y:170}, strokeColor: '#FFFACD', strokeWidth: 3, pointCount: 20 },
            { type: 'polyline', points: [{x:182,y:172},{x:218,y:172}], strokeColor: '#FFD700', strokeWidth: 2 }
        ]
    },

    mountain: {
        id: 'mountain',
        name: 'Mountain',
        acceptedAnswers: ['mountain', 'a mountain', 'the mountain', 'mountains', 'hills', 'hill'],
        paths: [
            { type: 'polyline', points: [{x:48,y:258},{x:352,y:258}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'polyline', points: [{x:48,y:258},{x:145,y:92},{x:232,y:258}], strokeColor: '#888', strokeWidth: 3 },
            { type: 'polyline', points: [{x:118,y:258},{x:228,y:132},{x:322,y:258}], strokeColor: '#666', strokeWidth: 3 },
            { type: 'polyline', points: [{x:127,y:115},{x:145,y:92},{x:163,y:115}], strokeColor: '#FFF', strokeWidth: 3 },
            { type: 'polyline', points: [{x:212,y:150},{x:228,y:132},{x:244,y:150}], strokeColor: '#FFF', strokeWidth: 3 }
        ]
    },

    cloud: {
        id: 'cloud',
        name: 'Cloud',
        acceptedAnswers: ['cloud', 'a cloud', 'the cloud', 'clouds'],
        paths: [
            { type: 'arc', centerX: 110, centerY: 205, radius: 28, startAngle: Math.PI, endAngle: 0, strokeColor: '#888', strokeWidth: 3, pointCount: 30 },
            { type: 'arc', centerX: 155, centerY: 182, radius: 35, startAngle: Math.PI, endAngle: 0, strokeColor: '#888', strokeWidth: 3, pointCount: 35 },
            { type: 'arc', centerX: 200, centerY: 168, radius: 42, startAngle: Math.PI, endAngle: 0, strokeColor: '#888', strokeWidth: 3, pointCount: 40 },
            { type: 'arc', centerX: 248, centerY: 180, radius: 35, startAngle: Math.PI, endAngle: 0, strokeColor: '#888', strokeWidth: 3, pointCount: 35 },
            { type: 'arc', centerX: 290, centerY: 205, radius: 28, startAngle: Math.PI, endAngle: 0, strokeColor: '#888', strokeWidth: 3, pointCount: 30 },
            { type: 'polyline', points: [{x:82,y:205},{x:318,y:205}], strokeColor: '#888', strokeWidth: 3 }
        ]
    },

    moon: {
        id: 'moon',
        name: 'Moon',
        acceptedAnswers: ['moon', 'the moon', 'a moon', 'crescent', 'crescent moon'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 150, radius: 92, startAngle: -1.5708, endAngle: 1.5708, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:200,y:242}, control1: {x:260,y:208}, control2: {x:260,y:92}, end: {x:200,y:58}, strokeColor: '#FFD700', strokeWidth: 3, pointCount: 50 },
            { type: 'arc', centerX: 310, centerY: 80, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 330, centerY: 48, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 295, centerY: 45, radius: 3, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 2, pointCount: 15 }
        ]
    },

    snowflake: {
        id: 'snowflake',
        name: 'Snowflake',
        acceptedAnswers: ['snowflake', 'a snowflake', 'the snowflake', 'snowflakes'],
        paths: [
            { type: 'polyline', points: [{x:200,y:150},{x:200,y:78}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:150},{x:262,y:114}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:150},{x:262,y:186}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:150},{x:200,y:222}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:150},{x:138,y:186}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:150},{x:138,y:114}], strokeColor: '#87CEEB', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:114},{x:188,y:124}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:114},{x:212,y:124}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:231,y:132},{x:228,y:145}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:231,y:132},{x:244,y:135}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:231,y:168},{x:244,y:165}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:231,y:168},{x:228,y:155}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:186},{x:188,y:176}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:186},{x:212,y:176}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:169,y:168},{x:172,y:155}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:169,y:168},{x:156,y:165}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:169,y:132},{x:156,y:135}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:169,y:132},{x:172,y:145}], strokeColor: '#87CEEB', strokeWidth: 2 }
        ]
    },

    cactus: {
        id: 'cactus',
        name: 'Cactus',
        acceptedAnswers: ['cactus', 'a cactus', 'the cactus', 'cacti', 'cactuses'],
        paths: [
            { type: 'polyline', points: [{x:186,y:105},{x:186,y:268},{x:214,y:268},{x:214,y:105}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 105, radius: 14, startAngle: Math.PI, endAngle: 0, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 },
            { type: 'polyline', points: [{x:186,y:175},{x:144,y:175}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'polyline', points: [{x:144,y:175},{x:144,y:128}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'arc', centerX: 144, centerY: 128, radius: 12, startAngle: Math.PI, endAngle: 0, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 },
            { type: 'polyline', points: [{x:214,y:198},{x:258,y:198}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'polyline', points: [{x:258,y:198},{x:258,y:155}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'arc', centerX: 258, centerY: 155, radius: 12, startAngle: Math.PI, endAngle: 0, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 }
        ]
    },

    mushroom: {
        id: 'mushroom',
        name: 'Mushroom',
        acceptedAnswers: ['mushroom', 'a mushroom', 'the mushroom', 'mushrooms', 'toadstool'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 148, radiusX: 92, radiusY: 72, startAngle: Math.PI, endAngle: 0, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 60, isEllipse: true },
            { type: 'polyline', points: [{x:108,y:148},{x:170,y:148}], strokeColor: '#CC0000', strokeWidth: 3 },
            { type: 'polyline', points: [{x:230,y:148},{x:292,y:148}], strokeColor: '#CC0000', strokeWidth: 3 },
            { type: 'polyline', points: [{x:170,y:148},{x:162,y:248},{x:238,y:248},{x:230,y:148}], strokeColor: '#FFFACD', strokeWidth: 3 },
            { type: 'arc', centerX: 178, centerY: 118, radius: 11, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFFACD', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 222, centerY: 115, radius: 11, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFFACD', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 92, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFFACD', strokeWidth: 3, pointCount: 20 }
        ]
    },

    leaf: {
        id: 'leaf',
        name: 'Leaf',
        acceptedAnswers: ['leaf', 'a leaf', 'the leaf', 'leaves'],
        paths: [
            { type: 'bezier', start: {x:200,y:52}, control1: {x:318,y:102}, control2: {x:318,y:228}, end: {x:200,y:262}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 60 },
            { type: 'bezier', start: {x:200,y:262}, control1: {x:82,y:228}, control2: {x:82,y:102}, end: {x:200,y:52}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 60 },
            { type: 'polyline', points: [{x:200,y:52},{x:200,y:262}], strokeColor: '#1A6B1A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:102},{x:252,y:122}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:138},{x:262,y:155}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:175},{x:252,y:192}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:212},{x:242,y:225}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:102},{x:148,y:122}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:138},{x:138,y:155}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:175},{x:148,y:192}], strokeColor: '#1A6B1A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:200,y:212},{x:158,y:225}], strokeColor: '#1A6B1A', strokeWidth: 1 }
        ]
    },

    campfire: {
        id: 'campfire',
        name: 'Campfire',
        acceptedAnswers: ['campfire', 'a campfire', 'the campfire', 'campfires', 'fire', 'bonfire'],
        paths: [
            { type: 'polyline', points: [{x:95,y:258},{x:305,y:258}], strokeColor: '#8B4513', strokeWidth: 2 },
            { type: 'polyline', points: [{x:112,y:252},{x:288,y:232}], strokeColor: '#8B4513', strokeWidth: 5 },
            { type: 'polyline', points: [{x:118,y:232},{x:282,y:252}], strokeColor: '#8B4513', strokeWidth: 5 },
            { type: 'bezier', start: {x:168,y:238}, control1: {x:152,y:198}, control2: {x:168,y:168}, end: {x:186,y:158}, strokeColor: '#FF4500', strokeWidth: 4, pointCount: 40 },
            { type: 'bezier', start: {x:200,y:232}, control1: {x:194,y:188}, control2: {x:200,y:142}, end: {x:200,y:108}, strokeColor: '#FFD700', strokeWidth: 4, pointCount: 40 },
            { type: 'bezier', start: {x:232,y:238}, control1: {x:248,y:198}, control2: {x:232,y:168}, end: {x:214,y:158}, strokeColor: '#FF4500', strokeWidth: 4, pointCount: 40 },
            { type: 'bezier', start: {x:200,y:228}, control1: {x:196,y:192}, control2: {x:202,y:162}, end: {x:200,y:142}, strokeColor: '#FFFF00', strokeWidth: 3, pointCount: 30 }
        ]
    },

    pizza: {
        id: 'pizza',
        name: 'Pizza',
        acceptedAnswers: ['pizza', 'a pizza', 'the pizza', 'pizzas', 'pizza pie'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 155, radius: 115, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#DEB887', strokeWidth: 4, pointCount: 60 },
            { type: 'arc', centerX: 200, centerY: 155, radius: 105, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E74C3C', strokeWidth: 2, pointCount: 60 },
            { type: 'polyline', points: [{x:200,y:155},{x:200,y:40}], strokeColor: '#8B4513', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:155},{x:300,y:212}], strokeColor: '#8B4513', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:155},{x:100,y:212}], strokeColor: '#8B4513', strokeWidth: 2 },
            { type: 'arc', centerX: 178, centerY: 98, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 228, centerY: 102, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 162, centerY: 152, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 238, centerY: 152, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 178, centerY: 208, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 },
            { type: 'arc', centerX: 225, centerY: 208, radius: 9, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#CC0000', strokeWidth: 3, pointCount: 20 }
        ]
    },

    icecream: {
        id: 'icecream',
        name: 'Ice Cream',
        acceptedAnswers: ['ice cream', 'icecream', 'an ice cream', 'the ice cream', 'ice cream cone', 'cone'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 128, radius: 60, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FF69B4', strokeWidth: 3, pointCount: 50 },
            { type: 'polyline', points: [{x:140,y:128},{x:200,y:268},{x:260,y:128}], strokeColor: '#DEB887', strokeWidth: 3 },
            { type: 'polyline', points: [{x:153,y:158},{x:247,y:158}], strokeColor: '#C4924A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:162,y:185},{x:238,y:185}], strokeColor: '#C4924A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:175,y:212},{x:225,y:212}], strokeColor: '#C4924A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:188,y:235},{x:212,y:235}], strokeColor: '#C4924A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:140,y:128},{x:180,y:268}], strokeColor: '#C4924A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:165,y:128},{x:205,y:268}], strokeColor: '#C4924A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:195,y:128},{x:228,y:268}], strokeColor: '#C4924A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:225,y:128},{x:255,y:268}], strokeColor: '#C4924A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:178,y:102},{x:182,y:110}], strokeColor: '#FF0000', strokeWidth: 3 },
            { type: 'polyline', points: [{x:205,y:88},{x:210,y:96}], strokeColor: '#0000FF', strokeWidth: 3 },
            { type: 'polyline', points: [{x:222,y:108},{x:218,y:116}], strokeColor: '#FFD700', strokeWidth: 3 }
        ]
    },

    apple: {
        id: 'apple',
        name: 'Apple',
        acceptedAnswers: ['apple', 'an apple', 'the apple', 'apples'],
        paths: [
            { type: 'bezier', start: {x:200,y:90}, control1: {x:318,y:90}, control2: {x:308,y:252}, end: {x:200,y:252}, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 60 },
            { type: 'bezier', start: {x:200,y:252}, control1: {x:92,y:252}, control2: {x:82,y:90}, end: {x:200,y:90}, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 60 },
            { type: 'bezier', start: {x:200,y:90}, control1: {x:232,y:62}, control2: {x:252,y:70}, end: {x:248,y:95}, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:200,y:90}, control1: {x:168,y:62}, control2: {x:148,y:70}, end: {x:152,y:95}, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 30 },
            { type: 'polyline', points: [{x:200,y:90},{x:205,y:68},{x:212,y:58}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'bezier', start: {x:205,y:68}, control1: {x:232,y:52}, control2: {x:238,y:68}, end: {x:218,y:72}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:218,y:72}, control1: {x:228,y:78}, control2: {x:215,y:80}, end: {x:205,y:68}, strokeColor: '#228B22', strokeWidth: 2, pointCount: 25 },
            { type: 'bezier', start: {x:230,y:118}, control1: {x:248,y:108}, control2: {x:252,y:125}, end: {x:240,y:132}, strokeColor: '#FF8888', strokeWidth: 2, pointCount: 25 }
        ]
    },

    cake: {
        id: 'cake',
        name: 'Cake',
        acceptedAnswers: ['cake', 'a cake', 'the cake', 'cakes', 'birthday cake'],
        paths: [
            { type: 'polyline', points: [{x:110,y:215},{x:110,y:258},{x:290,y:258},{x:290,y:215},{x:110,y:215}], strokeColor: '#FFB6C1', strokeWidth: 3 },
            { type: 'polyline', points: [{x:140,y:168},{x:140,y:215},{x:260,y:215},{x:260,y:168},{x:140,y:168}], strokeColor: '#FFB6C1', strokeWidth: 3 },
            { type: 'bezier', start: {x:110,y:215}, control1: {x:150,y:205}, control2: {x:195,y:222}, end: {x:230,y:210}, strokeColor: '#FFF', strokeWidth: 3, pointCount: 30 },
            { type: 'bezier', start: {x:230,y:210}, control1: {x:255,y:202}, control2: {x:275,y:215}, end: {x:290,y:215}, strokeColor: '#FFF', strokeWidth: 3, pointCount: 20 },
            { type: 'bezier', start: {x:140,y:168}, control1: {x:170,y:158}, control2: {x:205,y:170}, end: {x:230,y:165}, strokeColor: '#FFF', strokeWidth: 3, pointCount: 25 },
            { type: 'bezier', start: {x:230,y:165}, control1: {x:248,y:160}, control2: {x:256,y:168}, end: {x:260,y:168}, strokeColor: '#FFF', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:165,y:148},{x:165,y:168}], strokeColor: '#E74C3C', strokeWidth: 4 },
            { type: 'polyline', points: [{x:200,y:142},{x:200,y:168}], strokeColor: '#FFD700', strokeWidth: 4 },
            { type: 'polyline', points: [{x:235,y:148},{x:235,y:168}], strokeColor: '#2980B9', strokeWidth: 4 },
            { type: 'arc', centerX: 165, centerY: 146, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FF4500', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 200, centerY: 140, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FF4500', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 235, centerY: 146, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FF4500', strokeWidth: 2, pointCount: 15 },
            { type: 'arc', centerX: 200, centerY: 260, radiusX: 105, radiusY: 12, startAngle: 0, endAngle: Math.PI, strokeColor: '#CCC', strokeWidth: 3, pointCount: 40, isEllipse: true }
        ]
    },

    carrot: {
        id: 'carrot',
        name: 'Carrot',
        acceptedAnswers: ['carrot', 'a carrot', 'the carrot', 'carrots'],
        paths: [
            { type: 'bezier', start: {x:200,y:278}, control1: {x:208,y:222}, control2: {x:226,y:122}, end: {x:213,y:68}, strokeColor: '#FF6600', strokeWidth: 3, pointCount: 50 },
            { type: 'bezier', start: {x:188,y:68}, control1: {x:174,y:122}, control2: {x:192,y:222}, end: {x:200,y:278}, strokeColor: '#FF6600', strokeWidth: 3, pointCount: 50 },
            { type: 'polyline', points: [{x:188,y:68},{x:213,y:68}], strokeColor: '#FF6600', strokeWidth: 3 },
            { type: 'polyline', points: [{x:190,y:118},{x:212,y:118}], strokeColor: '#FF8800', strokeWidth: 2 },
            { type: 'polyline', points: [{x:192,y:158},{x:211,y:158}], strokeColor: '#FF8800', strokeWidth: 2 },
            { type: 'polyline', points: [{x:195,y:198},{x:208,y:198}], strokeColor: '#FF8800', strokeWidth: 2 },
            { type: 'bezier', start: {x:200,y:68}, control1: {x:198,y:40}, control2: {x:196,y:28}, end: {x:198,y:22}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 },
            { type: 'bezier', start: {x:196,y:68}, control1: {x:182,y:48}, control2: {x:170,y:38}, end: {x:166,y:34}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 },
            { type: 'bezier', start: {x:204,y:68}, control1: {x:218,y:48}, control2: {x:230,y:38}, end: {x:234,y:34}, strokeColor: '#228B22', strokeWidth: 3, pointCount: 20 }
        ]
    },

    snowman: {
        id: 'snowman',
        name: 'Snowman',
        acceptedAnswers: ['snowman', 'a snowman', 'the snowman', 'snowmen'],
        paths: [
            { type: 'arc', centerX: 200, centerY: 228, radius: 60, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFF', strokeWidth: 3, pointCount: 50 },
            { type: 'arc', centerX: 200, centerY: 148, radius: 42, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFF', strokeWidth: 3, pointCount: 45 },
            { type: 'arc', centerX: 200, centerY: 86, radius: 30, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFF', strokeWidth: 3, pointCount: 40 },
            { type: 'polyline', points: [{x:158,y:60},{x:242,y:60}], strokeColor: '#333', strokeWidth: 4 },
            { type: 'polyline', points: [{x:168,y:60},{x:168,y:28},{x:232,y:28},{x:232,y:60}], strokeColor: '#333', strokeWidth: 3 },
            { type: 'arc', centerX: 191, centerY: 78, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'arc', centerX: 209, centerY: 78, radius: 4, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:200,y:87},{x:220,y:90},{x:200,y:93}], strokeColor: '#FF6600', strokeWidth: 2 },
            { type: 'arc', centerX: 200, centerY: 100, radius: 12, startAngle: 0.3, endAngle: 2.8, strokeColor: '#333', strokeWidth: 2, pointCount: 20 },
            { type: 'arc', centerX: 200, centerY: 132, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'arc', centerX: 200, centerY: 148, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'arc', centerX: 200, centerY: 164, radius: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#333', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:160,y:148},{x:118,y:132}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:240,y:148},{x:282,y:132}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:170,y:115},{x:230,y:115},{x:225,y:122},{x:175,y:122},{x:170,y:115}], strokeColor: '#E74C3C', strokeWidth: 3 }
        ]
    },

    robot: {
        id: 'robot',
        name: 'Robot',
        acceptedAnswers: ['robot', 'a robot', 'the robot', 'robots', 'android'],
        paths: [
            { type: 'polyline', points: [{x:158,y:55},{x:158,y:118},{x:242,y:118},{x:242,y:55},{x:158,y:55}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:166,y:65},{x:166,y:85},{x:186,y:85},{x:186,y:65},{x:166,y:65}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:214,y:65},{x:214,y:85},{x:234,y:85},{x:234,y:65},{x:214,y:65}], strokeColor: '#87CEEB', strokeWidth: 2 },
            { type: 'polyline', points: [{x:170,y:100},{x:230,y:100}], strokeColor: '#333', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:55},{x:200,y:36}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'arc', centerX: 200, centerY: 33, radius: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E74C3C', strokeWidth: 3, pointCount: 15 },
            { type: 'polyline', points: [{x:185,y:118},{x:185,y:132},{x:215,y:132},{x:215,y:118}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:140,y:132},{x:140,y:235},{x:260,y:235},{x:260,y:132},{x:140,y:132}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:108,y:135},{x:108,y:218},{x:140,y:218},{x:140,y:135}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:260,y:135},{x:260,y:218},{x:292,y:218},{x:292,y:135}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:155,y:235},{x:155,y:285},{x:188,y:285},{x:188,y:235}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:212,y:235},{x:212,y:285},{x:245,y:285},{x:245,y:235}], strokeColor: '#555', strokeWidth: 3 },
            { type: 'polyline', points: [{x:158,y:150},{x:158,y:205},{x:242,y:205},{x:242,y:150},{x:158,y:150}], strokeColor: '#444', strokeWidth: 2 },
            { type: 'arc', centerX: 200, centerY: 178, radius: 20, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E74C3C', strokeWidth: 2, pointCount: 30 }
        ]
    },

    lightning: {
        id: 'lightning',
        name: 'Lightning Bolt',
        acceptedAnswers: ['lightning', 'lightning bolt', 'a lightning bolt', 'the lightning bolt', 'bolt', 'thunder'],
        paths: [
            { type: 'polyline', points: [{x:232,y:42},{x:192,y:145},{x:222,y:145},{x:175,y:278},{x:200,y:278},{x:215,y:158},{x:195,y:158},{x:238,y:42},{x:232,y:42}], strokeColor: '#FFD700', strokeWidth: 3 }
        ]
    },

    kite: {
        id: 'kite',
        name: 'Kite',
        acceptedAnswers: ['kite', 'a kite', 'the kite', 'kites'],
        paths: [
            { type: 'polyline', points: [{x:200,y:52},{x:315,y:165},{x:200,y:258},{x:85,y:165},{x:200,y:52}], strokeColor: '#E74C3C', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:52},{x:200,y:258}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'polyline', points: [{x:85,y:165},{x:315,y:165}], strokeColor: '#C0392B', strokeWidth: 2 },
            { type: 'bezier', start: {x:200,y:258}, control1: {x:228,y:272}, control2: {x:232,y:285}, end: {x:215,y:293}, strokeColor: '#333', strokeWidth: 2, pointCount: 25 },
            { type: 'arc', centerX: 210, centerY: 270, radiusX: 13, radiusY: 6, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#E74C3C', strokeWidth: 2, pointCount: 20, isEllipse: true },
            { type: 'arc', centerX: 214, centerY: 284, radiusX: 11, radiusY: 5, startAngle: 0, endAngle: Math.PI * 2, strokeColor: '#FFD700', strokeWidth: 2, pointCount: 20, isEllipse: true }
        ]
    },

    arrow: {
        id: 'arrow',
        name: 'Arrow',
        acceptedAnswers: ['arrow', 'an arrow', 'the arrow', 'arrows'],
        paths: [
            { type: 'polyline', points: [{x:68,y:155},{x:260,y:155}], strokeColor: '#E74C3C', strokeWidth: 4 },
            { type: 'polyline', points: [{x:260,y:125},{x:312,y:155},{x:260,y:185},{x:260,y:125}], strokeColor: '#E74C3C', strokeWidth: 3 }
        ]
    },

    tent: {
        id: 'tent',
        name: 'Tent',
        acceptedAnswers: ['tent', 'a tent', 'the tent', 'tents', 'camping tent'],
        paths: [
            { type: 'polyline', points: [{x:68,y:252},{x:332,y:252}], strokeColor: '#228B22', strokeWidth: 3 },
            { type: 'polyline', points: [{x:98,y:252},{x:200,y:78},{x:302,y:252}], strokeColor: '#8B4513', strokeWidth: 3 },
            { type: 'polyline', points: [{x:200,y:252},{x:200,y:162},{x:168,y:252}], strokeColor: '#6B3410', strokeWidth: 2 },
            { type: 'polyline', points: [{x:200,y:252},{x:200,y:162},{x:232,y:252}], strokeColor: '#6B3410', strokeWidth: 2 },
            { type: 'polyline', points: [{x:152,y:170},{x:85,y:252}], strokeColor: '#888', strokeWidth: 2 },
            { type: 'polyline', points: [{x:248,y:170},{x:315,y:252}], strokeColor: '#888', strokeWidth: 2 }
        ]
    },

    envelope: {
        id: 'envelope',
        name: 'Envelope',
        acceptedAnswers: ['envelope', 'an envelope', 'the envelope', 'envelopes', 'letter', 'mail'],
        paths: [
            { type: 'polyline', points: [{x:75,y:98},{x:75,y:252},{x:325,y:252},{x:325,y:98},{x:75,y:98}], strokeColor: '#DEB887', strokeWidth: 3 },
            { type: 'polyline', points: [{x:75,y:98},{x:200,y:185},{x:325,y:98}], strokeColor: '#C4924A', strokeWidth: 3 },
            { type: 'polyline', points: [{x:75,y:252},{x:200,y:172},{x:325,y:252}], strokeColor: '#C4924A', strokeWidth: 2 },
            { type: 'polyline', points: [{x:75,y:98},{x:200,y:185},{x:75,y:252}], strokeColor: '#C4924A', strokeWidth: 1 },
            { type: 'polyline', points: [{x:325,y:98},{x:200,y:185},{x:325,y:252}], strokeColor: '#C4924A', strokeWidth: 1 }
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
