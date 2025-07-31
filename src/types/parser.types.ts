export enum ParameterType {
  A = 'A',
  B = 'B',
  LITERAL = 'LITERAL',
  UNKNOWN = 'UNKNOWN',
  GLOBAL = 'GLOBAL'
}

export enum ProcessingMode {
  PARAMETER = 'PARAMETER',     // name={A_TYPE_2} - 값 없으면 제외
  SUBSTITUTION = 'SUBSTITUTION' // where=e{...} - 값 없으면 빈값으로 치환
}

export enum FilteringMode {
  DEFAULT = 'DEFAULT',     // 기본 모드: 변환 가능한 모든 값 포함
  STRICT = 'STRICT'        // 엄격한 모드: 일반 문자열과 v(리터럴)만 포함
}

export interface ParameterFlags {
  encrypted: boolean;
  required: boolean;
  literal: boolean;
}

export interface ParsedParameter {
  originalValue: string;
  flags: ParameterFlags;
  type: ParameterType;
  extractedValue: string | null;
  convertedValue: string | null;
  encryptedValue: string | null;
  finalValue: string;
}

export interface ParsedSegment extends ParsedParameter {
  segment: string;
  processingMode: ProcessingMode;
}

export interface ParsedQuery extends ParsedParameter {
  key: string;
  value: string;
  processingMode: ProcessingMode;
}

export interface GlobalParsedQuery extends ParsedQuery {
  type: ParameterType.GLOBAL;
  innerResults: ParsedQuery[];
}

/**
 * 변환 추적 정보 - 어떤 값이 어떻게 변환되었는지 기록
 */
export interface TransformationTrace {
  /** 원본 타입 (A, B, LITERAL 등) */
  type: ParameterType;
  /** 변환 대상이 된 원본 값 */
  target: string;
  /** 타입 변환된 값 (암호화 전) */
  convertedValue: string | null;
  /** 암호화된 값 */
  encryptedValue: string | null;
  /** 최종 변환된 결과 값 */
  result: string;
  /** 어디서 발견되었는지 (URL 세그먼트인지 쿼리인지) */
  location: 'url' | 'query';
  /** URL/쿼리의 키 또는 세그먼트 인덱스 */
  identifier: string;
  /** 적용된 플래그들 */
  flags: ParameterFlags;
  /** 처리 모드 */
  processingMode: ProcessingMode;
  /** 변환 성공 여부 */
  transformationSuccess: boolean;
  /** 변환 실패 이유 (실패한 경우) */
  failureReason?: string;
}

export interface ParseResult {
  baseUrl: string;
  reconstructedPath: string;
  url: ParsedSegment[];
  query: ParsedQuery[];
  /** 변환 과정 추적 정보 배열 */
  transformationTraces: TransformationTrace[];
}

export type TypeConverter = (value: string, type: ParameterType) => Promise<string>;
export type Encryptor = (value: string) => Promise<string>;

// 타입 값들은 별도 파일로 분리
export { ATYPE_VALUES, BTYPE_VALUES, type ATypeValue, type BTypeValue } from '../constants/typeValues';