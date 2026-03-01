// Shop items and categories

export const SHOP_ITEMS = {
  // Pet Shop items
  pets: [
    { id: 'pet-dog', name: 'Puppy', price: 200, emoji: '🐕', description: 'A loyal companion!' },
    { id: 'pet-cat', name: 'Kitten', price: 150, emoji: '🐱', description: 'Soft and cuddly!' },
    { id: 'pet-hamster', name: 'Hamster', price: 50, emoji: '🐹', description: 'Tiny and cute!' },
    { id: 'pet-bird', name: 'Parrot', price: 100, emoji: '🦜', description: 'Can learn to talk!' },
    { id: 'pet-fish', name: 'Goldfish', price: 25, emoji: '🐟', description: 'Easy to care for!' },
    { id: 'pet-rabbit', name: 'Bunny', price: 80, emoji: '🐰', description: 'Fluffy and hoppy!' },
  ],

  // Furniture Shop items
  furniture: [
    { id: 'furn-bed', name: 'Bed', price: 300, emoji: '🛏️', description: 'Rest and recover!', canSleep: true },
    { id: 'furn-couch', name: 'Couch', price: 250, emoji: '🛋️', description: 'Comfy seating!' },
    { id: 'furn-table', name: 'Table', price: 150, emoji: '🪑', description: 'For dining!' },
    { id: 'furn-tv', name: 'TV', price: 400, emoji: '📺', description: 'Entertainment!' },
    { id: 'furn-lamp', name: 'Lamp', price: 75, emoji: '💡', description: 'Lights up the room!' },
    { id: 'furn-plant', name: 'Plant', price: 50, emoji: '🪴', description: 'Adds life!' },
    { id: 'furn-bookshelf', name: 'Bookshelf', price: 200, emoji: '📚', description: 'Store your books!' },
    { id: 'furn-rug', name: 'Rug', price: 100, emoji: '🟫', description: 'Cozy floor!' },
  ],

  // Clothing Shop items
  clothing: [
    { id: 'cloth-hat', name: 'Cool Hat', price: 50, emoji: '🧢', description: 'Looking stylish!' },
    { id: 'cloth-glasses', name: 'Sunglasses', price: 75, emoji: '🕶️', description: 'So cool!' },
    { id: 'cloth-jacket', name: 'Jacket', price: 150, emoji: '🧥', description: 'Stay warm!' },
    { id: 'cloth-shoes', name: 'Sneakers', price: 120, emoji: '👟', description: 'Run fast!' },
  ],

  // Grocery Store items
  groceries: [
    { id: 'food-apple', name: 'Apple', price: 5, emoji: '🍎', description: 'Healthy snack!' },
    { id: 'food-pizza', name: 'Pizza', price: 15, emoji: '🍕', description: 'Delicious!' },
    { id: 'food-icecream', name: 'Ice Cream', price: 10, emoji: '🍦', description: 'Sweet treat!' },
    { id: 'food-drink', name: 'Juice', price: 8, emoji: '🧃', description: 'Refreshing!' },
  ],

  // Toy Store items
  toys: [
    { id: 'toy-ball', name: 'Ball', price: 20, emoji: '⚽', description: 'Play outside!' },
    { id: 'toy-teddy', name: 'Teddy Bear', price: 40, emoji: '🧸', description: 'Cuddly friend!' },
    { id: 'toy-kite', name: 'Kite', price: 35, emoji: '🪁', description: 'Fly high!' },
    { id: 'toy-game', name: 'Video Game', price: 60, emoji: '🎮', description: 'Fun times!' },
  ],

  // Airport tickets
  flights: [
    { id: 'flight-beach', name: 'Beach City', price: 500, emoji: '🏖️', description: 'Sun and sand!', destination: 'beach' },
    { id: 'flight-mountain', name: 'Mountain Town', price: 500, emoji: '🏔️', description: 'Snow and adventure!', destination: 'mountain' },
    { id: 'flight-space', name: 'Space Station', price: 1000, emoji: '🚀', description: 'Out of this world!', destination: 'space' },
  ],

  // Gym activities
  gym: [
    { id: 'gym-workout', name: 'Workout', price: 25, emoji: '💪', description: 'Get stronger!', activity: true },
    { id: 'gym-yoga', name: 'Yoga Class', price: 30, emoji: '🧘', description: 'Find peace!', activity: true },
    { id: 'gym-swim', name: 'Swimming', price: 20, emoji: '🏊', description: 'Splash around!', activity: true },
  ]
};

// Building types that have shops
export const SHOP_BUILDINGS = {
  'pet-shop': { items: 'pets', name: 'Pet Shop', welcomeMessage: 'Welcome! Looking for a furry friend?' },
  'furniture-store': { items: 'furniture', name: 'Furniture Store', welcomeMessage: 'Make your house a home!' },
  'clothing-store': { items: 'clothing', name: 'Fashion Boutique', welcomeMessage: 'Looking good!' },
  'grocery': { items: 'groceries', name: 'Grocery Store', welcomeMessage: 'Fresh food daily!' },
  'toy-store': { items: 'toys', name: 'Toy Store', welcomeMessage: 'Fun for everyone!' },
  'airport': { items: 'flights', name: 'Airport', welcomeMessage: 'Where would you like to go?' },
  'gym': { items: 'gym', name: 'Fitness Center', welcomeMessage: 'Ready to work out?' },
};

export function getShopItems(buildingType) {
  const shop = SHOP_BUILDINGS[buildingType];
  if (!shop) return [];
  return SHOP_ITEMS[shop.items] || [];
}

export function getShopInfo(buildingType) {
  return SHOP_BUILDINGS[buildingType];
}
