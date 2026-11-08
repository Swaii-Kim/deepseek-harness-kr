// 터치 판정에 쓰는 메시 계산 (순수 함수). 정점은 [x0, y0, x1, y1, ...], 인덱스는 삼각형 3개씩.

/** 정점들을 감싸는 사각형 [x0, y0, x1, y1] */
export function meshBounds(vertices: ArrayLike<number>): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < vertices.length; i += 2) { if (vertices[i] < x0) x0 = vertices[i]; if (vertices[i] > x1) x1 = vertices[i]; if (vertices[i + 1] < y0) y0 = vertices[i + 1]; if (vertices[i + 1] > y1) y1 = vertices[i + 1]; }
  return [x0, y0, x1, y1];
}

/**
 * (px, py)를 덮는 삼각형을 찾아, 그 자리의 텍스처 좌표(u, v)를 alphaAt에 물어 그림이 있는지(알파 40 초과) 확인
 * 삼각형 안이어도 투명하면 다음 삼각형 확인
 * @param vertices 정점 좌표 [x, y, ...] (모델 좌표)
 * @param indices 삼각형 정점 번호 (3개씩)
 * @param uvs 정점별 텍스처 좌표 [u, v, ...]
 * @param px 판정할 점 x (모델 좌표)
 * @param py 판정할 점 y (모델 좌표)
 * @param alphaAt 텍스처 좌표의 알파 (0~255)
 * @returns 그림이 있는 삼각형을 하나라도 찾으면 true
 */
export function meshHit(vertices: ArrayLike<number>, indices: ArrayLike<number>, uvs: ArrayLike<number>, px: number, py: number, alphaAt: (u: number, v: number) => number): boolean {
  for (let i = 0; i < indices.length; i += 3) {
    const cornerA = indices[i] * 2, cornerB = indices[i + 1] * 2, cornerC = indices[i + 2] * 2;
    const det = (vertices[cornerB + 1] - vertices[cornerC + 1]) * (vertices[cornerA] - vertices[cornerC]) + (vertices[cornerC] - vertices[cornerB]) * (vertices[cornerA + 1] - vertices[cornerC + 1]);
    if (Math.abs(det) < 1e-9) continue;
    const weightA = ((vertices[cornerB + 1] - vertices[cornerC + 1]) * (px - vertices[cornerC]) + (vertices[cornerC] - vertices[cornerB]) * (py - vertices[cornerC + 1])) / det;
    const weightB = ((vertices[cornerC + 1] - vertices[cornerA + 1]) * (px - vertices[cornerC]) + (vertices[cornerA] - vertices[cornerC]) * (py - vertices[cornerC + 1])) / det;
    const weightC = 1 - weightA - weightB;
    if (weightA < 0 || weightB < 0 || weightC < 0) continue;
    if (alphaAt(weightA * uvs[cornerA] + weightB * uvs[cornerB] + weightC * uvs[cornerC], weightA * uvs[cornerA + 1] + weightB * uvs[cornerB + 1] + weightC * uvs[cornerC + 1]) > 40) return true;
  }
  return false;
}
