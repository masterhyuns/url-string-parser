import { parseUrlComponents } from './utils/parser.utils';
import { parseUrlSegments } from './parsers/urlParser';
import { parseQueryString } from './parsers/queryParser';
import { transformSegments, transformQueries } from './services/transformService';
import { ParameterType } from './types/parser.types';

// Mock 데이터 정의 (CLAUDE.md에서 제공된 데이터)
const mockTypeAData: Record<string, string> = {
  'A_TYPE_1': 'A_TYPE_1_VALUE',
  'A_TYPE_2': 'A_TYPE_2_VALUE',
  'A_TYPE_3': 'A_TYPE_3_VALUE',
  'A_TYPE_4': 'A_TYPE_4_VALUE',
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
    return mockTypeAData[value] || value;
  }
  if (type === ParameterType.B) {
    return mockTypeBData[value] || value;
  }
  return value;
};

// Mock 암호화기
const mockEncryptor = async (value: string): Promise<string> => {
  return `${value}(암호화된값)`;
};

async function testClaudeExample() {
  console.log('=== CLAUDE.md 테스트 실행 ===\n');
  
  // 테스트 URL (CLAUDE.md 예시)
  const testUrl = 'http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}&name4={A_TYPE_6}';
  
  console.log('입력 URL:', testUrl);
  console.log('\n--- 파싱 프로세스 ---\n');
  
  // 1. URL 컴포넌트 분리
  const { protocol, host, path, query } = parseUrlComponents(testUrl);
  console.log('프로토콜:', protocol);
  console.log('호스트:', host);
  console.log('경로:', path);
  console.log('쿼리:', query);
  
  // 2. URL 세그먼트 파싱
  console.log('\n--- URL 세그먼트 파싱 ---');
  const urlSegments = parseUrlSegments(path);
  urlSegments.forEach((segment, idx) => {
    console.log(`\n세그먼트 ${idx + 1}:`, segment.segment);
    console.log('  - 플래그:', segment.flags);
    console.log('  - 타입:', segment.type);
    console.log('  - 추출된 값:', segment.extractedValue);
  });
  
  // 3. 쿼리스트링 파싱
  console.log('\n--- 쿼리스트링 파싱 ---');
  const queryParams = parseQueryString(query);
  queryParams.forEach((param, idx) => {
    console.log(`\n쿼리 ${idx + 1}: ${param.key}=${param.value}`);
    console.log('  - 플래그:', param.flags);
    console.log('  - 타입:', param.type);
    console.log('  - 추출된 값:', param.extractedValue);
  });
  
  // 4. 변환 적용
  console.log('\n--- 타입 변환 및 암호화 적용 ---');
  const transformedSegments = await transformSegments(urlSegments, mockTypeConverter, mockEncryptor);
  const transformedQueries = await transformQueries(queryParams, mockTypeConverter, mockEncryptor);
  
  // 5. 최종 URL 재구성
  const baseUrl = `${protocol}://${host}`;
  const reconstructedPath = transformedSegments.map(s => s.finalValue).join('/');
  const reconstructedQuery = transformedQueries.map(q => `${q.key}=${q.finalValue}`).join('&');
  const finalUrl = `${baseUrl}/${reconstructedPath}?${reconstructedQuery}`;
  
  console.log('\n--- 최종 결과 ---');
  console.log('재구성된 URL:', finalUrl);
  
  // 6. 세부 결과 출력
  console.log('\n--- 상세 변환 결과 ---');
  console.log('\nURL 세그먼트:');
  transformedSegments.forEach((segment, idx) => {
    console.log(`  ${idx + 1}. ${segment.segment}`);
    console.log(`     - 변환된 값: ${segment.convertedValue}`);
    console.log(`     - 암호화된 값: ${segment.encryptedValue}`);
    console.log(`     - 최종 값: ${segment.finalValue}`);
  });
  
  console.log('\n쿼리 파라미터:');
  transformedQueries.forEach((param, idx) => {
    console.log(`  ${idx + 1}. ${param.key}=${param.value}`);
    console.log(`     - 변환된 값: ${param.convertedValue}`);
    console.log(`     - 암호화된 값: ${param.encryptedValue}`);
    console.log(`     - 최종 값: ${param.finalValue}`);
  });
  
  // 7. 예상 결과와 비교
  console.log('\n--- 예상 결과와 비교 ---');
  console.log('예상:', 'http://localhost/A_TYPE_1_VALUE(암호화된값)?name=A_TYPE_2_VALUE&name2=B_TYPE_2_VALUE(암호화된값)&name3=A_TYPE3');
  console.log('실제:', finalUrl);
  
  // 8. 파싱 결과 객체 출력
  console.log('\n--- 파싱 결과 객체 ---');
  const parseResult = {
    baseUrl: `${protocol}://${host}`,
    reconstructedPath: reconstructedPath ? `/${reconstructedPath}` : '',
    url: transformedSegments,
    query: transformedQueries
  };
  console.log(JSON.stringify(parseResult, null, 2));
}

// 테스트 실행
testClaudeExample().catch(console.error);