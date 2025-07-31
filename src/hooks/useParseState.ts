import { useState, useCallback } from 'react';
import {
  ParseResult,
  TypeConverter,
  Encryptor,
  ProcessingMode,
  TransformationTrace,
  ParameterType,
  ParsedQuery,
  ParsedSegment,
  FilteringMode,
  ParameterFlags
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
  encryptor?: Encryptor,
  filteringMode: FilteringMode = FilteringMode.DEFAULT
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
   * 변환 추적 정보를 생성하는 헬퍼 함수
   * 
   * @param item 추적할 파싱된 아이템
   * @param location 위치 ('url' 또는 'query')
   * @param identifier 식별자
   * @returns 변환 추적 정보
   */
  const createTransformationTrace = (
    item: {
      extractedValue: string | null;
      convertedValue: string | null;
      encryptedValue: string | null;
      finalValue: string;
      type: ParameterType;
      flags: ParameterFlags;
      processingMode?: ProcessingMode;
    },
    location: 'url' | 'query',
    identifier: string
  ): TransformationTrace => {
    const hasConversion = item.convertedValue !== null && item.convertedValue !== item.extractedValue;
    const hasEncryption = item.encryptedValue !== null;
    const isChanged = item.extractedValue !== item.finalValue;
    
    let failureReason: string | undefined;
    if (!hasConversion && item.type !== ParameterType.LITERAL && !item.flags.literal) {
      if (item.type === ParameterType.UNKNOWN) {
        failureReason = `알 수 없는 타입: "${item.extractedValue}"가 A/B 타입 목록에 없음`;
      } else {
        failureReason = 'TypeConverter 함수가 제공되지 않음';
      }
    }
    
    return {
      type: item.type,
      target: item.extractedValue || '',
      convertedValue: item.convertedValue,
      encryptedValue: item.encryptedValue,
      result: item.finalValue,
      location,
      identifier,
      flags: item.flags,
      processingMode: item.processingMode || ProcessingMode.PARAMETER,
      transformationSuccess: isChanged || hasConversion || hasEncryption || item.flags.literal,
      failureReason
    };
  };

  /**
   * URL과 쿼리를 파싱하고 변환하는 함수
   * 
   * @param urlString 파싱할 URL 문자열
   * @param activeFilteringMode 필터링 모드
   * @param typeConverter 타입 변환 함수
   * @param encryptor 암호화 함수
   * @param substitutionFailures SUBSTITUTION 변환 실패 추적 Map
   * @returns 파싱 및 변환 결과
   */
  const parseAndTransformUrl = async (
    urlString: string,
    typeConverter?: TypeConverter,
    encryptor?: Encryptor,
    substitutionFailures?: Map<string, boolean>
  ) => {
    const { protocol, host, path, query } = parseUrlComponents(urlString);
    const baseUrl = protocol && host ? `${protocol}://${host}` : '';
    
    let parsedSegments = parseUrlSegments(path);
    let parsedQueries = parseQueryString(query);
    
    const transformationTraces: TransformationTrace[] = [];
    
    // 내부 추적 콜백 정의
    const onInnerTrace = (
      trace: Omit<TransformationTrace, 'location' | 'identifier'>,
      location: 'url' | 'query',
      identifier: string
    ) => {
      transformationTraces.push({
        ...trace,
        location,
        identifier: `${identifier}.inner.${trace.target}`,
        processingMode: ProcessingMode.SUBSTITUTION
      });
      
      // SUBSTITUTION 변환 실패 추적
      if (!trace.transformationSuccess && substitutionFailures) {
        substitutionFailures.set(identifier, true);
      }
    };
    
    // 병렬 변환 실행 (항상 DEFAULT 모드로 처리)
    parsedSegments = await transformSegments(parsedSegments, typeConverter, encryptor, onInnerTrace);
    parsedQueries = await transformQueries(parsedQueries, typeConverter, encryptor, onInnerTrace);
    
    return {
      baseUrl,
      parsedSegments,
      parsedQueries,
      transformationTraces
    };
  };

  /**
   * 변환 추적 정보를 수집하는 함수
   * 
   * @param parsedSegments 파싱된 URL 세그먼트 배열
   * @param parsedQueries 파싱된 쿼리 배열
   * @param existingTraces 기존 추적 정보 배열
   * @returns 완성된 추적 정보 배열
   */
  const collectTransformationTraces = (
    parsedSegments: ParsedSegment[],
    parsedQueries: ParsedQuery[],
    existingTraces: TransformationTrace[]
  ): TransformationTrace[] => {
    const traces = [...existingTraces];
    
    // URL 세그먼트 추적 수집
    parsedSegments.forEach((segment, index) => {
      if (segment.extractedValue) {
        traces.push(createTransformationTrace(segment, 'url', `segment-${index}`));
      }
    });
    
    // 쿼리 변환 추적 수집
    parsedQueries.forEach((queryParam) => {
      // 일반 쿼리 파라미터 추적
      if (queryParam.extractedValue && !('type' in queryParam && (queryParam as { type: string }).type === 'GLOBAL')) {
        traces.push(createTransformationTrace(queryParam, 'query', queryParam.key));
      }
      
      // 전역 쿼리의 내부 결과들 추적
      if ('innerResults' in queryParam && Array.isArray((queryParam as { innerResults: ParsedQuery[] }).innerResults)) {
        (queryParam as { innerResults: ParsedQuery[] }).innerResults.forEach((inner: ParsedQuery) => {
          if (inner.extractedValue) {
            traces.push(createTransformationTrace(inner, 'query', `${queryParam.key}.${inner.key}`));
          }
        });
        
        // 전역 쿼리 자체도 추적
        if (queryParam.key === '__GLOBAL__' && queryParam.convertedValue) {
          traces.push({
            type: 'GLOBAL' as ParameterType,
            target: queryParam.convertedValue,
            convertedValue: queryParam.convertedValue,
            encryptedValue: queryParam.encryptedValue,
            result: queryParam.finalValue,
            location: 'query',
            identifier: '__GLOBAL__',
            flags: queryParam.flags,
            processingMode: ProcessingMode.SUBSTITUTION,
            transformationSuccess: queryParam.encryptedValue !== null,
            failureReason: queryParam.encryptedValue === null && queryParam.flags.encrypted ? 'Encryptor 함수가 제공되지 않음' : undefined
          });
        }
      }
    });
    
    return traces;
  };

  /**
   * URL 문자열을 파싱하여 상태를 업데이트하는 핵심 함수
   * 
   * 이 함수의 처리 과정:
   * 1. URL 분해: protocol, host, path, query로 구성요소 분리
   * 2. 개별 파싱: URL 세그먼트와 쿼리 파라미터를 각각 파싱
   * 3. 변환 적용: applyTransform=true인 경우 타입 변환과 암호화 수행
   * 4. 필터링 적용: filteringMode에 따라 포함할 세그먼트/쿼리 필터링
   * 5. 추적 수집: 변환 과정의 모든 정보를 TransformationTrace로 기록
   * 6. 상태 업데이트: 최종 결과를 React 상태로 저장
   * 
   * applyTransform 매개변수의 의미:
   * - false: 파싱만 수행 (구조 분석, 플래그 감지)
   * - true: 파싱 + 실제 변환 (API 호출, 암호화 적용)
   * 
   * filteringMode 매개변수의 의미:
   * - DEFAULT: 변환 가능한 모든 값 포함 (기존 동작)
   * - STRICT: 일반 문자열과 v(리터럴)만 포함, 변환 필요한 값은 제외
   * 
   * 왜 두 단계로 나눴는가:
   * - 파싱 단계에서 먼저 구조를 검증하고 오류를 발견
   * - 변환 단계는 비용이 크므로(API 호출) 필요할 때만 실행
   * - 개발 중에는 파싱만으로도 구조 확인 가능
   * 
   * @param urlString 파싱할 URL 문자열
   * @param applyTransform 실제 변환(타입 변환, 암호화)을 적용할지 여부
   * @param filteringMode 필터링 모드 (기본값: DEFAULT)
   */
  const updateParseResult = useCallback(
    async (urlString: string, applyTransform: boolean = false) => {
      // Hook 생성 시 전달받은 filteringMode를 기본값으로 사용, 필요시 override 가능
      // 파싱 단계에서는 filteringMode를 사용하지 않으므로 주석 처리
      // const activeFilteringMode = overrideFilteringMode ?? filteringMode;
      
      // SUBSTITUTION 변환 실패 추적을 위한 Map (applyTransform과 관계없이 항상 사용 가능)
      const substitutionFailures = new Map<string, boolean>();
      
      if (applyTransform) {
        // 변환을 적용하는 경우: 파싱 → 변환 → 추적 수집 → 필터링 → 상태 업데이트
        const { baseUrl, parsedSegments, parsedQueries, transformationTraces } = 
          await parseAndTransformUrl(urlString, typeConverter, encryptor, substitutionFailures);
        
        // 변환 추적 정보 수집
        const allTraces = collectTransformationTraces(parsedSegments, parsedQueries, transformationTraces);
        
        // 파싱 단계에서는 필터링하지 않고 모든 결과 저장
        const reconstructedPath = parsedSegments
          .map(segment => segment.finalValue)
          .join('/');
        
        // 최종 상태 업데이트 (필터링은 getReconstructedUrl에서 처리)
        setParseResult({
          baseUrl,
          reconstructedPath: reconstructedPath ? `/${reconstructedPath}` : '',
          url: parsedSegments,
          query: parsedQueries,
          transformationTraces: allTraces
        });
      } else {
        // 변환을 적용하지 않는 경우: 파싱만 수행
        const { protocol, host, path, query } = parseUrlComponents(urlString);
        const baseUrl = protocol && host ? `${protocol}://${host}` : '';
        
        const parsedSegments = parseUrlSegments(path);
        const parsedQueries = parseQueryString(query);
        
        setParseResult({
          baseUrl,
          reconstructedPath: '',
          url: parsedSegments,
          query: parsedQueries,
          transformationTraces: []
        });
      }
    },
    [typeConverter, encryptor, collectTransformationTraces]
  );
  /**
   * STRICT 모드에서 전역 쿼리의 내부 결과를 필터링하는 함수
   */
  const filterGlobalQueryForStrict = useCallback((globalQuery: { innerResults: ParsedQuery[]; flags: ParameterFlags }) => {
    return globalQuery.innerResults.filter(inner => {
      // 리터럴 플래그가 있으면 허용
      if (inner.flags.literal) return true;
      
      // 일반 문자열(중괄호 없음) 허용
      if (!inner.originalValue.includes('{') || !inner.originalValue.includes('}')) return true;
      
      // SUBSTITUTION 모드인 경우 transformationTraces를 확인
      if (inner.processingMode === ProcessingMode.SUBSTITUTION) {
        // 이 쿼리와 관련된 내부 변환 추적 정보 찾기
        const relatedTraces = parseResult.transformationTraces.filter(trace => 
          trace.identifier.startsWith(`__GLOBAL__.${inner.key}.inner.`)
        );
        
        // 내부 변환 중 하나라도 변환이 필요한(리터럴이 아닌) 값이 있으면 제외
        const hasNonLiteralTransformation = relatedTraces.some(trace =>
          !trace.flags.literal && trace.type !== ParameterType.UNKNOWN
        );
        
        // 변환 실패가 있으면 제외
        const hasFailedTransformation = relatedTraces.some(trace =>
          !trace.transformationSuccess
        );
        
        // 모든 조건을 통과한 경우만 포함
        return !hasNonLiteralTransformation && !hasFailedTransformation;
      }
      
      // 나머지는 제외 (변환 필요한 값들)
      return false;
    });
  }, [parseResult.transformationTraces]);

  /**
   * STRICT 모드에서 일반 쿼리 필터링 여부를 결정하는 함수
   */
  const shouldIncludeQueryInStrict = useCallback((q: ParsedQuery) => {
    // 리터럴과 일반 문자열만 허용
    if (q.flags.literal || (!q.originalValue.includes('{') || !q.originalValue.includes('}'))) {
      return true;
    }
    
    // SUBSTITUTION 모드인 경우 STRICT 모드 검증
    if (q.processingMode === ProcessingMode.SUBSTITUTION) {
      // transformationTraces에서 이 쿼리와 관련된 내부 변환 찾기
      const relatedTraces = parseResult.transformationTraces.filter(trace => 
        trace.identifier.startsWith(`${q.key}.inner.`)
      );
      
      // 내부 변환 중 하나라도 변환이 필요한(리터럴이 아닌) 값이 있으면 제외
      const hasNonLiteralTransformation = relatedTraces.some(trace =>
        !trace.flags.literal && trace.type !== ParameterType.UNKNOWN
      );
      
      // 또는 변환 실패가 있으면 제외
      const hasFailedTransformation = relatedTraces.some(trace =>
        !trace.transformationSuccess
      );
      
      // 결과에 변환되지 않은 중괄호가 남아있으면 제외
      const hasUnprocessedBrackets = q.finalValue.includes('{') && q.finalValue.includes('}');
      
      // STRICT 모드에서 허용되지 않는 패턴들
      const hasInvalidPatterns = 
        q.finalValue.includes('@@@@') || // 연속된 빈 치환
        q.finalValue.match(/@@$/) || // 끝에 @@
        q.finalValue.trim() === ''; // 빈 결과
      
      // 모든 조건을 통과한 경우만 포함
      return !hasNonLiteralTransformation && !hasFailedTransformation && 
             !hasUnprocessedBrackets && !hasInvalidPatterns;
    }
    
    return false;
  }, [parseResult.transformationTraces]);

  /**
   * 전역 쿼리를 처리하는 함수
   */
  const processGlobalQuery = useCallback((q: ParsedQuery, activeFilteringMode: FilteringMode) => {
    if (!('innerResults' in q) || !Array.isArray((q as { innerResults: ParsedQuery[] }).innerResults)) {
      return null;
    }

    const globalQuery = q as { innerResults: ParsedQuery[]; flags: ParameterFlags };

    if (activeFilteringMode === FilteringMode.STRICT) {
      // STRICT 모드: 내부 쿼리들을 필터링하여 재구성
      const validInnerResults = filterGlobalQueryForStrict(globalQuery);
      
      if (validInnerResults.length > 0) {
        const reconstructedContent = validInnerResults
          .map(inner => `${inner.key}=${inner.finalValue}`)
          .join('&');
        
        // 전역 암호화는 별도 함수에서 처리하도록 표시
        return globalQuery.flags.encrypted 
          ? `[ENCRYPT:${reconstructedContent}]`
          : reconstructedContent;
      }
    } else {
      // DEFAULT 모드: 모든 내부 쿼리 포함
      const reconstructedContent = globalQuery.innerResults
        .filter(inner => inner.finalValue) // 빈 값만 제외
        .map(inner => `${inner.key}=${inner.finalValue}`)
        .join('&');
      
      if (reconstructedContent) {
        // 전역 암호화가 필요한 경우 플래그 생성
        return globalQuery.flags.encrypted 
          ? `[ENCRYPT:${reconstructedContent}]`
          : reconstructedContent;
      }
    }

    return null;
  }, [filterGlobalQueryForStrict]);

  /**
   * 일반 쿼리를 처리하는 함수
   */
  const processRegularQuery = useCallback((q: ParsedQuery, activeFilteringMode: FilteringMode) => {
    if (activeFilteringMode === FilteringMode.STRICT) {
      return shouldIncludeQueryInStrict(q) ? `${q.key}=${q.finalValue}` : null;
    } else {
      // DEFAULT 모드: 모든 유효한 쿼리 포함
      return isValidValue(q.type, q.extractedValue, q.convertedValue, q.flags, q.processingMode)
        ? `${q.key}=${q.finalValue}`
        : null;
    }
  }, [shouldIncludeQueryInStrict]);

  /**
   * 파싱된 결과를 다시 완전한 URL 문자열로 재구성하는 함수
   * 
   * 아키텍처 변경 후 역할:
   * - 필터링 모드에 따른 최종 필터링 처리
   * - 전역 쿼리의 실시간 암호화 처리  
   * - STRICT 모드에서 변환 실패 케이스 제외
   * 
   * @param overrideFilteringMode 필터링 모드 오버라이드 (선택적)
   * @returns 재구성된 완전한 URL 문자열
   */
  const getReconstructedUrl = useCallback((overrideFilteringMode?: FilteringMode) => {
    const { baseUrl, reconstructedPath, query } = parseResult;
    const activeFilteringMode = overrideFilteringMode ?? filteringMode;
    
    // 쿼리 문자열 생성을 위한 부분들 수집
    const queryParts: string[] = [];
    
    // 각 쿼리 파라미터를 필터링 모드에 따라 처리
    query.forEach(q => {
      let queryPart: string | null = null;

      // 전역 쿼리 vs 일반 쿼리 구분 처리
      if ('type' in q && (q as { type: string }).type === 'GLOBAL') {
        queryPart = processGlobalQuery(q, activeFilteringMode);
      } else {
        queryPart = processRegularQuery(q, activeFilteringMode);
      }

      if (queryPart) {
        queryParts.push(queryPart);
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
  }, [parseResult, filteringMode, processGlobalQuery, processRegularQuery]);

  /**
   * 전역 쿼리 암호화를 처리하는 함수
   * getReconstructedUrl에서 [ENCRYPT:...] 패턴을 실제 암호화된 값으로 변환
   */
  const encryptGlobalQueries = useCallback(async (url: string): Promise<string> => {
    if (!encryptor) return url;
    
    const encryptPattern = /\[ENCRYPT:([^\]]+)\]/g;
    let result = url;
    const matches = [...url.matchAll(encryptPattern)];
    
    for (const match of matches) {
      const [fullMatch, content] = match;
      try {
        const encrypted = await encryptor(content);
        result = result.replace(fullMatch, encrypted);
      } catch (error) {
        console.error('Global encryption failed:', error);
        result = result.replace(fullMatch, content); // 실패시 원본 사용
      }
    }
    
    return result;
  }, [encryptor]);

  // Hook의 공개 인터페이스 반환
  // 왜 이 세 가지만 노출하는가:
  // - parseResult: 현재 파싱 상태 (읽기 전용)
  // - updateParseResult: 새로운 URL로 상태 업데이트 (쓰기)
  // - getReconstructedUrl: 재구성된 URL 얻기 (계산)
  // 내부 상태나 헬퍼 함수는 숨겨서 캡슐화 유지
  return {
    parseResult,
    updateParseResult,
    getReconstructedUrl,
    encryptGlobalQueries
  };
};