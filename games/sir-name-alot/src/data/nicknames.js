// First letter of name → Title/Prefix
export const prefixes = {
  A: 'DJ',
  B: 'MC',
  C: 'Sir',
  D: 'Big',
  E: 'Lil',
  F: 'The Notorious',
  G: 'Funky',
  H: 'Fresh',
  I: 'Ice',
  J: 'Dr.',
  K: 'Grandmaster',
  L: 'King',
  M: 'Master',
  N: 'OG',
  O: 'P-Money',
  P: 'Mega',
  Q: 'Q-Tip',
  R: 'Royal',
  S: 'Slick',
  T: 'T-Bone',
  U: 'Ultra',
  V: 'Vinyl',
  W: 'Wild',
  X: 'X-Factor',
  Y: 'Young',
  Z: 'Z-Man'
}

// Birth month → Middle name
export const monthNames = {
  1: 'Frosty',
  2: 'Lovebug',
  3: 'Shamrock',
  4: 'Raindrop',
  5: 'Blossom',
  6: 'Sunny',
  7: 'Firecracker',
  8: 'Heatwave',
  9: 'Golden',
  10: 'Spooky',
  11: 'Grateful',
  12: 'Snowflake'
}

// Dessert → Suffix
export const dessertSuffixes = {
  cake: 'Cake Boss',
  pie: 'Pie Slinger',
  icecream: 'Scoops',
  cookies: 'Cookie Monster',
  brownies: 'Brownie Points',
  cheesecake: 'Cheesecake King',
  donuts: 'Donut Destroyer',
  cupcakes: 'Cupcake Crusher',
  pudding: "Puddin' Pop",
  candy: 'Candy Man',
  fruit: 'Fruit Loops',
  chocolate: 'Choco Thunder'
}

// Dessert options for the form
export const dessertOptions = [
  { value: 'cake', label: '🎂 Cake' },
  { value: 'pie', label: '🥧 Pie' },
  { value: 'icecream', label: '🍦 Ice Cream' },
  { value: 'cookies', label: '🍪 Cookies' },
  { value: 'brownies', label: '🟫 Brownies' },
  { value: 'cheesecake', label: '🧀 Cheesecake' },
  { value: 'donuts', label: '🍩 Donuts' },
  { value: 'cupcakes', label: '🧁 Cupcakes' },
  { value: 'pudding', label: '🍮 Pudding' },
  { value: 'candy', label: '🍬 Candy' },
  { value: 'fruit', label: '🍓 Fruit' },
  { value: 'chocolate', label: '🍫 Chocolate' }
]

// Month options for the form
export const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

// Generate the full nickname
export function generateNickname(name, month, dessert) {
  const firstLetter = name.trim().charAt(0).toUpperCase()
  const prefix = prefixes[firstLetter] || 'The'
  const middle = monthNames[month] || 'Mystery'
  const suffix = dessertSuffixes[dessert] || 'Sweet Tooth'

  return `${prefix} ${middle} ${suffix}`
}
