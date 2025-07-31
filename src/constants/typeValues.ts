/**
 * A/B 타입 값 상수들
 * 파싱과 변환에서 사용되는 타입 감지를 위한 값들
 */

export const ATYPE_VALUES = [
  'A_TYPE_1', 
  'A_TYPE_2', 
  'A_TYPE_3', 
  'A_TYPE_4', 
  'A_TYPE_5', 
  'A_TYPE_6',
  'A_TYPE_11', 
  'A_TYPE3',
  'PROC', 
  'NAME', 
  'AGE', 
  'AED',
  'TEXT'
] as const;

export const BTYPE_VALUES = [
  'B_TYPE_1', 
  'B_TYPE_2', 
  'B_TYPE_3', 
  'B_TYPE_4',
  'B_TYPE_9'
] as const;

export type ATypeValue = typeof ATYPE_VALUES[number];
export type BTypeValue = typeof BTYPE_VALUES[number];