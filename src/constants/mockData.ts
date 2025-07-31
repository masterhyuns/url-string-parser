/**
 * 테스트용 Mock 데이터 상수들
 * 모든 테스트에서 공통으로 사용되는 타입 변환 데이터를 중앙 집중식으로 관리
 */

/**
 * A 타입 변환 데이터
 */
export const MOCK_TYPE_A_DATA: Record<string, string> = {
  'A_TYPE_1': 'A_TYPE_1_VALUE',
  'A_TYPE_2': 'A_TYPE_2_VALUE',
  'A_TYPE_3': 'A_TYPE_3_VALUE',
  'A_TYPE_4': 'A_TYPE_4_VALUE',
  'A_TYPE_6': 'A_TYPE_6_VALUE',
  'A_TYPE_11': 'A_TYPE_11_VALUE',
  'A_TYPE3': 'A_TYPE3_VALUE', // 사용자 테스트 케이스용
  'PROC': 'PROC_VALUE',
  'NAME': 'NAME_VALUE',
  'TEXT': 'TEXT'
} as const;

/**
 * B 타입 변환 데이터
 */
export const MOCK_TYPE_B_DATA: Record<string, string> = {
  'B_TYPE_1': 'B_TYPE_1_VALUE',
  'B_TYPE_2': 'B_TYPE_2_VALUE',
  'B_TYPE_3': 'B_TYPE_3_VALUE',
  'B_TYPE_4': 'B_TYPE_4_VALUE',
  'B_TYPE_9': 'B_TYPE_9_VALUE'
} as const;

/**
 * 암호화 접두사 (테스트용)
 */
export const ENCRYPTION_PREFIX = 'ENC' as const;