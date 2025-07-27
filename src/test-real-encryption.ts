import { parseUrlComponents } from './utils/parser.utils';
import { parseUrlSegments } from './parsers/urlParser';
import { parseQueryString } from './parsers/queryParser';
import { transformSegments, transformQueries } from './services/transformService';
import { ParameterType } from './types/parser.types';
import { encrypt, decrypt, testEncryption } from './crypto/encryption';

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

async function testRealEncryption() {
  console.log('=== 실제 암호화 테스트 ===\n');
  
  // 1. 암호화 기본 테스트
  console.log('1. 기본 암호화/복호화 테스트');
  try {
    const testText = 'A_TYPE_1_VALUE';
    const { encrypted, decrypted } = await testEncryption(testText);
    console.log(`원본: ${testText}`);
    console.log(`암호화: ${encrypted}`);
    console.log(`복호화: ${decrypted}`);
    console.log(`일치: ${testText === decrypted ? '✅' : '❌'}\n`);
  } catch (error) {
    console.error('암호화 테스트 실패:', error);
  }
  
  // 2. URL 파싱 + 실제 암호화 테스트
  console.log('2. URL 파싱 + 실제 암호화 테스트');
  const testUrl = 'http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}';
  
  console.log('입력 URL:', testUrl);
  
  const { protocol, host, path, query } = parseUrlComponents(testUrl);
  
  // URL 세그먼트 파싱 및 변환
  let urlSegments = parseUrlSegments(path);
  let queryParams = parseQueryString(query);
  
  urlSegments = await transformSegments(urlSegments, mockTypeConverter, realEncryptor);
  queryParams = await transformQueries(queryParams, mockTypeConverter, realEncryptor);
  
  // 최종 URL 재구성
  const baseUrl = `${protocol}://${host}`;
  const reconstructedPath = urlSegments.map(s => s.finalValue).join('/');
  const reconstructedQuery = queryParams
    .filter(q => q.finalValue) // 빈 값 제외
    .map(q => `${q.key}=${q.finalValue}`)
    .join('&');
  const finalUrl = `${baseUrl}${reconstructedPath ? `/${reconstructedPath}` : ''}?${reconstructedQuery}`;
  
  console.log('최종 URL:', finalUrl);
  
  // 3. 암호화된 값들 복호화 테스트
  console.log('\n3. 암호화된 값들 복호화 테스트');
  
  for (const segment of urlSegments) {
    if (segment.encryptedValue) {
      try {
        const decrypted = await decrypt(segment.encryptedValue);
        console.log(`세그먼트 "${segment.segment}": ${segment.encryptedValue} → ${decrypted}`);
      } catch (error) {
        console.error(`세그먼트 복호화 실패:`, error);
      }
    }
  }
  
  for (const param of queryParams) {
    if (param.encryptedValue) {
      try {
        const decrypted = await decrypt(param.encryptedValue);
        console.log(`쿼리 "${param.key}": ${param.encryptedValue} → ${decrypted}`);
      } catch (error) {
        console.error(`쿼리 복호화 실패:`, error);
      }
    }
  }
  
  console.log('\n=== 테스트 완료 ===');
}

// Node.js 환경에서는 crypto.subtle이 없으므로 확인
if (typeof crypto !== 'undefined' && crypto.subtle) {
  testRealEncryption().catch(console.error);
} else {
  console.log('⚠️  이 테스트는 브라우저 환경에서만 실행 가능합니다.');
  console.log('웹 화면에서 테스트해주세요.');
}