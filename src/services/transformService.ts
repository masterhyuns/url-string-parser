import { 
  ParsedParameter, 
  ParsedSegment, 
  ParsedQuery,
  GlobalParsedQuery,
  TypeConverter,
  Encryptor,
  ParameterType,
  ProcessingMode,
  TransformationTrace
} from '../types/parser.types';
import { getFinalValue, processSubstitution } from '../utils/parser.utils';

/**
 * SUBSTITUTION 모드 변환을 처리하는 함수
 */
const handleSubstitutionMode = async <T extends ParsedParameter>(
  param: T,
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<string> => {
  return await processSubstitution(
    param.extractedValue || param.originalValue,
    typeConverter,
    encryptor,
    onInnerTrace ? (trace) => {
      const location = 'key' in param ? 'query' : 'url';
      const identifier = 'key' in param ? (param as { key: string }).key : 'segment';
      onInnerTrace(trace, location, identifier);
    } : undefined
  );
};

/**
 * PARAMETER 모드 변환을 처리하는 함수
 */
const handleParameterMode = async <T extends ParsedParameter>(
  param: T,
  typeConverter?: TypeConverter
): Promise<string | null> => {
  if (param.extractedValue && !param.flags.literal) {
    if (typeConverter && param.type !== ParameterType.UNKNOWN && param.type !== ParameterType.LITERAL) {
      try {
        return await typeConverter(param.extractedValue, param.type);
      } catch (error) {
        console.error('Type conversion failed:', error);
      }
    }
  }
  return null;
};

/**
 * 암호화 처리를 수행하는 함수
 */
const handleEncryption = async (
  param: ParsedParameter,
  convertedValue: string | null,
  encryptor?: Encryptor
): Promise<string | null> => {
  if (!param.flags.encrypted || !encryptor) {
    return null;
  }

  // 암호화할 값 선택: 변환값 > 리터럴값 > null
  const valueToEncrypt = convertedValue || (param.flags.literal ? param.extractedValue : null);
  if (valueToEncrypt) {
    try {
      return await encryptor(valueToEncrypt);
    } catch (error) {
      console.error('Encryption failed:', error);
    }
  }
  return null;
};

/**
 * 파싱된 파라미터를 실제 값으로 변환하는 핵심 함수
 * 
 * 이 함수가 처리하는 변환 과정:
 * 1. 처리 모드 확인 (파라미터 vs 치환)
 * 2. 타입 변환 (A/B 타입 → API 호출)
 * 3. 암호화 (e 플래그 → 암호화 API 호출)
 * 4. 최종값 결정 (우선순위 적용)
 * 
 * 처리 모드별 차이점:
 * - 파라미터 모드: 단순 값 변환 (e{A_TYPE_1} → 변환 → 암호화)
 * - 치환 모드: 복잡한 문자열 치환 (processSubstitution 호출)
 * 
 * 값 우선순위 (getFinalValue에서 적용):
 * 1. 암호화된 값 (최우선)
 * 2. 변환된 값
 * 3. 리터럴 값 (v 플래그)
 * 4. 원본 값 (최후)
 * 
 * @param param 파싱된 파라미터 객체
 * @param typeConverter 타입 변환 함수 (선택적)
 * @param encryptor 암호화 함수 (선택적)
 * @returns 변환 완료된 파라미터 객체
 */
export const transformParameter = async <T extends ParsedParameter>(
  param: T,
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<T> => {
  
  // 1단계: 처리 모드별 변환 (항상 DEFAULT 모드로 처리)
  let convertedValue: string | null = null;
  
  if ('processingMode' in param && (param as { processingMode: ProcessingMode }).processingMode === ProcessingMode.SUBSTITUTION) {
    // 치환 모드: 복잡한 문자열 내부의 중괄호들을 처리
    convertedValue = await handleSubstitutionMode(param, typeConverter, encryptor, onInnerTrace);
  } else {
    // 파라미터 모드: 단순 값 변환
    convertedValue = await handleParameterMode(param, typeConverter);
  }
  
  // 2단계: 암호화 처리
  const encryptedValue = await handleEncryption(param, convertedValue, encryptor);
  
  // 3단계: 최종값 결정
  const finalValue = getFinalValue(
    param.originalValue,
    param.extractedValue,
    convertedValue,
    encryptedValue,
    param.flags,
    param.type,
    ProcessingMode.PARAMETER
  );
  
  return {
    ...param,
    convertedValue,
    encryptedValue,
    finalValue
  };
};

/**
 * URL 세그먼트 배열을 변환하는 함수
 * 
 * URL 세그먼트의 특별한 처리가 필요한 이유:
 * - URL 세그먼트는 치환 모드를 지원 (v{TEXT}.com → TEXT.com)
 * - 파라미터 모드도 지원 (e{A_TYPE_1} → A_TYPE_1_VALUE)
 * - 쿼리와 달리 key=value 구조가 아님
 * 
 * 처리 방식:
 * 1. 각 세그먼트의 processingMode 확인
 * 2. 치환 모드: processSubstitution 호출 + 개별 암호화
 * 3. 파라미터 모드: transformParameter 호출 (표준 로직)
 * 
 * 치환 모드 vs 파라미터 모드 차이:
 * - 치환: v{TEXT}.com → processSubstitution → TEXT.com
 * - 파라미터: e{A_TYPE_1} → transformParameter → A_TYPE_1_VALUE (암호화)
 * 
 * @param segments 파싱된 URL 세그먼트 배열
 * @param typeConverter 타입 변환 함수 (선택적)
 * @param encryptor 암호화 함수 (선택적)
 * @returns 변환 완료된 세그먼트 배열
 */
/**
 * SUBSTITUTION 모드 세그먼트를 처리하는 함수
 */
const handleSegmentSubstitution = async (
  segment: ParsedSegment,
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  segmentIndex: number,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<ParsedSegment> => {
  // 치환 모드 특별 처리: v{TEXT}.com → TEXT.com
  const substitutedValue = await processSubstitution(
    segment.extractedValue || segment.originalValue,
    typeConverter,
    encryptor,
    onInnerTrace ? (trace) => {
      onInnerTrace(trace, 'url', `segment-${segmentIndex}`);
    } : undefined
  );
  
  // 치환 후 추가 암호화 (e 플래그가 있는 경우)
  const encryptedValue = await handleEncryption(segment, substitutedValue, encryptor);
  
  return {
    ...segment,
    convertedValue: substitutedValue,
    encryptedValue,
    finalValue: encryptedValue || substitutedValue
  };
};

export const transformSegments = async (
  segments: ParsedSegment[],
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<ParsedSegment[]> => {
  return Promise.all(
    segments.map(async (segment, index) => {
      if (segment.processingMode === ProcessingMode.SUBSTITUTION) {
        return handleSegmentSubstitution(segment, typeConverter, encryptor, index, onInnerTrace);
      } else {
        // 파라미터 모드: 표준 변환 로직 적용
        return transformParameter(segment, typeConverter, encryptor, onInnerTrace ? 
          (trace: Omit<TransformationTrace, 'location' | 'identifier'>) => onInnerTrace(trace, 'url', `segment-${index}`) : undefined);
      }
    })
  );
};

/**
 * 쿼리 배열을 변환하는 함수
 * 
 * 쿼리 처리의 복잡성:
 * 1. 전역 쿼리 vs 일반 쿼리 구분
 * 2. 치환 모드 vs 파라미터 모드 처리
 * 3. 각각에 대한 적절한 변환 로직 적용
 * 
 * 처리 우선순위:
 * 1. 전역 쿼리 (type === 'GLOBAL') → processGlobalQuery
 * 2. 치환 모드 → processSubstitution + 개별 암호화
 * 3. 파라미터 모드 → transformParameter (표준 로직)
 * 
 * 전역 쿼리의 특별함:
 * - ?e{name={A_TYPE_1}&value=test} 같은 형태
 * - 내부 쿼리들을 먼저 변환한 후 전체 암호화
 * - 최종 결과는 단일 암호화된 문자열
 * 
 * @param queries 파싱된 쿼리 객체 배열
 * @param typeConverter 타입 변환 함수 (선택적)
 * @param encryptor 암호화 함수 (선택적)
 * @returns 변환 완료된 쿼리 배열
 */
/**
 * SUBSTITUTION 모드 쿼리를 처리하는 함수
 */
const handleQuerySubstitution = async (
  query: ParsedQuery,
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<ParsedQuery> => {
  // 치환 모드: where=PROC=!@r{NAME} → where=PROC=!@NAME_VALUE
  const substitutedValue = await processSubstitution(
    query.extractedValue || query.originalValue,
    typeConverter,
    encryptor,
    onInnerTrace ? (trace) => {
      onInnerTrace(trace, 'query', query.key);
    } : undefined
  );
  
  // 치환 후 추가 암호화 (e 플래그가 있는 경우)
  const encryptedValue = await handleEncryption(query, substitutedValue, encryptor);
  
  return {
    ...query,
    convertedValue: substitutedValue,
    encryptedValue,
    finalValue: encryptedValue || substitutedValue
  };
};

export const transformQueries = async (
  queries: ParsedQuery[],
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<ParsedQuery[]> => {
  return Promise.all(
    queries.map(async (query) => {
      // 1순위: 전역 플래그 처리 (가장 복잡한 케이스)
      if (query.type === ParameterType.GLOBAL) {
        return await processGlobalQuery(query as GlobalParsedQuery, typeConverter, encryptor, onInnerTrace);
      }
      
      // 2순위: 치환 모드 처리
      if (query.processingMode === ProcessingMode.SUBSTITUTION) {
        return handleQuerySubstitution(query, typeConverter, encryptor, onInnerTrace);
      } else {
        // 3순위: 파라미터 모드 (표준 로직)
        return transformParameter(query, typeConverter, encryptor, onInnerTrace ? 
          (trace: Omit<TransformationTrace, 'location' | 'identifier'>) => onInnerTrace(trace, 'query', query.key) : undefined);
      }
    })
  );
};

/**
 * 전역 쿼리를 처리하는 특별한 함수
 * 
 * 전역 쿼리가 복잡한 이유:
 * - ?e{name={A_TYPE_1}&value=test} 형태
 * - 2단계 변환: 내부 → 전체
 * - 내부 쿼리들을 먼저 변환한 후, 전체 문자열을 다시 암호화
 * 
 * 처리 과정:
 * 1. 내부 쿼리들 개별 변환 (name={A_TYPE_1} → name=A_TYPE_1_VALUE)
 * 2. 변환 결과들을 key=value&key=value 형태로 재구성
 * 3. 전체 문자열 암호화 (e 플래그가 있는 경우)
 * 4. 최종 결과: 암호화된_문자열
 * 
 * 왜 이런 복잡한 처리가 필요한가:
 * - 보안: 개별 값들이 변환된 후, 전체가 한 번 더 암호화됨
 * - 무결성: 쿼리스트링 전체가 하나의 암호화 단위가 됨
 * - 중첩 처리: 내부에 또 다른 복잡한 구조가 있을 수 있음
 * 
 * @param globalQuery 전역 플래그가 있는 쿼리 객체
 * @param typeConverter 타입 변환 함수 (선택적)
 * @param encryptor 암호화 함수 (선택적)
 * @returns 변환 완료된 전역 쿼리 객체
 */
const processGlobalQuery = async (
  globalQuery: GlobalParsedQuery,
  typeConverter?: TypeConverter,
  encryptor?: Encryptor,
  onInnerTrace?: (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => void
): Promise<GlobalParsedQuery> => {
  // 1단계: 내부 쿼리들을 먼저 개별 변환
  // globalQuery.innerResults는 parseQueryString에서 생성된 내부 쿼리들
  
  const transformedInnerResults = await Promise.all(
    globalQuery.innerResults.map((innerQuery: ParsedQuery) => {
      // 모든 내부 쿼리에 onInnerTrace 콜백 전달
      // SUBSTITUTION 모드인 경우 processSubstitution 내부에서 개별 변환 추적
      const innerTraceCallback = onInnerTrace ? 
        (trace: Omit<TransformationTrace, 'location' | 'identifier'>) => onInnerTrace(trace, 'query', `__GLOBAL__.${innerQuery.key}`) : 
        undefined;
      
      return transformParameter(innerQuery, typeConverter, encryptor, innerTraceCallback);
    })
  );
  
  // 2단계: 변환된 내부 결과들을 쿼리스트링 형태로 재구성
  // [name=A_TYPE_1_VALUE, value=test] → "name=A_TYPE_1_VALUE&value=test"
  // 파싱 단계에서는 필터링하지 않고 모든 결과 포함
  const reconstructedContent = transformedInnerResults
    .filter(q => q.finalValue) // 빈 값만 제외
    .map(q => `${q.key}=${q.finalValue}`)
    .join('&');
  
  // 3단계: 내부 변환 결과만 저장, 전체 암호화는 getReconstructedUrl에서 처리
  const finalValue = reconstructedContent;
  const encryptedValue: string | null = null;
  
  // 전역 암호화는 getReconstructedUrl에서 필터링 후에 처리
  
  return {
    ...globalQuery,
    convertedValue: reconstructedContent, // 재구성된 문자열
    encryptedValue, // 전체 암호화 결과
    finalValue, // 최종 사용할 값 (암호화 우선)
    innerResults: transformedInnerResults // 디버깅용 내부 결과 보존
  };
};