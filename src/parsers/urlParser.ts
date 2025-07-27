import { ParsedSegment, ParameterType, ProcessingMode } from '../types/parser.types';
import { 
  extractValueWithBrackets, 
  determineParameterType, 
  getFinalValue,
  detectProcessingMode
} from '../utils/parser.utils';

/**
 * URL 경로를 세그먼트별로 파싱하는 함수
 * 
 * URL 세그먼트의 특별한 처리가 필요한 이유:
 * - 쿼리와 달리 key=value 구조가 아님
 * - /segment1/segment2/segment3 형태
 * - 각 세그먼트는 독립적으로 파싱됨
 * 
 * 지원하는 패턴:
 * 1. 파라미터 모드: /e{A_TYPE_1}/v{LITERAL}
 * 2. 치환 모드: /v{TEXT}.com, /prefix_r{NAME}_suffix
 * 
 * 파라미터 vs 치환 모드 구분:
 * - 파라미터: 세그먼트 전체가 [플래그]{값} 형태
 * - 치환: 세그먼트에 중괄호와 다른 문자가 섞여 있음
 * 
 * 예시:
 * /e{A_TYPE_1} → 파라미터 모드 → A_TYPE_1_VALUE (암호화)
 * /v{TEXT}.com → 치환 모드 → TEXT.com
 * 
 * @param path URL 경로 부분 (/ 포함)
 * @returns 파싱된 세그먼트 객체들의 배열
 */
export const parseUrlSegments = (path: string): ParsedSegment[] => {
  if (!path) return [];
  
  // /로 분할하여 빈 세그먼트 제거
  const segments = path.split('/').filter(segment => segment !== '');
  
  return segments.map(segment => {
    // 각 세그먼트의 처리 모드 감지 (핵심!)
    const processingMode = detectProcessingMode(segment);
    
    if (processingMode === ProcessingMode.SUBSTITUTION) {
      // 치환 모드 처리: v{TEXT}.com → TEXT.com
      // extractValueWithBrackets는 전체 패턴 분석을 위해 호출
      // 하지만 실제 치환은 processSubstitution에서 수행
      const { flags } = extractValueWithBrackets(segment);
      
      return {
        segment,
        originalValue: segment,
        flags, // 전체 세그먼트에서 감지된 플래그 (보통 빈 값)
        type: ParameterType.UNKNOWN, // 치환 모드에서는 타입이 정해지지 않음
        extractedValue: segment, // 전체 문자열을 추출값으로 설정
        convertedValue: null, // 나중에 processSubstitution에서 설정
        encryptedValue: null, // 나중에 암호화 처리
        finalValue: segment, // 초기값, transformService에서 실제 치환 후 업데이트
        processingMode: ProcessingMode.SUBSTITUTION
      };
    } else {
      // 파라미터 모드 처리: e{A_TYPE_1} → A_TYPE_1_VALUE (암호화)
      const { flags, extractedValue } = extractValueWithBrackets(segment);
      
      // 추출된 값의 타입 결정
      const type = determineParameterType(
        extractedValue || segment,
        flags
      );
      
      return {
        segment,
        originalValue: segment,
        flags,
        type,
        extractedValue, // 중괄호 안의 값
        convertedValue: null, // 나중에 변환 API 호출 결과
        encryptedValue: null, // 나중에 암호화 처리
        finalValue: getFinalValue(segment, extractedValue, null, null, flags, type, ProcessingMode.PARAMETER),
        processingMode: ProcessingMode.PARAMETER
      };
    }
  });
};