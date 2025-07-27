import { useState, useCallback } from 'react';
import { 
  ParseResult, 
  TypeConverter, 
  Encryptor,
  ProcessingMode,
  TransformationTrace,
  ParameterType,
  ParsedQuery
} from '../types/parser.types';
import { parseUrlComponents, isValidValue } from '../utils/parser.utils';
import { parseUrlSegments } from '../parsers/urlParser';
import { parseQueryString } from '../parsers/queryParser';
import { transformSegments, transformQueries } from '../services/transformService';

/**
 * URL과 QueryString 파싱 상태를 관리하는 React Hook
 * 
 * 이 Hook이 필요한 이유:
 * - URL 파싱은 복잡한 다단계 프로세스이며, 중간 상태들을 React 컴포넌트에서 관리해야 함
 * - 파싱 결과를 컴포넌트 간에 공유하고 업데이트할 필요
 * - 비동기 변환 작업(타입 변환, 암호화)과 React 상태를 연결
 * - 변환 추적 정보도 함께 상태로 관리하여 디버깅 지원
 * 
 * 상태 관리 구조:
 * - parseResult: 전체 파싱 결과 (baseUrl, path, url segments, queries, traces)
 * - updateParseResult: 새로운 URL 문자열을 파싱하여 상태 업데이트
 * - getReconstructedUrl: 파싱된 결과를 다시 URL 문자열로 재구성
 * 
 * 변환 추적 시스템:
 * - 모든 중괄호 패턴의 변환 과정을 TransformationTrace로 기록
 * - 성공/실패 여부, 변환 전후 값, 실패 이유 등을 상세 추적
 * - 디버깅과 검증에 활용
 * 
 * @param typeConverter A/B 타입을 실제 값으로 변환하는 함수 (선택적)
 * @param encryptor 값을 암호화하는 함수 (선택적)
 * @returns 파싱 상태와 상태 조작 함수들
 */
export const useParseState = (
  typeConverter?: TypeConverter,
  encryptor?: Encryptor
) => {
  // 파싱 결과를 담는 메인 상태
  // 왜 이런 구조로 설계했는가:
  // - baseUrl: 프로토콜과 호스트 정보 (URL 재구성시 필요)
  // - reconstructedPath: 변환된 세그먼트들로 재구성된 경로
  // - url: 개별 URL 세그먼트 파싱 결과 배열
  // - query: 개별 쿼리 파라미터 파싱 결과 배열  
  // - transformationTraces: 모든 변환 과정 추적 정보
  const [parseResult, setParseResult] = useState<ParseResult>({
    baseUrl: '',
    reconstructedPath: '',
    url: [],
    query: [],
    transformationTraces: []
  });

  /**
   * URL 문자열을 파싱하여 상태를 업데이트하는 핵심 함수
   * 
   * 이 함수의 처리 과정:
   * 1. URL 분해: protocol, host, path, query로 구성요소 분리
   * 2. 개별 파싱: URL 세그먼트와 쿼리 파라미터를 각각 파싱
   * 3. 변환 적용: applyTransform=true인 경우 타입 변환과 암호화 수행
   * 4. 추적 수집: 변환 과정의 모든 정보를 TransformationTrace로 기록
   * 5. 상태 업데이트: 최종 결과를 React 상태로 저장
   * 
   * applyTransform 매개변수의 의미:
   * - false: 파싱만 수행 (구조 분석, 플래그 감지)
   * - true: 파싱 + 실제 변환 (API 호출, 암호화 적용)
   * 
   * 왜 두 단계로 나눴는가:
   * - 파싱 단계에서 먼저 구조를 검증하고 오류를 발견
   * - 변환 단계는 비용이 크므로(API 호출) 필요할 때만 실행
   * - 개발 중에는 파싱만으로도 구조 확인 가능
   * 
   * @param urlString 파싱할 URL 문자열
   * @param applyTransform 실제 변환(타입 변환, 암호화)을 적용할지 여부
   */
  const updateParseResult = useCallback(
    async (urlString: string, applyTransform: boolean = false) => {
      // 1단계: URL을 기본 구성요소로 분리
      const { protocol, host, path, query } = parseUrlComponents(urlString);
      
      // 베이스 URL 구성 (프로토콜 + 호스트)
      const baseUrl = protocol && host ? `${protocol}://${host}` : '';
      
      // 2단계: 각 부분을 개별 파싱
      let parsedSegments = parseUrlSegments(path);
      let parsedQueries = parseQueryString(query);
      
      // 변환 추적 정보 수집용 배열
      // 왜 로컬 배열로 관리하는가:
      // - 이 함수 실행 중에만 필요한 임시 데이터
      // - 모든 변환이 완료된 후 한 번에 상태에 저장
      // - 중간 상태 업데이트로 인한 렌더링 최적화
      const transformationTraces: TransformationTrace[] = [];
      
      // 3단계: 변환 적용 (applyTransform=true인 경우만)
      if (applyTransform) {
        // 내부 추적 콜백 정의
        // 이 콜백이 필요한 이유:
        // - SUBSTITUTION 모드에서 내부 중괄호들({r{NAME}} 같은)의 개별 변환을 추적
        // - 변환 서비스에서 호출되어 추적 정보를 이곳으로 전달
        // - 전체 변환 과정의 완전한 가시성 확보
        const onInnerTrace = (trace: Omit<TransformationTrace, 'location' | 'identifier'>, location: 'url' | 'query', identifier: string) => {
          transformationTraces.push({
            ...trace,
            location,
            identifier: `${identifier}.inner.${trace.target}`, // 중첩 식별자로 구분
            processingMode: ProcessingMode.SUBSTITUTION // 내부 변환은 항상 치환 모드
          });
        };
        
        // 병렬 변환 실행 (성능 최적화)
        parsedSegments = await transformSegments(parsedSegments, typeConverter, encryptor, onInnerTrace);
        parsedQueries = await transformQueries(parsedQueries, typeConverter, encryptor, onInnerTrace);
        
        // 4단계: URL 세그먼트 변환 추적 수집
        // 왜 변환 후에 추적을 수집하는가:
        // - 변환 결과(convertedValue, encryptedValue)가 있어야 완전한 추적 정보 생성 가능
        // - 성공/실패 여부를 정확히 판단하려면 최종 결과가 필요
        // - 실패 이유도 변환 시도 후에만 알 수 있음
        parsedSegments.forEach((segment, index) => {
          // extractedValue가 있는 것만 추적 (중괄호 패턴이 있었던 것들)
          if (segment.extractedValue) {
            // 변환 성공 여부 판단 로직
            // 성공의 기준: 값이 실제로 변화했거나, 의도된 처리가 수행됨
            const hasConversion = segment.convertedValue !== null && segment.convertedValue !== segment.extractedValue;
            const hasEncryption = segment.encryptedValue !== null;
            const isChanged = segment.extractedValue !== segment.finalValue;
            
            // 실패 이유 결정 로직
            // 왜 이렇게 복잡한가: 다양한 실패 시나리오를 구분하여 디버깅 지원
            let failureReason: string | undefined;
            if (!hasConversion && segment.type !== ParameterType.LITERAL && !segment.flags.literal) {
              if (segment.type === ParameterType.UNKNOWN) {
                failureReason = `알 수 없는 타입: "${segment.extractedValue}"가 A/B 타입 목록에 없음`;
              } else {
                failureReason = 'TypeConverter 함수가 제공되지 않음';
              }
            }
            
            // 추적 정보 생성 및 저장
            transformationTraces.push({
              type: segment.type,
              target: segment.extractedValue,
              convertedValue: segment.convertedValue,
              encryptedValue: segment.encryptedValue,
              result: segment.finalValue,
              location: 'url',
              identifier: `segment-${index}`, // URL 세그먼트 식별자
              flags: segment.flags,
              processingMode: segment.processingMode || ProcessingMode.PARAMETER,
              transformationSuccess: isChanged || hasConversion || hasEncryption || segment.flags.literal,
              failureReason
            });
          }
        });
        
        // 5단계: 쿼리 변환 추적 수집
        // 쿼리는 URL 세그먼트보다 복잡함 (일반 쿼리 + 전역 쿼리 + 내부 결과)
        parsedQueries.forEach((queryParam) => {
          // 일반 쿼리 파라미터 추적
          // 전역 쿼리(type='GLOBAL')는 별도 처리하므로 제외
          if (queryParam.extractedValue && !('type' in queryParam && (queryParam as { type: string }).type === 'GLOBAL')) {
            // 변환 성공 여부 판단 (URL 세그먼트와 동일한 로직)
            const hasConversion = queryParam.convertedValue !== null && queryParam.convertedValue !== queryParam.extractedValue;
            const hasEncryption = queryParam.encryptedValue !== null;
            const isChanged = queryParam.extractedValue !== queryParam.finalValue;
            
            // 실패 이유 결정 (URL 세그먼트와 동일한 로직)
            let failureReason: string | undefined;
            if (!hasConversion && queryParam.type !== ParameterType.LITERAL && !queryParam.flags.literal) {
              if (queryParam.type === ParameterType.UNKNOWN) {
                failureReason = `알 수 없는 타입: "${queryParam.extractedValue}"가 A/B 타입 목록에 없음`;
              } else {
                failureReason = 'TypeConverter 함수가 제공되지 않음';
              }
            }
            
            transformationTraces.push({
              type: queryParam.type,
              target: queryParam.extractedValue,
              convertedValue: queryParam.convertedValue,
              encryptedValue: queryParam.encryptedValue,
              result: queryParam.finalValue,
              location: 'query',
              identifier: queryParam.key, // 쿼리 파라미터 키가 식별자
              flags: queryParam.flags,
              processingMode: queryParam.processingMode,
              transformationSuccess: isChanged || hasConversion || hasEncryption || queryParam.flags.literal,
              failureReason
            });
          }
          
          // 전역 쿼리의 내부 결과들 추적
          // 전역 쿼리란: ?e{name={A_TYPE_1}&value=test} 같은 형태
          // innerResults는 중괄호 안의 개별 쿼리들 (name={A_TYPE_1}, value=test)
          if ('innerResults' in queryParam && Array.isArray((queryParam as { innerResults: ParsedQuery[] }).innerResults)) {
            (queryParam as { innerResults: ParsedQuery[] }).innerResults.forEach((inner: ParsedQuery) => {
              if (inner.extractedValue) {
                // 내부 결과의 변환 성공 여부 판단 (동일한 로직)
                const hasConversion = inner.convertedValue !== null && inner.convertedValue !== inner.extractedValue;
                const hasEncryption = inner.encryptedValue !== null;
                const isChanged = inner.extractedValue !== inner.finalValue;
                
                // 내부 결과의 실패 이유 결정 (동일한 로직)
                let failureReason: string | undefined;
                if (!hasConversion && inner.type !== ParameterType.LITERAL && !inner.flags.literal) {
                  if (inner.type === ParameterType.UNKNOWN) {
                    failureReason = `알 수 없는 타입: "${inner.extractedValue}"가 A/B 타입 목록에 없음`;
                  } else {
                    failureReason = 'TypeConverter 함수가 제공되지 않음';
                  }
                }
                
                transformationTraces.push({
                  type: inner.type,
                  target: inner.extractedValue,
                  convertedValue: inner.convertedValue,
                  encryptedValue: inner.encryptedValue,
                  result: inner.finalValue,
                  location: 'query',
                  identifier: `${queryParam.key}.${inner.key}`, // 중첩 식별자 (예: __GLOBAL__.name)
                  flags: inner.flags,
                  processingMode: inner.processingMode,
                  transformationSuccess: isChanged || hasConversion || hasEncryption || inner.flags.literal,
                  failureReason
                });
              }
            });
            
            // 전역 쿼리 자체도 추적 (전체 암호화 과정)
            // 이것이 필요한 이유:
            // - 내부 쿼리들이 변환된 후, 전체 문자열이 다시 암호화됨
            // - 이 2단계 변환 과정도 추적해야 완전한 가시성 확보
            // - 전역 암호화 실패 시 원인 파악 가능
            if (queryParam.key === '__GLOBAL__' && queryParam.convertedValue) {
              transformationTraces.push({
                type: 'GLOBAL' as ParameterType, // 특별한 타입으로 표시
                target: queryParam.convertedValue, // 재구성된 쿼리 문자열이 대상
                convertedValue: queryParam.convertedValue,
                encryptedValue: queryParam.encryptedValue,
                result: queryParam.finalValue,
                location: 'query',
                identifier: '__GLOBAL__', // 전역 쿼리 식별자
                flags: queryParam.flags,
                processingMode: ProcessingMode.SUBSTITUTION, // 전역은 항상 치환 모드
                transformationSuccess: queryParam.encryptedValue !== null,
                failureReason: queryParam.encryptedValue === null && queryParam.flags.encrypted ? 'Encryptor 함수가 제공되지 않음' : undefined
              });
            }
          }
        });
      }
      
      // 6단계: 유효한 세그먼트 필터링 및 경로 재구성
      // 왜 필터링이 필요한가:
      // - 변환에 실패한 세그먼트는 URL에 포함되면 안됨
      // - 빈 값으로 변환된 세그먼트도 제외 (URL 구조 보존)
      // - 유효하지 않은 세그먼트가 포함되면 잘못된 URL이 생성됨
      const validSegments = parsedSegments.filter(segment => 
        isValidValue(segment.type, segment.extractedValue, segment.convertedValue, segment.flags, ProcessingMode.PARAMETER)
      );
      
      // 유효한 세그먼트들로 경로 재구성
      // 슬래시(/)로 연결하여 URL 경로 형태로 만듦
      const reconstructedPath = validSegments
        .map(segment => segment.finalValue)
        .join('/');
      
      // 7단계: 최종 상태 업데이트
      // 모든 처리가 완료된 후 한 번에 상태 업데이트 (렌더링 최적화)
      setParseResult({
        baseUrl,
        reconstructedPath: reconstructedPath ? `/${reconstructedPath}` : '', // 경로가 있으면 앞에 / 추가
        url: parsedSegments, // 원본 파싱 결과 (디버깅용)
        query: parsedQueries, // 원본 파싱 결과 (디버깅용)
        transformationTraces // 수집된 모든 추적 정보
      });
    },
    [typeConverter, encryptor]
  );

  /**
   * 파싱된 결과를 다시 완전한 URL 문자열로 재구성하는 함수
   * 
   * 이 함수가 필요한 이유:
   * - 파싱과 변환이 완료된 후 최종 URL이 어떻게 될지 확인
   * - 변환된 값들이 적용된 실제 사용 가능한 URL 생성
   * - 테스트와 검증에서 결과 URL 확인
   * 
   * 재구성 과정:
   * 1. 베이스 URL (프로토콜 + 호스트) 추가
   * 2. 변환된 경로 추가 
   * 3. 유효한 쿼리 파라미터들을 쿼리 문자열로 구성
   * 4. 전역 쿼리와 일반 쿼리를 구분하여 처리
   * 
   * 전역 쿼리 vs 일반 쿼리 처리 차이:
   * - 전역: ?암호화된_전체_문자열 (키 없음)
   * - 일반: ?key1=value1&key2=value2 (키=값 형태)
   * 
   * @returns 재구성된 완전한 URL 문자열
   */
  const getReconstructedUrl = useCallback(() => {
    const { baseUrl, reconstructedPath, query } = parseResult;
    
    // 쿼리 문자열 생성을 위한 부분들 수집
    const queryParts: string[] = [];
    
    // 각 쿼리 파라미터를 순회하면서 유효한 것들만 추가
    query.forEach(q => {
      // 전역 쿼리 처리 (type='GLOBAL'인 특별한 케이스)
      // 예: ?e{name=A_TYPE_1&value=test} → ?암호화된_문자열
      if ('type' in q && (q as { type: string }).type === 'GLOBAL') {
        if (q.finalValue) {
          // 전역 쿼리는 키 없이 값만 추가 (이미 완전한 쿼리 문자열이거나 암호화된 문자열)
          queryParts.push(q.finalValue);
        }
      } else {
        // 일반 쿼리 처리: key=value 형태
        // 유효성 검사를 통과한 것만 포함
        if (isValidValue(q.type, q.extractedValue, q.convertedValue, q.flags, q.processingMode)) {
          queryParts.push(`${q.key}=${q.finalValue}`);
        }
      }
    });
    
    // 쿼리 부분들을 &로 연결
    const queryString = queryParts.join('&');
    
    // URL 재구성: 베이스 + 경로 + 쿼리
    let fullUrl = baseUrl || '';
    if (reconstructedPath) {
      fullUrl += reconstructedPath;
    }
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
    
    return fullUrl;
  }, [parseResult]);

  // Hook의 공개 인터페이스 반환
  // 왜 이 세 가지만 노출하는가:
  // - parseResult: 현재 파싱 상태 (읽기 전용)
  // - updateParseResult: 새로운 URL로 상태 업데이트 (쓰기)
  // - getReconstructedUrl: 재구성된 URL 얻기 (계산)
  // 내부 상태나 헬퍼 함수는 숨겨서 캡슐화 유지
  return {
    parseResult,
    updateParseResult,
    getReconstructedUrl
  };
};