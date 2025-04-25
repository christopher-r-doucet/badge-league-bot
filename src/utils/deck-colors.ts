/**
 * Color types for deck assignment
 */
export enum DeckColor {
  RED = 'Red',
  BLUE = 'Blue',
  GREEN = 'Green',
  YELLOW = 'Yellow',
  PURPLE = 'Purple',
  ORANGE = 'Orange',
  BLACK = 'Black',
  WHITE = 'White',
  PINK = 'Pink',
  BROWN = 'Brown',
  GRAY = 'Gray',
  TEAL = 'Teal'
}

/**
 * Get a random deck color
 * @returns A random deck color
 */
export function getRandomDeckColor(): DeckColor {
  const colors = Object.values(DeckColor);
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

/**
 * Get two random unique deck colors
 * @returns An array of two unique deck colors
 */
export function getRandomColorPair(): [DeckColor, DeckColor] {
  const colors = Object.values(DeckColor);
  const firstIndex = Math.floor(Math.random() * colors.length);
  let secondIndex = Math.floor(Math.random() * colors.length);
  
  // Make sure the second color is different from the first
  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * colors.length);
  }
  
  return [colors[firstIndex], colors[secondIndex]];
}
