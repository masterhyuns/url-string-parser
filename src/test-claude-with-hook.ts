import { useParseState } from './hooks/useParseState';
import { ParameterType } from './types/parser.types';

// Mock 데이터 정의 (CLAUDE.md에서 제공된 데이터)
const mockTypeAData: Record<string, string> = {
  'A_TYPE_1': 'A_TYPE_1_VALUE',
  'A_TYPE_2': 'A_TYPE_2_VALUE',
  'A_TYPE_3': 'A_TYPE_3_VALUE',
  'A_TYPE_4': 'A_TYPE_4_VALUE'
};

const mockTypeBData: Record<string, string> = {
  'B_TYPE_1': 'B_TYPE_1_VALUE',
  'B_TYPE_2': 'B_TYPE_2_VALUE',
  'B_TYPE_3': 'B_TYPE_3_VALUE',
  'B_TYPE_4': 'B_TYPE_4_VALUE'
};

// Mock 타입 변환기
const mockTypeConverter = async (value: string, type: ParameterType): Promise<string> => {
  if (type === ParameterType.A) {
    if (mockTypeAData[value]) {
      return mockTypeAData[value];
    }
    throw new Error(`No conversion data for A type: ${value}`);
  }
  if (type === ParameterType.B) {
    if (mockTypeBData[value]) {
      return mockTypeBData[value];
    }
    throw new Error(`No conversion data for B type: ${value}`);
  }
  throw new Error(`Unknown type: ${type}`);
};

// Mock 암호화기
const mockEncryptor = async (value: string): Promise<string> => {
  return `${value}(암호화된값)`;
};

// React 외부에서 Hook 시뮬레이션
async function testWithHook() {
  console.log('=== useParseState Hook을 사용한 테스트 ===\n');
  
  // Hook 시뮬레이션
  let currentParseResult: any = {
    baseUrl: '',
    reconstructedPath: '',
    url: [],
    query: []
  };
  
  const mockSetState = (newState: any) => {
    currentParseResult = newState;
  };
  
  // useParseState 로직을 직접 구현
  const { parseUrlComponents } = await import('./utils/parser.utils');
  const { parseUrlSegments } = await import('./parsers/urlParser');
  const { parseQueryString } = await import('./parsers/queryParser');
  const { transformSegments, transformQueries } = await import('./services/transformService');
  const { isValidValue } = await import('./utils/parser.utils');
  
  const updateParseResult = async (urlString: string, applyTransform: boolean = false) => {
    const { protocol, host, path, query } = parseUrlComponents(urlString);
    
    const baseUrl = protocol && host ? `${protocol}://${host}` : '';
    
    let parsedSegments = parseUrlSegments(path);
    let parsedQueries = parseQueryString(query);
    
    if (applyTransform) {
      parsedSegments = await transformSegments(parsedSegments, mockTypeConverter, mockEncryptor);
      parsedQueries = await transformQueries(parsedQueries, mockTypeConverter, mockEncryptor);
    }
    
    // 유효한 세그먼트만 필터링
    const validSegments = parsedSegments.filter(segment => 
      isValidValue(segment.type, segment.extractedValue, segment.convertedValue, segment.flags)
    );
    
    const reconstructedPath = validSegments
      .map(segment => segment.finalValue)
      .join('/');
    
    mockSetState({
      baseUrl,
      reconstructedPath: reconstructedPath ? `/${reconstructedPath}` : '',
      url: parsedSegments,
      query: parsedQueries
    });
  };
  
  const getReconstructedUrl = () => {
    const { baseUrl, reconstructedPath, query } = currentParseResult;
    
    // 유효한 쿼리 파라미터만 필터링
    const validQueries = query.filter((q: any) => 
      isValidValue(q.type, q.extractedValue, q.convertedValue, q.flags)
    );
    
    const queryString = validQueries
      .map((q: any) => `${q.key}=${q.finalValue}`)
      .join('&');
    
    let fullUrl = baseUrl || '';
    if (reconstructedPath) {
      fullUrl += reconstructedPath;
    }
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
    
    return fullUrl;
  };
  
  // 테스트 실행
  const testUrl = 'http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}&name4={A_TYPE_5}';
  console.log('입력 URL:', testUrl);
  
  await updateParseResult(testUrl, true);
  
  console.log('\n--- 재구성된 URL ---');
  console.log(getReconstructedUrl());
  
  console.log('\n--- 파싱 결과 객체 ---');
  console.log(JSON.stringify(currentParseResult, null, 2));
  
  console.log('\n--- 예상 결과와 비교 ---');
  console.log('예상:', 'http://localhost/A_TYPE_1_VALUE(암호화된값)?name=A_TYPE_2_VALUE&name2=B_TYPE_2_VALUE(암호화된값)&name3=A_TYPE3');
  console.log('실제:', getReconstructedUrl());
}

// 테스트 실행
testWithHook().catch(console.error);