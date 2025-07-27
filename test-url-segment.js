// Simple test for URL segment issue
const testUrl = 'http://localhost/v{TEXT}.com?name={A_TYPE_1}';

// Manual URL parsing to see the issue
const protocolMatch = testUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
console.log('Protocol match:', protocolMatch);

if (protocolMatch) {
  const protocol = protocolMatch[1];
  const afterProtocol = testUrl.substring(protocolMatch[0].length);
  console.log('After protocol:', afterProtocol);
  
  const pathStart = afterProtocol.indexOf('/');
  const queryStart = afterProtocol.indexOf('?');
  console.log('Path start:', pathStart, 'Query start:', queryStart);
  
  let host = '';
  let path = '';
  let query = '';
  
  if (pathStart !== -1) {
    host = afterProtocol.substring(0, pathStart);
    const afterHost = afterProtocol.substring(pathStart);
    const queryInPath = afterHost.indexOf('?');
    
    if (queryInPath === -1) {
      path = afterHost;
    } else {
      path = afterHost.substring(0, queryInPath);
      query = afterHost.substring(queryInPath + 1);
    }
  }
  
  console.log('Parsed components:');
  console.log('- Protocol:', protocol);
  console.log('- Host:', host);
  console.log('- Path:', path);
  console.log('- Query:', query);
  
  // Now check segment parsing
  const segments = path.split('/').filter(segment => segment !== '');
  console.log('Segments:', segments);
  
  // The issue is that "v{TEXT}.com" is treated as a single segment
  // which should be processed in substitution mode
  segments.forEach((segment, idx) => {
    console.log(`Segment ${idx}: "${segment}"`);
    
    // Check if it contains brackets but isn't a direct parameter
    const hasComplexStructure = segment.includes('{') && segment.includes('}') && 
                               !(segment.match(/^[erv]*\{[^{}]+\}$/));
    
    console.log(`  - Has complex structure: ${hasComplexStructure}`);
    
    if (hasComplexStructure) {
      console.log(`  - This should be processed in SUBSTITUTION mode`);
      console.log(`  - Pattern: "${segment}" should become "TEXT.com"`);
    }
  });
}