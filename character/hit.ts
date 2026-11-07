// 터치 판정에 쓰는 메시 계산 (순수 함수). 정점은 [x0, y0, x1, y1, ...], 인덱스는 삼각형 3개씩.

/** 정점들을 감싸는 사각형 [x0, y0, x1, y1] */
export function meshBounds(v: ArrayLike<number>): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < v.length; k += 2) { if (v[k] < x0) x0 = v[k]; if (v[k] > x1) x1 = v[k]; if (v[k + 1] < y0) y0 = v[k + 1]; if (v[k + 1] > y1) y1 = v[k + 1]; }
  return [x0, y0, x1, y1];
}

/**
 * (px, py)를 덮는 삼각형을 찾아, 그 자리의 텍스처 좌표(u, v)를 alphaAt에 물어 그림이 있는지(알파 40 초과) 본다.
 * 그림이 있는 삼각형을 하나라도 찾으면 true. 삼각형 안이어도 투명하면 다음 삼각형을 본다.
 */
export function meshHit(v: ArrayLike<number>, idx: ArrayLike<number>, uv: ArrayLike<number>, px: number, py: number, alphaAt: (u: number, v: number) => number): boolean {
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
    const d = (v[b + 1] - v[c + 1]) * (v[a] - v[c]) + (v[c] - v[b]) * (v[a + 1] - v[c + 1]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((v[b + 1] - v[c + 1]) * (px - v[c]) + (v[c] - v[b]) * (py - v[c + 1])) / d;
    const l2 = ((v[c + 1] - v[a + 1]) * (px - v[c]) + (v[a] - v[c]) * (py - v[c + 1])) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    if (alphaAt(l1 * uv[a] + l2 * uv[b] + l3 * uv[c], l1 * uv[a + 1] + l2 * uv[b + 1] + l3 * uv[c + 1]) > 40) return true;
  }
  return false;
}
