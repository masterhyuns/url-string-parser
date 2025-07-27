import { useUrlQueryParser, ParameterType } from '../index';

const examples = () => {
  console.log('=== URL & QueryString Parser Examples ===\n');

  const basicExample = () => {
    console.log('1. Basic Example - No API Transformation');
    const { parseResult, updateParseResult } = useUrlQueryParser();
    
    updateParseResult('custom://app/r{HONG1}?name=e{KING2}');
    
    console.log('Parse Result:', parseResult);
    console.log('URL Segments:', parseResult.url);
    console.log('Query Parameters:', parseResult.query);
    console.log('---\n');
  };

  const withApiTransformationExample = async () => {
    console.log('2. With API Transformation Example');
    
    const typeConverter = async (value: string, type: ParameterType) => {
      console.log(`Converting ${value} of type ${type}`);
      const mockResponses: Record<string, string> = {
        'HONG1': 'converted_hong1',
        'HONG2': 'converted_hong2',
        'KING1': 'converted_king1',
        'KING2': 'converted_king2'
      };
      return mockResponses[value] || value;
    };

    const encryptor = async (value: string) => {
      console.log(`Encrypting ${value}`);
      return `encrypted_${value}`;
    };

    const { parseResult, updateParseResult, getReconstructedUrl } = useUrlQueryParser(
      typeConverter,
      encryptor
    );
    
    await updateParseResult('http://test.com/e{HONG1}?name=r{KING2}', true);
    
    console.log('Parse Result:', parseResult);
    console.log('Reconstructed URL:', getReconstructedUrl());
    console.log('---\n');
  };

  const nestedStructureExample = async () => {
    console.log('3. Nested Structure Example');
    
    const { parseResult, updateParseResult } = useUrlQueryParser();
    
    await updateParseResult('myapp://service/e{PROC=!@r{NAME}}?where=v{LITERAL}');
    
    console.log('Parse Result:', parseResult);
    console.log('URL Segments:', parseResult.url);
    console.log('Query Parameters:', parseResult.query);
    console.log('---\n');
  };

  const globalFlagsExample = async () => {
    console.log('4. Global Flags Example');
    
    const { parseResult, updateParseResult } = useUrlQueryParser();
    
    await updateParseResult('http://test.com/path?er{name=e{PROC=!@r{NAME}}&type=KING1}');
    
    console.log('Parse Result:', parseResult);
    console.log('Query Parameters with Global Flags:', parseResult.query);
    console.log('---\n');
  };

  const complexExample = async () => {
    console.log('5. Complex Example with Multiple Features');
    
    const typeConverter = async (value: string, type: ParameterType) => {
      const mockResponses: Record<string, string> = {
        'HONG3': 'converted_hong3',
        'DATA': 'converted_data',
        'KEY': 'converted_key'
      };
      return mockResponses[value] || value;
    };

    const encryptor = async (value: string) => {
      return `ENC[${value}]`;
    };

    const { parseResult, updateParseResult, getReconstructedUrl } = useUrlQueryParser(
      typeConverter,
      encryptor
    );
    
    await updateParseResult(
      'https://api.com/er{DATA=v{VALUE}@r{KEY}}?status=er{HONG3}',
      true
    );
    
    console.log('Parse Result:', parseResult);
    console.log('URL Segments:', parseResult.url);
    console.log('Query Parameters:', parseResult.query);
    console.log('Reconstructed URL:', getReconstructedUrl());
    console.log('---\n');
  };

  const printParameterDetails = (param: any) => {
    console.log('Parameter Details:');
    console.log('  Original Value:', param.originalValue);
    console.log('  Flags:', param.flags);
    console.log('  Type:', param.type);
    console.log('  Extracted Value:', param.extractedValue);
    console.log('  Converted Value:', param.convertedValue);
    console.log('  Encrypted Value:', param.encryptedValue);
    console.log('  Final Value:', param.finalValue);
  };

  const detailedExample = async () => {
    console.log('6. Detailed Parameter Analysis');
    
    const { parseResult, updateParseResult } = useUrlQueryParser();
    
    await updateParseResult('/local/path/r{HONG1}?test=e{KING2}&literal=v{SOME_VALUE}');
    
    console.log('URL Segment Analysis:');
    parseResult.url.forEach((segment, index) => {
      console.log(`\nSegment ${index + 1}: ${segment.segment}`);
      printParameterDetails(segment);
    });
    
    console.log('\n\nQuery Parameter Analysis:');
    parseResult.query.forEach((query, index) => {
      console.log(`\nQuery ${index + 1}: ${query.key}=${query.value}`);
      printParameterDetails(query);
    });
  };

  return {
    basicExample,
    withApiTransformationExample,
    nestedStructureExample,
    globalFlagsExample,
    complexExample,
    detailedExample
  };
};

export default examples;