import { parseUrlComponents } from './utils/parser.utils';
import { parseUrlSegments } from './parsers/urlParser';
import { parseQueryString } from './parsers/queryParser';
import { transformSegments, transformQueries } from './services/transformService';
import { ParameterType } from './types/parser.types';
import { encrypt, decrypt } from './crypto/encryption';

// Mock 데이터 정의
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

// 실제 암호화기
const realEncryptor = async (value: string): Promise<string> => {
  return await encrypt(value);
};

async function testGlobalEncryption() {
  console.log('=== 전역 암호화 테스트 ===\n');
  
  // 전역 암호화 테스트 URL
  const testUrl = 'http://localhost/path?e{name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}&name4={A_TYPE_6}}';
  
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
  console.log('URL 세그먼트:', urlSegments);
  
  // 3. 쿼리스트링 파싱
  console.log('\n--- 쿼리스트링 파싱 ---');
  const queryParams = parseQueryString(query);
  console.log('쿼리 파라미터 수:', queryParams.length);
  
  queryParams.forEach((param, idx) => {
    console.log(`\n쿼리 ${idx + 1}: ${param.key}=${param.value}`);
    console.log('  - 타입:', (param as any).type);
    console.log('  - 플래그:', param.flags);
    console.log('  - 처리 모드:', param.processingMode);
    console.log('  - 추출된 값:', param.extractedValue);
    
    if ((param as any).innerResults) {
      console.log('  - 내부 결과:');
      (param as any).innerResults.forEach((inner: any, i: number) => {
        console.log(`    ${i + 1}. ${inner.key}=${inner.value} (타입: ${inner.type})`);
      });
    }
  });
  
  // 4. 변환 적용
  console.log('\n--- 타입 변환 및 암호화 적용 ---');
  const transformedSegments = await transformSegments(urlSegments, mockTypeConverter, realEncryptor);
  const transformedQueries = await transformQueries(queryParams, mockTypeConverter, realEncryptor);
  
  // 5. 최종 URL 재구성
  const baseUrl = `${protocol}://${host}`;
  const reconstructedPath = transformedSegments.map(s => s.finalValue).join('/');
  
  // 쿼리 문자열 생성 (전역 처리 고려)
  const queryParts: string[] = [];
  transformedQueries.forEach(q => {
    if ((q as any).type === 'GLOBAL') {
      if (q.finalValue) {
        // 전역 암호화된 쿼리는 ? 접두사 추가
        queryParts.push(`?${q.finalValue}`);
      }
    } else {
      if (q.finalValue) {
        queryParts.push(`${q.key}=${q.finalValue}`);
      }
    }
  });
  
  const queryString = queryParts.join('&');
  // 전역 쿼리인 경우 이미 ?가 포함되어 있음
  const finalUrl = `${baseUrl}${reconstructedPath ? `/${reconstructedPath}` : ''}${queryString.startsWith('?') ? queryString : `?${queryString}`}`;
  
  console.log('\n--- 최종 결과 ---');
  console.log('재구성된 URL:', finalUrl);
  
  // 6. 상세 변환 결과 출력
  console.log('\n--- 상세 변환 결과 ---');
  transformedQueries.forEach((param, idx) => {
    console.log(`\n쿼리 ${idx + 1}:`);
    console.log(`  - 키: ${param.key}`);
    console.log(`  - 타입: ${(param as any).type}`);
    console.log(`  - 변환된 값: ${param.convertedValue}`);
    console.log(`  - 암호화된 값: ${param.encryptedValue ? '암호화됨' : 'null'}`);
    console.log(`  - 최종 값: ${param.finalValue}`);
    
    if ((param as any).innerResults) {
      console.log('  - 내부 변환 결과:');
      (param as any).innerResults.forEach((inner: any, i: number) => {
        console.log(`    ${i + 1}. ${inner.key}: ${inner.originalValue} → ${inner.finalValue}`);
      });
    }
  });
  
  // 7. 복호화 테스트
  console.log('\n--- 복호화 테스트 ---');
  for (const param of transformedQueries) {
    if (param.encryptedValue && (param as any).type === 'GLOBAL') {
      try {
        const decrypted = await decrypt(param.encryptedValue);
        console.log(`전역 암호화 복호화: ${param.encryptedValue.substring(0, 50)}... → ${decrypted}`);
      } catch (error) {
        console.error('전역 복호화 실패:', error);
      }
    }
  }
  
  console.log('\n=== 테스트 완료 ===');
}

// Node.js 환경에서는 crypto.subtle이 없으므로 확인
if (typeof crypto !== 'undefined' && crypto.subtle) {
  testGlobalEncryption().catch(console.error);
} else {
  console.log('⚠️  이 테스트는 브라우저 환경에서만 실행 가능합니다.');
  console.log('웹 화면에서 테스트해주세요.');
}