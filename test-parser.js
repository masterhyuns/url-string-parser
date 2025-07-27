// Temporary test script to demonstrate URL parsing
const { useParseState, ParameterType } = require('./dist/index.js');

async function testUrlParsing() {
  console.log('=== URL Parser Test ===');
  console.log('Input URL: myapp://service?where=e{PROC=!@r{NAME}}&value=v{LITERAL}');
  console.log();

  // Mock type converter that simulates API calls
  const typeConverter = async (value, type) => {
    console.log(`🔄 Converting "${value}" of type ${type}`);
    
    const mockResponses = {
      'PROC': 'PROC_VALUE',
      'NAME': 'NAME_VALUE',
      'HONG1': 'HONG1_VALUE',
      'HONG2': 'HONG2_VALUE', 
      'KING1': 'KING1_VALUE',
      'KING2': 'KING2_VALUE'
    };
    
    const result = mockResponses[value] || `${value}_CONVERTED`;
    console.log(`✅ Converted "${value}" → "${result}"`);
    return result;
  };

  // Mock encryptor that simulates encryption API
  const encryptor = async (value) => {
    console.log(`🔐 Encrypting "${value}"`);
    const encrypted = `ENC[${value}]`;
    console.log(`✅ Encrypted "${value}" → "${encrypted}"`);
    return encrypted;
  };

  // Initialize parser with converters
  const { parseResult, updateParseResult, getReconstructedUrl } = useParseState(
    typeConverter,
    encryptor
  );

  console.log('📋 Step 1: Parsing URL structure...');
  await updateParseResult('myapp://service?where=e{PROC=!@r{NAME}}&value=v{LITERAL}', true);

  console.log('\n📊 Step 2: Parse Results');
  console.log('Base URL:', parseResult.baseUrl);
  console.log('Reconstructed Path:', parseResult.reconstructedPath);
  
  console.log('\n🔍 Step 3: URL Segments Analysis');
  parseResult.url.forEach((segment, index) => {
    console.log(`Segment ${index + 1}:`, segment.segment);
    console.log('  Original Value:', segment.originalValue);
    console.log('  Flags:', segment.flags);
    console.log('  Type:', segment.type);
    console.log('  Extracted Value:', segment.extractedValue);
    console.log('  Converted Value:', segment.convertedValue);
    console.log('  Encrypted Value:', segment.encryptedValue);
    console.log('  Final Value:', segment.finalValue);
    console.log();
  });

  console.log('🔍 Step 4: Query Parameters Analysis');
  parseResult.query.forEach((query, index) => {
    console.log(`Query ${index + 1}: ${query.key}=${query.value}`);
    console.log('  Original Value:', query.originalValue);
    console.log('  Flags:', query.flags);
    console.log('  Type:', query.type);
    console.log('  Processing Mode:', query.processingMode);
    console.log('  Extracted Value:', query.extractedValue);
    console.log('  Converted Value:', query.convertedValue);
    console.log('  Encrypted Value:', query.encryptedValue);
    console.log('  Final Value:', query.finalValue);
    console.log();
  });

  console.log('🎯 Step 5: Final Reconstructed URL');
  const finalUrl = getReconstructedUrl();
  console.log('Final URL:', finalUrl);
  
  return {
    parseResult,
    finalUrl
  };
}

// Export for potential use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testUrlParsing };
}

// Run if executed directly  
if (require.main === module) {
  testUrlParsing().catch(console.error);
}