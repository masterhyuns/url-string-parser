import { ParsedQuery, ParameterFlags, ProcessingMode, ParameterType } from '../types/parser.types';
import { 
  extractValueWithBrackets, 
  determineParameterType, 
  getFinalValue,
  parseNestedStructure,
  detectProcessingMode
} from '../utils/parser.utils';

/**
 * 쿼리스트링을 안전하게 분할하는 함수
 * 
 * 일반적인 split('&')의 문제점:
 * - "name={A_TYPE_1}&where=PROC=!@&r{NAME}" 같은 경우
 * - 중괄호 안의 &를 구분자로 잘못 인식할 수 있음
 * 
 * 해결 방법:
 * - 스택을 이용해 중괄호 깊이 추적
 * - 깊이가 0일 때만 &를 구분자로 인식
 * - 중괄호 안의 &는 무시
 * 
 * 예시:
 * 입력: "name={A&B}&value=test"
 * 일반 split: ["name={A", "B}", "value=test"] ❌
 * 스마트 split: ["name={A&B}", "value=test"] ✅
 * 
 * @param content 분할할 쿼리스트링 내용
 * @returns 안전하게 분할된 key=value 쌍들
 */
const smartSplitQuery = (content: string): string[] => {
  const pairs: string[] = [];
  let current = '';
  let depth = 0; // 중괄호 깊이 추적
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      depth++; // 중괄호 열림
    } else if (char === '}') {
      depth--; // 중괄호 닫힘
    } else if (char === '&' && depth === 0) {
      // 중괄호 바깥에서만 &를 구분자로 인식
      if (current.trim()) {
        pairs.push(current);
      }
      current = '';
      continue; // &는 결과에 포함하지 않음
    }
    
    current += char;
  }
  
  // 마지막 부분 추가
  if (current.trim()) {
    pairs.push(current);
  }
  
  return pairs;
};

/**
 * 쿼리 값을 파싱하는 핵심 함수
 * 
 * 이 함수의 복잡성이 필요한 이유:
 * 1. 전역 플래그와 개별 플래그 모두 처리
 * 2. 중첩된 구조 지원 (예: e{name={A_TYPE_1}&value=r{B_TYPE_2}})
 * 3. 파라미터 모드와 치환 모드 구분
 * 
 * 처리 과정:
 * 1. smartSplitQuery로 안전하게 key=value 분할
 * 2. 각 쌍에 대해 processingMode 감지
 * 3. 모드에 따라 다른 파싱 로직 적용
 * 4. 플래그 병합 (전역 + 개별)
 * 
 * 플래그 병합 정책:
 * - encrypted: 개별 플래그만 사용 (전역은 나중에 적용)
 * - required: 전역 OR 개별
 * - literal: 개별 플래그만 사용
 * 
 * @param value 파싱할 쿼리 값
 * @param globalFlags 전역 플래그 (선택적)
 * @returns 파싱된 쿼리 객체들의 배열
 */
const parseQueryValue = (
  value: string,
  globalFlags: ParameterFlags = { encrypted: false, required: false, literal: false }
): ParsedQuery[] => {
  const results: ParsedQuery[] = [];
  
  /**
   * 재귀적으로 중첩된 구조를 파싱하는 내부 함수
   * 
   * 재귀가 필요한 이유:
   * - {name={A_TYPE_1}&where=r{B_TYPE_2}} 같은 중첩 구조
   * - 안쪽 구조도 다시 key=value 형태로 파싱 필요
   * 
   * @param content 파싱할 내용
   * @param parentFlags 부모에서 전달받은 플래그
   */
  const parseRecursive = (
    content: string,
    parentFlags: ParameterFlags = { encrypted: false, required: false, literal: false }
  ) => {
    const pairs = smartSplitQuery(content);
    
    pairs.forEach(pair => {
      const equalIndex = pair.indexOf('=');
      if (equalIndex === -1) return;
      
      const key = pair.substring(0, equalIndex);
      const val = pair.substring(equalIndex + 1);
      if (!key) return;
      
      const processingMode = detectProcessingMode(val || '');
      
      if (processingMode === ProcessingMode.SUBSTITUTION) {
        // 치환 모드: 복잡한 문자열 처리 - 플래그 추출
        const { flags, extractedValue } = extractValueWithBrackets(val || '');
        const mergedFlags: ParameterFlags = {
          encrypted: flags.encrypted, // 개별 플래그만 사용
          required: parentFlags.required || flags.required,
          literal: flags.literal
        };
        
        results.push({
          key,
          value: val || '',
          originalValue: val || '',
          flags: mergedFlags,
          type: ParameterType.UNKNOWN, // 치환 모드에서는 타입이 정해지지 않음
          extractedValue: extractedValue || val || '',
          convertedValue: null,
          encryptedValue: null,
          finalValue: val || '', // 초기값, 나중에 processSubstitution으로 처리
          processingMode: ProcessingMode.SUBSTITUTION
        });
      } else {
        // 파라미터 모드: 기존 로직
        const { flags, extractedValue } = extractValueWithBrackets(val || '');
        
        // 전역 플래그가 있는 경우 개별 플래그만 사용 (전역은 나중에 적용)
        const mergedFlags: ParameterFlags = {
          encrypted: flags.encrypted, // 개별 플래그만 사용
          required: parentFlags.required || flags.required,
          literal: flags.literal
        };
        
        const type = determineParameterType(
          extractedValue || val || '',
          mergedFlags
        );
        
        results.push({
          key,
          value: val || '',
          originalValue: val || '',
          flags: mergedFlags,
          type,
          extractedValue,
          convertedValue: null,
          encryptedValue: null,
          finalValue: getFinalValue(val || '', extractedValue, null, null, mergedFlags, type, ProcessingMode.PARAMETER),
          processingMode: ProcessingMode.PARAMETER
        });
        
        if (extractedValue && extractedValue.includes('=') && !flags.literal) {
          parseRecursive(extractedValue, mergedFlags);
        }
      }
    });
  };
  
  parseRecursive(value, globalFlags);
  return results;
};

/**
 * 쿼리스트링의 진입점 함수
 * 
 * 이 함수가 하는 중요한 판단:
 * 1. 전역 플래그가 있는가? (예: ?e{name={A_TYPE_1}&value=test})
 * 2. 있다면 전체를 하나의 전역 쿼리로 처리
 * 3. 없다면 일반 쿼리들로 개별 처리
 * 
 * 전역 플래그 처리의 특별함:
 * - 전체 쿼리스트링이 하나의 암호화/변환 단위가 됨
 * - 내부 쿼리들을 먼저 처리한 후, 전체를 다시 암호화
 * - 결과적으로 단일 암호화된 문자열이 됨
 * 
 * 예시:
 * ?e{name=A_TYPE_1&value=B_TYPE_2}
 * → 1) name=A_TYPE_1_VALUE&value=B_TYPE_2_VALUE (내부 처리)
 * → 2) 전체 문자열 암호화
 * → 3) 최종: 암호화된_문자열
 * 
 * @param query 쿼리스트링 (?를 제외한 부분)
 * @returns 파싱된 쿼리 객체들의 배열
 */
export const parseQueryString = (query: string): ParsedQuery[] => {
  if (!query) return [];
  
  // 1단계: 전역 플래그 확인
  // parseNestedStructure가 ?er{...} 형태를 감지
  const { globalFlags, content } = parseNestedStructure(query);
  
  // 2단계: 전역 플래그가 있는 경우 특별 처리
  if (globalFlags.encrypted || globalFlags.required || globalFlags.literal) {
    // 내부 쿼리들을 먼저 파싱
    const innerResults = parseQueryValue(content, globalFlags);
    
    // 전역 쿼리 객체 생성 (특별한 구조)
    // 이 객체는 나중에 transformService에서 특별히 처리됨
    return [{
      key: '__GLOBAL__', // 특수 키로 전역 처리 표시
      value: query,
      originalValue: query,
      flags: globalFlags,
      type: ParameterType.GLOBAL, // 전역 처리 표시용
      extractedValue: content,
      convertedValue: null,
      encryptedValue: null,
      finalValue: query,
      processingMode: ProcessingMode.SUBSTITUTION,
      innerResults: innerResults // 내부 파싱 결과 저장 (중요!)
    } as ParsedQuery & { type: ParameterType.GLOBAL; innerResults: ParsedQuery[] }];
  }
  
  // 3단계: 일반 쿼리스트링 파싱
  // 전역 플래그가 없으면 개별 쿼리들로 처리
  return parseQueryValue(query);
};