// Phase definitions
export const PHASES = [
  { number: 1, description: '2 sets of 3', requirements: [{ type: 'set', count: 3 }, { type: 'set', count: 3 }] },
  { number: 2, description: '1 set of 3 + 1 run of 4', requirements: [{ type: 'set', count: 3 }, { type: 'run', count: 4 }] },
  { number: 3, description: '1 set of 4 + 1 run of 4', requirements: [{ type: 'set', count: 4 }, { type: 'run', count: 4 }] },
  { number: 4, description: '1 run of 7', requirements: [{ type: 'run', count: 7 }] },
  { number: 5, description: '1 run of 8', requirements: [{ type: 'run', count: 8 }] },
  { number: 6, description: '1 run of 9', requirements: [{ type: 'run', count: 9 }] },
  { number: 7, description: '2 sets of 4', requirements: [{ type: 'set', count: 4 }, { type: 'set', count: 4 }] },
  { number: 8, description: '7 cards of one color', requirements: [{ type: 'color', count: 7 }] },
  { number: 9, description: '1 set of 5 + 1 set of 2', requirements: [{ type: 'set', count: 5 }, { type: 'set', count: 2 }] },
  { number: 10, description: '1 set of 5 + 1 set of 3', requirements: [{ type: 'set', count: 5 }, { type: 'set', count: 3 }] },
];

// Check if cards form a valid set (same number)
export function isValidSet(cards, requiredCount) {
  if (cards.length !== requiredCount) return false;

  // Skip cards cannot be used in phases
  if (cards.some(c => c.type === 'skip')) return false;

  const nonWilds = cards.filter(c => c.type === 'number');
  if (nonWilds.length === 0) return cards.length >= requiredCount; // All wilds is valid

  const targetValue = nonWilds[0].value;
  return nonWilds.every(c => c.value === targetValue);
}

// Check if cards form a valid run (consecutive numbers)
export function isValidRun(cards, requiredCount) {
  if (cards.length !== requiredCount) return false;

  // Skip cards cannot be used in phases
  if (cards.some(c => c.type === 'skip')) return false;

  const nonWilds = cards.filter(c => c.type === 'number');
  const wilds = cards.filter(c => c.type === 'wild');

  if (nonWilds.length === 0) return true; // All wilds

  // Get sorted unique values
  const values = nonWilds.map(c => c.value).sort((a, b) => a - b);

  // Find min and max to determine the range we need to cover
  const min = values[0];
  const max = min + requiredCount - 1;

  if (max > 12) {
    // Try different starting points
    for (let start = Math.max(1, values[values.length - 1] - requiredCount + 1); start <= Math.min(12 - requiredCount + 1, values[0]); start++) {
      if (canFormRun(values, wilds.length, start, requiredCount)) {
        return true;
      }
    }
    return false;
  }

  return canFormRun(values, wilds.length, min, requiredCount);
}

function canFormRun(values, wildCount, start, length) {
  let wildsNeeded = 0;
  const valueSet = new Set(values);

  for (let i = start; i < start + length; i++) {
    if (i < 1 || i > 12) return false;
    if (!valueSet.has(i)) {
      wildsNeeded++;
    }
  }

  // Check if we have duplicates that exceed what we need
  const valueCounts = {};
  values.forEach(v => {
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  });

  let extraCards = 0;
  for (const v in valueCounts) {
    if (parseInt(v) >= start && parseInt(v) < start + length) {
      extraCards += valueCounts[v] - 1;
    } else {
      extraCards += valueCounts[v];
    }
  }

  return wildsNeeded <= wildCount && extraCards === 0;
}

// Check if cards are all one color
export function isValidColorGroup(cards, requiredCount) {
  if (cards.length !== requiredCount) return false;

  // Skip cards cannot be used in phases
  if (cards.some(c => c.type === 'skip')) return false;

  const nonWilds = cards.filter(c => c.type === 'number');
  if (nonWilds.length === 0) return true; // All wilds

  const targetColor = nonWilds[0].color;
  return nonWilds.every(c => c.color === targetColor);
}

// Validate if selected cards complete a phase requirement
export function validatePhaseGroup(cards, requirement) {
  if (requirement.type === 'set') {
    return isValidSet(cards, requirement.count);
  } else if (requirement.type === 'run') {
    return isValidRun(cards, requirement.count);
  } else if (requirement.type === 'color') {
    return isValidColorGroup(cards, requirement.count);
  }
  return false;
}

// Try to find valid phase combinations in a hand
export function findPhaseCards(hand, phaseNumber) {
  const phase = PHASES[phaseNumber - 1];
  if (!phase) return null;

  const requirements = phase.requirements;

  // Try to find cards that satisfy all requirements
  return findCombination(hand, requirements, 0, []);
}

function findCombination(availableCards, requirements, reqIndex, currentGroups) {
  if (reqIndex >= requirements.length) {
    return currentGroups;
  }

  const req = requirements[reqIndex];
  const combinations = generateCombinations(availableCards, req.count);

  for (const combo of combinations) {
    if (validatePhaseGroup(combo, req)) {
      // Remove used cards and continue
      const remaining = availableCards.filter(c => !combo.some(used => used.id === c.id));
      const result = findCombination(remaining, requirements, reqIndex + 1, [...currentGroups, combo]);
      if (result) return result;
    }
  }

  return null;
}

function generateCombinations(arr, size) {
  const result = [];

  function combine(start, current) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

// Check if a card can be added to an existing laid group (hitting)
export function canHitOnGroup(card, group, groupType) {
  if (card.type === 'wild') return true;
  if (card.type === 'skip') return false;

  if (groupType === 'set') {
    const nonWilds = group.filter(c => c.type === 'number');
    if (nonWilds.length === 0) return true;
    return card.value === nonWilds[0].value;
  } else if (groupType === 'run') {
    const values = group.filter(c => c.type === 'number').map(c => c.value);
    if (values.length === 0) return true;
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Can extend the run at either end
    return card.value === min - 1 || card.value === max + 1;
  } else if (groupType === 'color') {
    const nonWilds = group.filter(c => c.type === 'number');
    if (nonWilds.length === 0) return true;
    return card.color === nonWilds[0].color;
  }

  return false;
}

// Get the type of a laid group based on the phase requirements
export function getGroupType(phaseNumber, groupIndex) {
  const phase = PHASES[phaseNumber - 1];
  if (!phase || groupIndex >= phase.requirements.length) return null;
  return phase.requirements[groupIndex].type;
}
