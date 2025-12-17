import type { Node } from '@xyflow/react';

// Returns the intersection point of a line from the center of the node to the target point
function getNodeCenter(node: Node) {
  const width = node.measured?.width ?? 0;
  const height = node.measured?.height ?? 0;

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

// Calculate intersection point on node bounds
function getIntersectionPoint(
  centerA: { x: number; y: number },
  centerB: { x: number; y: number },
  node: Node
) {
  const width = node.measured?.width ?? 0;
  const height = node.measured?.height ?? 0;

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;

  // Calculate intersection with node rectangle
  let intersectionX = centerA.x;
  let intersectionY = centerA.y;

  if (Math.abs(dx) > 0.01) {
    // Check left and right edges
    const leftT = (node.position.x - centerA.x) / dx;
    const rightT = (node.position.x + width - centerA.x) / dx;

    const leftY = centerA.y + leftT * dy;
    const rightY = centerA.y + rightT * dy;

    if (
      leftT > 0 &&
      leftT < 1 &&
      leftY >= node.position.y &&
      leftY <= node.position.y + height
    ) {
      intersectionX = node.position.x;
      intersectionY = leftY;
    } else if (
      rightT > 0 &&
      rightT < 1 &&
      rightY >= node.position.y &&
      rightY <= node.position.y + height
    ) {
      intersectionX = node.position.x + width;
      intersectionY = rightY;
    }
  }

  if (Math.abs(dy) > 0.01) {
    // Check top and bottom edges
    const topT = (node.position.y - centerA.y) / dy;
    const bottomT = (node.position.y + height - centerA.y) / dy;

    const topX = centerA.x + topT * dx;
    const bottomX = centerA.x + bottomT * dx;

    if (
      topT > 0 &&
      topT < 1 &&
      topX >= node.position.x &&
      topX <= node.position.x + width
    ) {
      intersectionX = topX;
      intersectionY = node.position.y;
    } else if (
      bottomT > 0 &&
      bottomT < 1 &&
      bottomX >= node.position.x &&
      bottomX <= node.position.x + width
    ) {
      intersectionX = bottomX;
      intersectionY = node.position.y + height;
    }
  }

  return { x: intersectionX, y: intersectionY };
}

export function getNodeIntersection(nodeA: Node, nodeB: Node) {
  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  // For self-loops, offset the target point to create a loop
  if (nodeA.id === nodeB.id) {
    const width = nodeA.measured?.width ?? 0;
    const height = nodeA.measured?.height ?? 0;

    // Create a loop from right to top
    return {
      sx: nodeA.position.x + width, // Right edge
      sy: nodeA.position.y + height / 2, // Middle of right edge
      tx: nodeA.position.x + width / 2, // Top edge middle
      ty: nodeA.position.y, // Top edge
    };
  }

  const intersectionA = getIntersectionPoint(centerA, centerB, nodeA);
  const intersectionB = getIntersectionPoint(centerB, centerA, nodeB);

  return {
    sx: intersectionA.x,
    sy: intersectionA.y,
    tx: intersectionB.x,
    ty: intersectionB.y,
  };
}
