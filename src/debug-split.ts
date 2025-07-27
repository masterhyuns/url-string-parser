// 중괄호를 고려한 스마트 split
const smartSplitQuery = (content: string): string[] => {
  const pairs: string[] = [];
  let current = '';
  let depth = 0;
  
  console.log('입력:', content);
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      depth++;
      console.log(`위치 ${i}: '${char}' -> depth: ${depth}`);
    } else if (char === '}') {
      depth--;
      console.log(`위치 ${i}: '${char}' -> depth: ${depth}`);
    } else if (char === '&' && depth === 0) {
      console.log(`위치 ${i}: '${char}' -> 구분자 발견, current: '${current}'`);
      if (current.trim()) {
        pairs.push(current);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    pairs.push(current);
  }
  
  console.log('결과:', pairs);
  return pairs;
};

// 테스트
const testQuery = 'name={A_TYPE_2}&where=e{PRD!@=!@r{A_TYPE_1}!@AND!@STEP!@=!@er{A_TYPE_2}}';
smartSplitQuery(testQuery);