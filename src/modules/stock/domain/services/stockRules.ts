export function calculateNewStock(currentStock: number, delta: number): number {
  const nextStock = currentStock + delta;

  if (nextStock < 0) {
    throw new Error('O estoque não pode ficar negativo');
  }

  return nextStock;
}
