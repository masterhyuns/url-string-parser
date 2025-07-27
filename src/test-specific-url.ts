import { parseUrlComponents } from './utils/parser.utils';
import { parseUrlSegments } from './parsers/urlParser';
import { parseQueryString } from './parsers/queryParser';
import { transformSegments, transformQueries } from './services/transformService';
import { ParameterType } from './types/parser.types';

// Mock 타입 변환기 - PROC과 NAME을 A 타입으로 처리
const mockTypeConverter = async (value: string, type: ParameterType): Promise<string> => {
  console.log(`🔄 Converting "${value}" of type ${type}`);
  
  const mockResponses: Record<string, string> = {
    'PROC': 'PROC_VALUE',
    'NAME': 'NAME_VALUE',
    'TEXT': 'TEXT',
    'A_TYPE_1': 'A_TYPE_1_VALUE',
    'A_TYPE_2': 'A_TYPE_2_VALUE',
    'A_TYPE_3': 'A_TYPE_3_VALUE',
    'A_TYPE_4': 'A_TYPE_4_VALUE',
    'B_TYPE_1': 'B_TYPE_1_VALUE',
    'B_TYPE_2': 'B_TYPE_2_VALUE',
    'B_TYPE_3': 'B_TYPE_3_VALUE',
    'B_TYPE_4': 'B_TYPE_4_VALUE',
    'LITERAL': 'LITERAL'
  };
  
  const result = mockResponses[value] || `${value}_CONVERTED`;
  console.log(`✅ Converted "${value}" → "${result}"`);
  return result;
};

// Mock 암호화기
const mockEncryptor = async (value: string): Promise<string> => {
  console.log(`🔐 Encrypting "${value}"`);
  const encrypted = `ENC[${value}]`;
  console.log(`✅ Encrypted "${value}" → "${encrypted}"`);
  return encrypted;
};

async function testSpecificUrl() {
  console.log('=== URL 파싱 및 변환 테스트 ===\n');
  
  const testUrl = 'http://localhost/v{TEXT}.com?name={A_TYPE_1}';
  
  console.log('🎯 입력 URL:', testUrl);
  console.log('\n예상 동작:');
  console.log('- URL 세그먼트: v{TEXT}.com → TEXT.com (v 플래그로 리터럴 처리)');
  console.log('- 쿼리: name={A_TYPE_1} → name=A_TYPE_1_VALUE (A 타입 변환)');
  console.log('- 최종 URL: http://localhost/TEXT.com?name=A_TYPE_1_VALUE');
  
  console.log('\n--- 1단계: URL 컴포넌트 분리 ---');
  const { protocol, host, path, query } = parseUrlComponents(testUrl);
  console.log('프로토콜:', protocol);
  console.log('호스트:', host); 
  console.log('경로:', path);
  console.log('쿼리:', query);
  
  console.log('\n--- 2단계: URL 세그먼트 파싱 ---');
  const urlSegments = parseUrlSegments(path);
  console.log('URL 세그먼트 개수:', urlSegments.length);
  urlSegments.forEach((segment, idx) => {
    console.log(`세그먼트 ${idx + 1}: "${segment.segment}"`);
    console.log('  - 원본 값:', segment.originalValue);
    console.log('  - 플래그:', segment.flags);
    console.log('  - 타입:', segment.type);
    console.log('  - 추출된 값:', segment.extractedValue);
  });
  
  console.log('\n--- 3단계: 쿼리스트링 파싱 ---');
  const queryParams = parseQueryString(query);
  console.log('쿼리 파라미터 개수:', queryParams.length);
  queryParams.forEach((param, idx) => {
    console.log(`\n쿼리 ${idx + 1}: ${param.key}=${param.value}`);
    console.log('  - 처리 모드:', param.processingMode);
    console.log('  - 플래그:', param.flags); 
    console.log('  - 타입:', param.type);
    console.log('  - 추출된 값:', param.extractedValue);
  });
  
  console.log('\n--- 4단계: 타입 변환 및 암호화 적용 ---');
  
  // 내부 추적을 위한 배열
  const innerTraces: any[] = [];
  const onInnerTrace = (trace: any, location: string, identifier: string) => {
    innerTraces.push({
      ...trace,
      location,
      identifier: `${identifier}.inner.${trace.target}`
    });
  };
  
  const transformedSegments = await transformSegments(urlSegments, mockTypeConverter, mockEncryptor, onInnerTrace);
  const transformedQueries = await transformQueries(queryParams, mockTypeConverter, mockEncryptor, onInnerTrace);
  
  console.log('\n--- 5단계: 최종 결과 분석 ---');
  console.log('\n📋 변환된 URL 세그먼트:');
  transformedSegments.forEach((segment, idx) => {
    console.log(`세그먼트 ${idx + 1}: "${segment.segment}"`);
    console.log('  - 변환된 값:', segment.convertedValue);  
    console.log('  - 암호화된 값:', segment.encryptedValue);
    console.log('  - 최종 값:', segment.finalValue);
  });
  
  console.log('\n📋 변환된 쿼리 파라미터:');
  transformedQueries.forEach((param, idx) => {
    console.log(`쿼리 ${idx + 1}: ${param.key}=${param.value}`);
    console.log('  - 처리 모드:', param.processingMode);
    console.log('  - 변환된 값:', param.convertedValue);
    console.log('  - 암호화된 값:', param.encryptedValue);
    console.log('  - 최종 값:', param.finalValue);
    
    if ((param as any).innerResults) {
      console.log('  - 내부 결과들:');
      (param as any).innerResults.forEach((inner: any, i: number) => {
        console.log(`    ${i+1}. ${inner.key} = ${inner.finalValue}`);
        console.log(`       플래그: ${JSON.stringify(inner.flags)}`);
        console.log(`       처리모드: ${inner.processingMode}`);
      });
    }
  });
  
  console.log('\n--- 6단계: 최종 URL 재구성 ---');
  
  // 전역 쿼리인 경우 특별 처리
  const queryParts: string[] = [];
  transformedQueries.forEach(q => {
    if ((q as any).type === 'GLOBAL') {
      // 전역 쿼리는 키 없이 최종값만 사용
      queryParts.push(q.finalValue);
    } else {
      // 일반 쿼리는 key=value 형식
      if (q.processingMode === 'SUBSTITUTION' || 
          (q.processingMode === 'PARAMETER' && q.extractedValue !== null && q.extractedValue.trim() !== '')) {
        queryParts.push(`${q.key}=${q.finalValue}`);
      }
    }
  });
  
  const baseUrl = protocol && host ? `${protocol}://${host}` : '';
  const validSegments = transformedSegments.filter(s => s.finalValue.trim() !== '');
  const reconstructedPath = validSegments.length > 0 ? `/${validSegments.map(s => s.finalValue).join('/')}` : '';
  const queryString = queryParts.join('&');
  const finalUrl = `${baseUrl}${reconstructedPath}${queryString ? `?${queryString}` : ''}`;
  
  console.log('\n🎯 최종 재구성된 URL:');
  console.log(finalUrl);
  
  console.log('\n--- 7단계: 단계별 변환 과정 상세 분석 ---');
  console.log('\n📝 where=e{PROC=!@r{NAME}} 파싱 과정:');
  const whereParam = transformedQueries.find(q => q.key === 'where');
  if (whereParam) {
    console.log('1. 원본 값:', whereParam.originalValue);
    console.log('2. 추출된 값:', whereParam.extractedValue);
    console.log('3. 중첩 구조 파싱 결과:', whereParam.convertedValue);
    console.log('4. 암호화 적용 (e 플래그):', whereParam.encryptedValue);
    console.log('5. 최종 값:', whereParam.finalValue);
  }
  
  console.log('\n📝 value=v{LITERAL} 파싱 과정:');
  const valueParam = transformedQueries.find(q => q.key === 'value');
  if (valueParam) {
    console.log('1. 원본 값:', valueParam.originalValue);
    console.log('2. v 플래그로 리터럴 처리:', valueParam.extractedValue);
    console.log('3. 변환 없음 (LITERAL 타입):', valueParam.convertedValue);
    console.log('4. 암호화 없음 (e 플래그 없음):', valueParam.encryptedValue);
    console.log('5. 최종 값:', valueParam.finalValue);
  }
  
  // 변환 추적 정보 수집 (개선된 버전)
  const transformationTraces: any[] = [];
  
  // URL 세그먼트 변환 추적 (모든 중괄호 패턴)
  transformedSegments.forEach((segment, index) => {
    if (segment.extractedValue) {
      const hasConversion = segment.convertedValue !== null && segment.convertedValue !== segment.extractedValue;
      const hasEncryption = segment.encryptedValue !== null;
      const isChanged = segment.extractedValue !== segment.finalValue;
      
      let failureReason: string | undefined;
      if (!hasConversion && segment.type !== ParameterType.LITERAL && !segment.flags.literal) {
        if (segment.type === ParameterType.UNKNOWN) {
          failureReason = `알 수 없는 타입: "${segment.extractedValue}"가 A/B 타입 목록에 없음`;
        } else {
          failureReason = 'TypeConverter 함수가 제공되지 않음';
        }
      }
      
      transformationTraces.push({
        type: segment.type,
        target: segment.extractedValue,
        convertedValue: segment.convertedValue,
        encryptedValue: segment.encryptedValue,
        result: segment.finalValue,
        location: 'url',
        identifier: `segment-${index}`,
        flags: segment.flags,
        processingMode: segment.processingMode || 'PARAMETER',
        transformationSuccess: isChanged || hasConversion || hasEncryption || segment.flags.literal,
        failureReason
      });
    }
  });
  
  // 쿼리 변환 추적 (모든 중괄호 패턴)
  transformedQueries.forEach((queryParam) => {
    if (queryParam.extractedValue && (queryParam as any).type !== 'GLOBAL') {
      const hasConversion = queryParam.convertedValue !== null && queryParam.convertedValue !== queryParam.extractedValue;
      const hasEncryption = queryParam.encryptedValue !== null;
      const isChanged = queryParam.extractedValue !== queryParam.finalValue;
      
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
        identifier: queryParam.key,
        flags: queryParam.flags,
        processingMode: queryParam.processingMode,
        transformationSuccess: isChanged || hasConversion || hasEncryption || queryParam.flags.literal,
        failureReason
      });
    }
    
    // 전역 쿼리의 내부 결과들도 추적
    if ((queryParam as any).innerResults) {
      (queryParam as any).innerResults.forEach((inner: any) => {
        if (inner.extractedValue) {
          const hasConversion = inner.convertedValue !== null && inner.convertedValue !== inner.extractedValue;
          const hasEncryption = inner.encryptedValue !== null;
          const isChanged = inner.extractedValue !== inner.finalValue;
          
          let failureReason: string | undefined;
          if (!hasConversion && inner.type !== 'LITERAL' && inner.type !== 'SUBSTITUTION' && !inner.flags.literal) {
            if (inner.type === 'UNKNOWN') {
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
            identifier: `${queryParam.key}.${inner.key}`,
            flags: inner.flags,
            processingMode: inner.processingMode,
            transformationSuccess: isChanged || hasConversion || hasEncryption || inner.flags.literal,
            failureReason
          });
        }
      });
    }
  });
  
  console.log('\n--- 8단계: 내부 치환 추적 정보 ---');
  console.log('🔍 SUBSTITUTION 모드 내부 변환들:');
  if (innerTraces.length > 0) {
    innerTraces.forEach((trace, idx) => {
      console.log(`\n🔄 내부 치환 ${idx + 1}:`);
      console.log(`  📍 위치: ${trace.location} (${trace.identifier})`);
      console.log(`  🏷️  타입: ${trace.type}`);
      console.log(`  🎯 원본: "${trace.target}"`);
      console.log(`  🔄 변환값: ${trace.convertedValue || '없음'}`);
      console.log(`  🔐 암호화: ${trace.encryptedValue || '없음'}`);
      console.log(`  ✨ 결과: "${trace.result}"`);
      console.log(`  🏴 플래그: ${JSON.stringify(trace.flags)}`);
      console.log(`  ${trace.transformationSuccess ? '✅ 성공' : '❌ 실패'}`);
      if (trace.failureReason) {
        console.log(`  ⚠️  실패 이유: ${trace.failureReason}`);
      }
    });
  } else {
    console.log('  내부 치환이 없습니다.');
  }

  console.log('\n--- 9단계: 전체 변환 추적 정보 ---');
  console.log('🔍 모든 변환 과정의 상세 추적:');
  const allTraces = [...transformationTraces, ...innerTraces];
  if (allTraces.length > 0) {
    allTraces.forEach((trace, idx) => {
      console.log(`\n🔍 추적 ${idx + 1}:`);
      console.log(`  📍 위치: ${trace.location} (${trace.identifier})`);
      console.log(`  🏷️  타입: ${trace.type}`);
      console.log(`  🎯 원본: "${trace.target}"`);
      console.log(`  🔄 변환값: ${trace.convertedValue || '없음'}`);
      console.log(`  🔐 암호화: ${trace.encryptedValue || '없음'}`);
      console.log(`  ✨ 최종: "${trace.result}"`);
      console.log(`  🏴 플래그: ${JSON.stringify(trace.flags)}`);
      console.log(`  ⚙️  모드: ${trace.processingMode || 'SUBSTITUTION'}`);
      console.log(`  ${trace.transformationSuccess ? '✅ 성공' : '❌ 실패'}`);
      if (trace.failureReason) {
        console.log(`  ⚠️  실패 이유: ${trace.failureReason}`);
      }
    });
  } else {
    console.log('  변환 대상이 없습니다.');
  }

  return {
    parseResult: {
      baseUrl,
      reconstructedPath,
      url: transformedSegments,
      query: transformedQueries,
      transformationTraces: [...transformationTraces, ...innerTraces]
    },
    finalUrl
  };
}

// 테스트 실행
testSpecificUrl().then(result => {
  console.log('\n=== 테스트 완료 ===');
  console.log('최종 URL:', result.finalUrl);
}).catch(console.error);