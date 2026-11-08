// @ts-check
// 펫 창 프로필(userData: Chromium 캐시·localStorage) 폴더 고르기.
// 다른 DSH(다른 프로필·격리 인스턴스)가 띄운 펫과 같은 폴더를 함께 쓰면 뒤에 뜬 펫은 캐시·localStorage 를 열지 못한다
// ('Unable to move the cache', 'Gpu Cache Creation failed', 펫 크기 기억 안 됨). 그래서 기본 폴더는 그대로 쓰되,
// 이미 다른 펫이 잡고 있으면 뒤에 번호를 붙인 폴더를 쓴다 (펫이 하나뿐인 평소에는 기존 설정이 있는 기본 폴더 그대로).
const fs = require('node:fs')
const path = require('node:path')

const PROFILE_LIMIT = 10   // 기본 폴더 포함 시도할 폴더 수 (동시에 뜨는 펫 수 상한)

/**
 * 이 펫이 쓸 프로필 폴더 선택: 기본 폴더부터 `기본 2`, `기본 3` … 순서로 잡아 보고 처음 잡은 폴더
 * @param {string} base 기본 프로필 폴더
 * @param {(directory: string) => boolean} claim 그 폴더를 이 프로세스 것으로 잡기 (잡으면 true, 다른 펫이 쓰는 중이면 false)
 * @param {number} [limit] 기본 폴더 포함 시도할 폴더 수
 * @returns {string} 처음 잡은 폴더 (모두 잡지 못하면 기본 폴더)
 */
function chooseProfile(base, claim, limit = PROFILE_LIMIT) {
  for (let index = 1; index <= limit; index++) {
    const directory = index === 1 ? base : `${base} ${index}`
    if (claim(directory)) return directory
  }
  return base
}

// 펫이 실행 중 잠가 두는 LevelDB 잠금 파일 (localStorage·sessionStorage)
const LOCK_FILES = [['Local Storage', 'leveldb', 'LOCK'], ['Session Storage', 'LOCK']]

/** 파일 첫 바이트 읽기 (Windows 에서 다른 프로세스가 LevelDB 잠금을 걸어 두었으면 EBUSY 로 실패) @param {string} file */
function readFirstByte(file) {
  const descriptor = fs.openSync(file, 'r')
  try { fs.readSync(descriptor, Buffer.alloc(1), 0, 1, 0) } finally { fs.closeSync(descriptor) }
}

/**
 * 다른 Chromium 프로세스(단일 인스턴스 잠금이 없던 예전 펫 포함)가 이 프로필을 쓰는 중인지 여부.
 * Windows LevelDB 는 잠금 파일 전체에 바이트 범위 잠금을 걸어 두어 다른 프로세스의 읽기가 EBUSY 로 실패함
 * (macOS 의 권고 잠금·파일 없음·그 밖의 오류는 쓰지 않는 것으로 봄)
 * @param {string} directory 프로필 폴더
 * @param {(file: string) => void} [probe] 파일 읽어 보기 (시험용)
 */
function profileInUse(directory, probe = readFirstByte) {
  return LOCK_FILES.some((parts) => {
    try { probe(path.join(directory, ...parts)); return false }
    catch (error) { return /** @type {NodeJS.ErrnoException} */ (error)?.code === 'EBUSY' }
  })
}

module.exports = { chooseProfile, profileInUse }
