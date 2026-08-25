// Returns the source block index for a raycast triangle in indexed quad geometry.
export function sourceBlockIndexForFace(sourceIndices, faceIndex) {
  if (!Array.isArray(sourceIndices) || !Number.isInteger(faceIndex) || faceIndex < 0) return undefined;
  return sourceIndices[Math.floor(faceIndex / 2)];
}