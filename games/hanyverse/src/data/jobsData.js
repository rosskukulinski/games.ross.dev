// Job definitions for the game

export const JOBS = [
  // Pizza jobs
  {
    id: 'pizza-maker',
    name: 'Pizza Maker',
    building: 'pizza',
    payPerDay: 50,
    description: 'Make delicious pizzas!',
    minigame: 'pizza-making',
    texture: 'job-pizza-maker'
  },
  {
    id: 'waiter',
    name: 'Waiter',
    building: 'pizza',
    payPerDay: 40,
    description: 'Serve customers their food!',
    minigame: 'waiter',
    texture: 'job-waiter'
  },
  {
    id: 'delivery',
    name: 'Delivery Driver',
    building: 'pizza',
    payPerDay: 35,
    description: 'Deliver pizzas around town!',
    minigame: 'delivery',
    texture: 'job-delivery'
  },

  // Vet jobs
  {
    id: 'vet-assistant',
    name: 'Vet Assistant',
    building: 'vet',
    payPerDay: 60,
    description: 'Help care for cute animals!',
    minigame: 'memory-match',
    texture: 'job-vet-assistant'
  },

  // Hospital jobs
  {
    id: 'nurse',
    name: 'Nurse',
    building: 'hospital',
    payPerDay: 70,
    description: 'Help patients feel better!',
    minigame: 'memory-match',
    texture: 'job-nurse'
  },

  // Future jobs (for custom buildings)
  {
    id: 'chef',
    name: 'Chef',
    building: 'restaurant',
    payPerDay: 55,
    description: 'Cook amazing meals!',
    minigame: 'cooking',
    texture: 'job-chef'
  },
  {
    id: 'taxi-driver',
    name: 'Taxi Driver',
    building: 'taxi-stand',
    payPerDay: 45,
    description: 'Drive people around town!',
    minigame: 'taxi',
    texture: 'job-taxi'
  },
  {
    id: 'cashier',
    name: 'Cashier',
    building: 'shop',
    payPerDay: 30,
    description: 'Help customers at the store!',
    minigame: 'cashier',
    texture: 'job-cashier'
  }
];

// Helper functions
export function getJobsByBuilding(buildingId) {
  return JOBS.filter(job => job.building === buildingId);
}

export function getJobById(jobId) {
  return JOBS.find(job => job.id === jobId);
}

export function getAllJobs() {
  return JOBS;
}

// Minigame type definitions (for future use)
export const MINIGAME_TYPES = {
  'pizza-making': {
    name: 'Pizza Making',
    description: 'Drag toppings onto the pizza before time runs out!',
    duration: 45, // seconds
    bonusMultiplier: 1.5 // bonus pay for perfect score
  },
  'waiter': {
    name: 'Serving Tables',
    description: 'Tap tables in the correct order to serve customers!',
    duration: 60,
    bonusMultiplier: 1.3
  },
  'delivery': {
    name: 'Pizza Delivery',
    description: 'Navigate through the streets to deliver pizza!',
    duration: 30,
    bonusMultiplier: 1.4
  },
  'memory-match': {
    name: 'Memory Match',
    description: 'Match pairs of cards to help patients/animals!',
    duration: 60,
    bonusMultiplier: 1.2
  },
  'cooking': {
    name: 'Cooking',
    description: 'Follow the recipe by tapping ingredients in order!',
    duration: 45,
    bonusMultiplier: 1.4
  },
  'taxi': {
    name: 'Taxi Driving',
    description: 'Navigate through traffic to your destination!',
    duration: 45,
    bonusMultiplier: 1.3
  },
  'cashier': {
    name: 'Checkout',
    description: 'Scan items and give correct change!',
    duration: 60,
    bonusMultiplier: 1.2
  }
};
