const { parseUrlComponents } = require('./src/utils/parser.utils');
const { parseQueryString } = require('./src/parsers/queryParser');
const { transformQueries } = require('./src/services/transformService');

// Mock 타입 변환기
const mockTypeConverter = async (value, type) => {
  console.log(`🔄 Converting "${value}" of type ${type}`);
  
  const mockResponses = {
    'B_TYPE_1': 'B_TYPE_1_VALUE',
    'B_TYPE_2': 'B_TYPE_2_VALUE',
    'LITERAL': 'LITERAL'
  };
  
  const result = mockResponses[value] || `${value}_CONVERTED`;
  console.log(`✅ Converted "${value}" → "${result}"`);
  return result;
};

// Mock 암호화기
const mockEncryptor = async (value) => {
  console.log(`🔐 Encrypting "${value}"`);
  const encrypted = `ENC[${value}]`;
  console.log(`✅ Encrypted "${value}" → "${encrypted}"`);
  return encrypted;
};

async function testGlobalInnerTrace() {
  console.log('=== 전역 쿼리 내부 SUBSTITUTION 추적 테스트 ===\n');
  
  const testUrl = 'http://localhost?e{where=PROC=!@r{B_TYPE_1}AND!@PROC=!@r{B_TYPE_2}&value=ve{LITERAL}}';
  
  console.log('🎯 테스트 URL:', testUrl);
  console.log('\n예상 동작:');
  console.log('- 전역 e{} 플래그로 전체 암호화');
  console.log('- 내부 where=PROC=!@r{B_TYPE_1}AND!@PROC=!@r{B_TYPE_2} 에서:');
  console.log('  * r{B_TYPE_1} → B_TYPE_1_VALUE 변환');
  console.log('  * r{B_TYPE_2} → B_TYPE_2_VALUE 변환');
  console.log('- 내부 value=ve{LITERAL} 에서:');
  console.log('  * v{LITERAL} → LITERAL (리터럴)');
  console.log('- 각각의 내부 변환이 추적되어야 함');
  
  console.log('\n--- 1단계: URL 파싱 ---');
  const { query } = parseUrlComponents(testUrl);
  console.log('Query:', query);
  
  console.log('\n--- 2단계: 쿼리 파싱 ---');
  const parsedQueries = parseQueryString(query);
  console.log('Parsed queries count:', parsedQueries.length);
  parsedQueries.forEach((q, i) => {
    console.log(`Query ${i}: key="${q.key}", type="${q.type}", processing="${q.processingMode}"`);
    if (q.innerResults) {
      console.log(`  Inner results: ${q.innerResults.length} items`);
      q.innerResults.forEach((inner, j) => {
        console.log(`    ${j}: ${inner.key}="${inner.value}" (mode: ${inner.processingMode})`);
      });
    }
  });
  
  console.log('\n--- 3단계: 변환 및 추적 ---');
  const innerTraces = [];
  const onInnerTrace = (trace, location, identifier) => {
    console.log('\n🔍 Inner trace captured:');
    console.log(`  📍 Location: ${location}`);
    console.log(`  🏷️ Identifier: ${identifier}`);
    console.log(`  🎯 Type: ${trace.type}`);
    console.log(`  📝 Target: "${trace.target}"`);
    console.log(`  🔄 Converted: ${trace.convertedValue || 'none'}`);
    console.log(`  🔐 Encrypted: ${trace.encryptedValue || 'none'}`);
    console.log(`  ✨ Result: "${trace.result}"`);
    console.log(`  ${trace.transformationSuccess ? '✅ Success' : '❌ Failed'}`);
    
    innerTraces.push({
      ...trace,
      location,
      identifier
    });
  };
  
  const transformedQueries = await transformQueries(parsedQueries, mockTypeConverter, mockEncryptor, onInnerTrace);
  
  console.log('\n--- 4단계: 최종 결과 ---');
  console.log('변환된 쿼리 수:', transformedQueries.length);
  transformedQueries.forEach((q, i) => {
    console.log(`\nQuery ${i}:`);
    console.log(`  Key: ${q.key}`);
    console.log(`  Type: ${q.type || 'N/A'}`);
    console.log(`  Converted: ${q.convertedValue || 'none'}`);
    console.log(`  Encrypted: ${q.encryptedValue || 'none'}`);
    console.log(`  Final: ${q.finalValue}`);
  });
  
  console.log('\n--- 5단계: 내부 추적 결과 ---');
  console.log(`🔍 총 내부 추적 개수: ${innerTraces.length}`);
  
  if (innerTraces.length === 0) {
    console.log('❌ 내부 추적이 수집되지 않았습니다!');
    console.log('전역 쿼리 내부의 SUBSTITUTION 모드 변환이 추적되지 않고 있음');
  } else {
    console.log('✅ 내부 추적이 정상적으로 수집됨:');
    innerTraces.forEach((trace, i) => {
      console.log(`\n🔍 추적 ${i + 1}:`);
      console.log(`  📍 ${trace.location} (${trace.identifier})`);
      console.log(`  🎯 "${trace.target}" → "${trace.result}"`);
      console.log(`  🏷️ Type: ${trace.type}`);
      console.log(`  ${trace.transformationSuccess ? '✅ 성공' : '❌ 실패'}`);
    });
  }
  
  return {
    transformedQueries,
    innerTraces
  };
}

// 테스트 실행
testGlobalInnerTrace().then(result => {
  console.log('\n=== 테스트 완료 ===');
  console.log(`최종 URL: http://localhost?${result.transformedQueries[0].finalValue}`);
  console.log(`내부 추적 개수: ${result.innerTraces.length}`);
}).catch(console.error);