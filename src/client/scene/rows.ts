// Where the repeated pieces stand along the road: the fence and the road's dashes, each drawn as one instanced row.
export const fenceAt = (width: number): number[] =>
  Array.from({ length: Math.ceil((width + 8) / 2) }, (_, i) => -(width + 8) / 2 + 1 + i * 2);

export const dashesAt = (width: number): number[] =>
  Array.from({ length: Math.ceil((width + 40) / 3) }, (_, i) => -(width + 40) / 2 + 1.5 + i * 3);
