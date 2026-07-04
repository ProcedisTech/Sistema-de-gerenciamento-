/**
 * Algoritmo de Ramer-Douglas-Peucker para simplificação de curvas.
 * Reduz a quantidade de vértices mantendo o formato geral.
 * 
 * @param {Array<{x: number, y: number}>} points Array de pontos {x, y}
 * @param {number} epsilon Tolerância da distância perpendicular (ex: 0.5%)
 * @returns {Array<{x: number, y: number}>} Pontos simplificados
 */
export function simplifyCurveRDP(points, epsilon) {
  if (points.length <= 2) return points;

  // Encontrar o ponto com a maior distância da reta formada pelo primeiro e último ponto
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  // Se a distância máxima for maior que o epsilon, simplificar recursivamente
  if (dmax > epsilon) {
    const leftCurve = simplifyCurveRDP(points.slice(0, index + 1), epsilon);
    const rightCurve = simplifyCurveRDP(points.slice(index), epsilon);
    
    // Evitar duplicar o ponto do meio (index)
    return leftCurve.slice(0, leftCurve.length - 1).concat(rightCurve);
  } else {
    // Caso contrário, apenas retornar os extremos
    return [points[0], points[end]];
  }
}

/**
 * Distância perpendicular de um ponto p até a reta formada por p1 e p2.
 */
function perpendicularDistance(p, p1, p2) {
  // Se p1 e p2 são o mesmo ponto
  if (p1.x === p2.x && p1.y === p2.y) {
    return Math.sqrt(Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2));
  }

  const num = Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x);
  const den = Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
  return num / den;
}

/**
 * Distância euclidiana simples entre dois pontos
 */
export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
