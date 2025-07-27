import { ParameterType, ParameterFlags, ProcessingMode, ATYPE_VALUES, BTYPE_VALUES } from '../types/parser.types';

/**
 * 주어진 값이 어떤 타입에 속하는지 감지합니다.
 * 
 * 로직 설명:
 * - ATYPE_VALUES 배열에 값이 있으면 A 타입
 * - BTYPE_VALUES 배열에 값이 있으면 B 타입  
 * - 둘 다 아니면 UNKNOWN 타입
 * 
 * 이 함수가 필요한 이유:
 * - 파싱된 값이 변환 API를 호출해야 하는지 판단하기 위해
 * - A/B 타입은 각각 다른 변환 API를 호출해야 함
 * 
 * @param value 검사할 값 (예: 'A_TYPE_1', 'B_TYPE_2')
 * @returns ParameterType enum 값
 */
export const detectParameterType = (value: string): ParameterType => {
  if ((ATYPE_VALUES as readonly string[]).includes(value)) {
    return ParameterType.A;
  }
  if ((BTYPE_VALUES as readonly string[]).includes(value)) {
    return ParameterType.B;
  }
  return ParameterType.UNKNOWN;
};

/**
 * 플래그 문자열을 파싱하여 ParameterFlags 객체로 변환합니다.
 * 
 * 로직 설명:
 * - 'e': encrypted (암호화 대상)
 * - 'r': required (필수값)  
 * - 'v': literal (리터럴 값, 타입 변환 없이 그대로 사용)
 * 
 * 왜 이렇게 구현했는가:
 * - 플래그는 순서에 상관없이 조합 가능 (예: 'er', 've', 'rev' 모두 유효)
 * - 각 문자를 순회하면서 해당하는 플래그를 true로 설정
 * - 알 수 없는 문자는 무시하여 안정성 확보
 * 
 * @param flagString 플래그 문자열 (예: 'er', 'v', 'rev')
 * @returns 파싱된 플래그 객체
 */
export const parseFlags = (flagString: string): ParameterFlags => {
  const flags: ParameterFlags = {
    encrypted: false,
    required: false,
    literal: false
  };

  // 각 문자를 순회하면서 해당하는 플래그 설정
  for (const char of flagString) {
    switch (char) {
      case 'e':
        flags.encrypted = true;
        break;
      case 'r':
        flags.required = true;
        break;
      case 'v':
        flags.literal = true;
        break;
      // 알 수 없는 문자는 무시 (미래 확장성 고려)
    }
  }

  return flags;
};

/**
 * 중괄호가 포함된 입력에서 플래그와 값을 추출합니다.
 * 
 * 로직 설명:
 * - 정규식 패턴: ^([erv]*)\{(.+)\}$
 *   - ^([erv]*): 시작부터 e, r, v 문자들 (플래그 부분)
 *   - \{(.+)\}: 중괄호 안의 내용 (실제 값 부분)
 *   - $: 문자열 끝까지
 * 
 * 왜 이 방식을 선택했는가:
 * - 파라미터 모드에서만 사용됨 (예: e{A_TYPE_1}, v{LITERAL})
 * - 치환 모드는 별도 함수에서 처리 (복잡한 중첩 구조 때문)
 * - 매치되지 않으면 플래그 없는 일반 값으로 처리
 * 
 * @param input 입력 문자열 (예: 'e{A_TYPE_1}', 'v{LITERAL}')
 * @returns 파싱된 결과 객체
 */
export const extractValueWithBrackets = (input: string): {
  value: string;
  flags: ParameterFlags;
  extractedValue: string | null;
} => {
  // 파라미터 형태 매칭: [플래그]{값}
  const match = input.match(/^([erv]*)\{(.+)\}$/);
  
  if (!match) {
    // 중괄호가 없거나 패턴이 맞지 않으면 일반 값으로 처리
    return {
      value: input,
      flags: { encrypted: false, required: false, literal: false },
      extractedValue: null
    };
  }

  const [, flagString, content] = match;
  const flags = parseFlags(flagString);
  
  return {
    value: input,
    flags,
    extractedValue: content
  };
};

/**
 * 전역 플래그를 감지하고 분리하는 핵심 함수
 * 
 * 전역 플래그란 무엇인가:
 * - 쿼리스트링 전체에 적용되는 플래그 (예: ?er{name={A_TYPE_1}&value=test})
 * - 내부 쿼리들을 먼저 변환한 후, 전체 결과에 다시 플래그 적용
 * - 일반 플래그와 달리 2단계 변환 과정을 거침
 * 
 * 왜 전역 플래그가 필요한가:
 * 1. **보안 강화**: 개별 변환 후 전체를 다시 암호화하여 이중 보안
 * 2. **무결성 보장**: 쿼리스트링 전체가 하나의 암호화 단위가 됨
 * 3. **중첩 처리**: 복잡한 구조도 단계별로 안전하게 처리
 * 
 * 처리 과정:
 * 1. ?e{name={A_TYPE_1}&value=B_TYPE_2} 입력
 * 2. 전역 플래그 'e' 감지
 * 3. 내부 "name={A_TYPE_1}&value=B_TYPE_2" 추출
 * 4. 내부를 먼저 변환 → "name=A_TYPE_1_VALUE&value=B_TYPE_2_VALUE"
 * 5. 전체 문자열을 암호화 → "ENCRYPTED_STRING"
 * 6. 최종 결과: ?ENCRYPTED_STRING
 * 
 * 전역 vs 일반 플래그 차이:
 * - 일반: name=e{A_TYPE_1} → name=ENCRYPTED_VALUE (개별 암호화)
 * - 전역: e{name={A_TYPE_1}} → ENCRYPTED_STRING (전체 암호화)
 * 
 * @param input 검사할 쿼리스트링 (예: 'er{name={A_TYPE_1}&value=test}')
 * @returns 파싱된 전역 구조 정보
 */
export const parseNestedStructure = (input: string): {
  value: string;
  globalFlags: ParameterFlags;
  content: string;
} => {
  // 전역 플래그 패턴 매칭: ^([erv]*)\{(.+)\}$
  // - 쿼리 시작부터 끝까지 전체가 [플래그]{내용} 형태여야 함
  // - 부분적인 플래그는 전역이 아님 (예: name=e{VALUE}는 일반 플래그)
  const globalMatch = input.match(/^([erv]*)\{(.+)\}$/);
  
  if (globalMatch) {
    const [, flagString, content] = globalMatch;
    const flags = parseFlags(flagString);
    
    // 실제로 플래그가 설정되어 있는지 확인
    // 빈 문자열 {}만 있는 경우는 전역 플래그가 아님
    if (flags.encrypted || flags.required || flags.literal) {
      console.log(`[DEBUG] Global flags detected: ${flagString} -> ${JSON.stringify(flags)}`);
      return {
        value: input,
        globalFlags: flags,
        content // 전역 플래그를 제거한 순수한 내부 내용
      };
    }
  }
  
  // 전역 플래그가 없는 경우: 일반 쿼리스트링으로 처리
  return {
    value: input,
    globalFlags: { encrypted: false, required: false, literal: false },
    content: input // 원본 그대로 반환
  };
};

/**
 * 플래그 우선순위를 고려하여 최종 파라미터 타입을 결정하는 함수
 * 
 * 타입 결정 로직의 핵심:
 * - literal 플래그(v)는 모든 다른 타입보다 우선순위가 높음
 * - 이는 사용자가 명시적으로 "이 값을 변환하지 말고 그대로 사용해라"라고 지시한 것이기 때문
 * 
 * 왜 이런 우선순위가 필요한가:
 * 1. **명시적 의도 존중**: v{TEXT}는 TEXT가 A/B 타입 목록에 있더라도 리터럴로 처리
 * 2. **예측 가능성**: 사용자가 v 플래그를 쓰면 반드시 원본 값이 나옴을 보장
 * 3. **타입 충돌 해결**: 같은 문자열이 여러 타입에 해당할 때의 모호함 제거
 * 
 * 사용 시나리오:
 * 1. **일반 케이스**: {A_TYPE_1} → detectParameterType으로 A 타입 반환
 * 2. **리터럴 케이스**: v{A_TYPE_1} → 강제로 LITERAL 타입 반환 (변환 안함)
 * 3. **혼합 케이스**: ev{A_TYPE_1} → LITERAL 우선 (암호화는 원본 값으로)
 * 
 * 처리 결과 비교:
 * - {A_TYPE_1}: 타입=A, 변환됨 → A_TYPE_1_VALUE
 * - v{A_TYPE_1}: 타입=LITERAL, 변환안됨 → A_TYPE_1 (원본 그대로)
 * - e{A_TYPE_1}: 타입=A, 변환+암호화 → ENCRYPTED(A_TYPE_1_VALUE)
 * - ev{A_TYPE_1}: 타입=LITERAL, 암호화만 → ENCRYPTED(A_TYPE_1)
 * 
 * @param value 검사할 값 (중괄호 안의 내용)
 * @param flags 파싱된 플래그 정보
 * @returns 결정된 파라미터 타입
 */
export const determineParameterType = (value: string, flags: ParameterFlags): ParameterType => {
  // 1순위: literal 플래그 확인
  // v 플래그가 있으면 무조건 LITERAL 타입으로 처리
  // 다른 모든 타입 감지를 무시하고 원본 값 사용
  if (flags.literal) {
    return ParameterType.LITERAL;
  }
  
  // 2순위: 일반 타입 감지 (A/B/UNKNOWN)
  // ATYPE_VALUES, BTYPE_VALUES 배열과 매칭하여 타입 결정
  return detectParameterType(value);
};

/**
 * 복잡한 값 우선순위 로직을 적용하여 최종 사용할 값을 결정하는 핵심 함수
 * 
 * 이 함수가 중요한 이유:
 * - 파싱 과정에서 생성된 여러 값들(원본, 추출, 변환, 암호화) 중 어떤 것을 사용할지 결정
 * - 처리 모드에 따라 다른 우선순위 적용 (파라미터 vs 치환)
 * - 빈 값 처리 전략이 모드별로 다름
 * 
 * 6단계 우선순위 상세 설명:
 * 
 * 1순위: **암호화된 값** (encryptedValue)
 *   - 보안상 가장 중요한 값
 *   - e 플래그가 있고 암호화가 성공한 경우
 *   - 예: e{A_TYPE_1} → A_TYPE_1_VALUE → ENCRYPTED(A_TYPE_1_VALUE)
 * 
 * 2순위: **타입 변환된 값** (convertedValue)  
 *   - API 호출로 얻은 실제 비즈니스 값
 *   - A/B 타입인 경우 TypeConverter가 반환한 값
 *   - 예: {A_TYPE_1} → A_TYPE_1_VALUE
 * 
 * 3순위: **리터럴 값** (extractedValue with v flag)
 *   - 사용자가 명시적으로 변환 금지한 값
 *   - v 플래그가 있는 경우에만 적용
 *   - 예: v{LITERAL_TEXT} → LITERAL_TEXT
 * 
 * 4순위: **치환 모드 빈 값**
 *   - 치환 모드에서 변환 실패시 빈 문자열로 치환
 *   - URL이나 쿼리에서 해당 부분이 사라짐
 *   - 예: PROC=!@{UNKNOWN} → PROC=!@
 * 
 * 5순위: **파라미터 모드 빈 값**
 *   - 파라미터 모드에서 변환 실패시 빈 값 (필터링 대상)
 *   - 해당 파라미터가 최종 URL에서 제외됨
 *   - 예: name={UNKNOWN} → 파라미터 전체 제외
 * 
 * 6순위: **원본 값** (fallback)
 *   - 이론적으로는 거의 도달하지 않는 케이스
 *   - 모든 처리가 실패했을 때의 안전장치
 * 
 * 처리 모드별 차이점:
 * 
 * **PARAMETER 모드**: 값이 없으면 파라미터 자체를 제외
 * - name={UNKNOWN} → 변환 실패 → name 파라미터 전체 제외
 * - 결과: ?other=value (name은 아예 없음)
 * 
 * **SUBSTITUTION 모드**: 값이 없으면 해당 부분만 빈 문자열로 치환
 * - where=PROC=!@{UNKNOWN} → PROC=!@ (부분 치환)
 * - 결과: where=PROC=!@ (문자열 일부만 사라짐)
 * 
 * 실제 사용 케이스:
 * 1. e{A_TYPE_1} → 암호화값 (1순위)
 * 2. {A_TYPE_1} → 변환값 (2순위)  
 * 3. v{TEXT} → TEXT (3순위)
 * 4. {UNKNOWN} in substitution → '' (4순위)
 * 5. {UNKNOWN} in parameter → '' (5순위, 필터링됨)
 * 
 * @param originalValue 파싱 전 원본 값
 * @param extractedValue 중괄호에서 추출한 값
 * @param convertedValue 타입 변환 API 결과
 * @param encryptedValue 암호화 API 결과
 * @param flags 파싱된 플래그 정보
 * @param type 감지된 파라미터 타입
 * @param processingMode 처리 모드 (기본값: PARAMETER)
 * @returns 최종 사용할 값
 */
export const getFinalValue = (
  originalValue: string,
  extractedValue: string | null,
  convertedValue: string | null,
  encryptedValue: string | null,
  flags: ParameterFlags,
  type: ParameterType,
  processingMode: ProcessingMode = ProcessingMode.PARAMETER
): string => {
  // 1순위: 암호화된 값 (최우선)
  // 보안이 가장 중요하므로 암호화가 성공했다면 무조건 사용
  if (encryptedValue !== null) {
    return encryptedValue;
  }
  
  // 2순위: 타입 변환된 값
  // A/B 타입 변환이 성공했다면 비즈니스 로직상 가장 의미있는 값
  if (convertedValue !== null) {
    return convertedValue;
  }
  
  // 3순위: 리터럴(v) 플래그인 경우에만 추출된 값 사용
  // 사용자가 명시적으로 "변환하지 말고 그대로 써라"라고 지시한 경우
  if (flags.literal && extractedValue !== null) {
    return extractedValue;
  }
  
  // 4순위: 치환 모드에서 변환 실패시 빈 값으로 치환
  // 문자열 내부의 일부분이므로 빈 문자열로 대체하여 나머지 문자열 보존
  // 예: "PROC=!@{UNKNOWN}" → "PROC=!@" (부분 치환)
  if (processingMode === ProcessingMode.SUBSTITUTION && !flags.literal && !convertedValue) {
    return '';
  }
  
  // 5순위: 파라미터 모드에서 변환 실패시 빈 값 (필터링 대상)
  // 파라미터 전체가 의미없으므로 빈 값으로 표시하여 나중에 필터링됨
  // 예: "name={UNKNOWN}" → name 파라미터 전체 제외
  if (processingMode === ProcessingMode.PARAMETER && !flags.literal && !convertedValue) {
    return '';
  }
  
  // 6순위: 원본 값 (최후 안전장치)
  // 이론적으로는 도달하지 않아야 하는 케이스
  // 모든 로직이 실패했을 때의 fallback
  return originalValue;
};

/**
 * 최종 URL 재구성시 해당 파라미터/세그먼트를 포함할지 결정하는 검증 함수
 * 
 * 이 함수의 목적:
 * - getFinalValue로 빈 값이 나온 파라미터들을 실제로 URL에서 제외할지 판단
 * - 처리 모드에 따라 다른 필터링 정책 적용
 * - 변환 실패한 항목들이 최종 URL을 오염시키지 않도록 방지
 * 
 * 유효성 검증 기준:
 * 
 * **1. 치환 모드는 항상 유효**
 *   - 이유: 문자열의 일부분이므로 빈 값이라도 전체 문자열 구조 유지 필요
 *   - 예: "PROC=!@{UNKNOWN}" → "PROC=!@" (빈 값이어도 포함)
 *   - 결과: where=PROC=!@ (파라미터 자체는 유지)
 * 
 * **2. 리터럴 값은 항상 유효**
 *   - 이유: 사용자가 명시적으로 지정한 값이므로 빈 값이라도 존중
 *   - 예: v{} → 빈 문자열이지만 의도적인 값
 *   - 결과: name= (빈 값이지만 파라미터 포함)
 * 
 * **3. UNKNOWN 타입 + 변환 실패 = 무효**
 *   - 이유: 변환할 수 없는 값이므로 URL에 포함하면 안됨
 *   - 예: {INVALID_VALUE} → 타입 감지 실패 + 변환 없음
 *   - 결과: 해당 파라미터 완전 제외
 * 
 * **4. A/B 타입 + 변환 실패 = 무효**
 *   - 이유: 타입은 감지되었으나 변환 API 호출 실패
 *   - 예: {A_TYPE_1} but TypeConverter 없음
 *   - 결과: 해당 파라미터 완전 제외
 * 
 * 모드별 필터링 차이점:
 * 
 * **PARAMETER 모드** (엄격한 필터링):
 * - 변환 실패시 파라미터 전체 제외
 * - ?name={UNKNOWN}&valid=test → ?valid=test
 * - 깔끔한 URL 유지를 위해 의미없는 파라미터 제거
 * 
 * **SUBSTITUTION 모드** (관대한 필터링):
 * - 변환 실패해도 항상 포함 (빈 값으로 치환)
 * - where=PROC=!@{UNKNOWN} → where=PROC=!@
 * - 문자열 구조 보존을 위해 항상 포함
 * 
 * 실제 사용 시나리오:
 * 
 * 1. **성공 케이스**: 모든 모드에서 유효
 *    - {A_TYPE_1} → A_TYPE_1_VALUE (포함)
 *    - v{TEXT} → TEXT (포함)
 * 
 * 2. **실패 케이스 - 파라미터 모드**: 제외됨
 *    - {UNKNOWN} → 파라미터 전체 제외
 *    - ?name={UNKNOWN}&valid=test → ?valid=test
 * 
 * 3. **실패 케이스 - 치환 모드**: 포함됨 (빈 값)
 *    - where=PROC=!@{UNKNOWN} → where=PROC=!@
 *    - 문자열은 유지, 해당 부분만 빈 값
 * 
 * 4. **리터럴 케이스**: 항상 포함
 *    - v{ANYTHING} → ANYTHING (빈 값이라도 포함)
 * 
 * @param type 감지된 파라미터 타입
 * @param extractedValue 중괄호에서 추출한 값
 * @param convertedValue 타입 변환 결과
 * @param flags 파싱된 플래그 정보
 * @param processingMode 처리 모드 (기본값: PARAMETER)
 * @returns true면 최종 URL에 포함, false면 제외
 */
export const isValidValue = (
  type: ParameterType,
  extractedValue: string | null,
  convertedValue: string | null,
  flags: ParameterFlags,
  processingMode: ProcessingMode = ProcessingMode.PARAMETER
): boolean => {
  // 1순위: 치환 모드는 항상 유효 (문자열 구조 보존)
  // 빈 값으로 치환되더라도 전체 문자열에서 해당 부분만 사라지므로 포함
  if (processingMode === ProcessingMode.SUBSTITUTION) {
    return true;
  }
  
  // 2순위: 리터럴 값은 항상 유효 (사용자 명시적 의도)
  // v 플래그가 있으면 빈 값이라도 사용자가 의도한 것이므로 존중
  if (flags.literal) {
    return true;
  }
  
  // 3순위: UNKNOWN 타입 + 변환 실패 = 무효
  // 타입을 감지할 수 없고 변환도 불가능한 경우 URL에 포함하면 안됨
  if (type === ParameterType.UNKNOWN && !convertedValue) {
    return false;
  }
  
  // 4순위: A/B 타입이지만 변환 실패 = 무효
  // 타입은 감지되었으나 실제 변환이 실패한 경우 (API 없음 등)
  if ((type === ParameterType.A || type === ParameterType.B) && !convertedValue) {
    return false;
  }
  
  // 기본적으로 유효 (위 조건들을 통과한 경우)
  return true;
};

/**
 * 커스텀 프로토콜을 지원하는 URL 파싱 함수
 * 
 * 표준 URL() 생성자 대신 사용하는 이유:
 * 1. **커스텀 프로토콜 지원**: custom://, myapp:// 같은 비표준 프로토콜 처리
 * 2. **브라우저 호환성**: 일부 브라우저에서 커스텀 프로토콜을 지원하지 않음
 * 3. **정확한 파싱**: 프로토콜이 없는 경로도 올바르게 처리
 * 
 * 지원하는 URL 형태:
 * 1. **완전한 URL**: http://host/path?query
 * 2. **커스텀 프로토콜**: custom://app/action?params
 * 3. **프로토콜 없는 경로**: /local/path?query
 * 4. **호스트만**: https://example.com
 * 5. **쿼리만**: ?name=value
 * 
 * 파싱 알고리즘:
 * 
 * **1단계: 프로토콜 감지**
 * - 정규식: ^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/
 * - 프로토콜명: 영문자로 시작, 영숫자+점+하이픈 허용
 * - 예: http, https, custom, myapp, file
 * 
 * **2단계: 프로토콜별 처리 분기**
 * 
 * **프로토콜 없는 경우**:
 * - 로컬 경로로 간주: /path?query 또는 ?query
 * - protocol='', host='', path와 query만 분리
 * - 예: /users/123?id=1 → path="/users/123", query="id=1"
 * 
 * **프로토콜 있는 경우**:
 * - 복잡한 구성요소 분리 로직 적용
 * - host, path, query 순서로 파싱
 * 
 * **3단계: 구성요소 분리 (프로토콜 있는 경우)**
 * 
 * 케이스 1: **호스트만 있는 경우**
 * - pathStart === -1 && queryStart === -1
 * - 예: https://example.com → host="example.com"
 * 
 * 케이스 2: **호스트 + 쿼리 (경로 없음)**
 * - pathStart === -1 || queryStart < pathStart
 * - 예: https://api.com?key=value → host="api.com", query="key=value"
 * 
 * 케이스 3: **호스트 + 경로 (±쿼리)**
 * - 일반적인 URL 구조
 * - 예: https://api.com/users/123?id=1
 * 
 * 엣지 케이스 처리:
 * 
 * 1. **빈 구성요소**: 각 부분이 없으면 빈 문자열 반환
 * 2. **특수 문자**: 쿼리 파라미터의 &, = 등은 여기서 처리하지 않음
 * 3. **중첩 쿼리**: ? 이후 모든 내용을 query로 처리 (파싱은 별도 함수)
 * 4. **인코딩**: URL 인코딩/디코딩은 하지 않음 (원본 유지)
 * 
 * 사용 예시:
 * 
 * ```typescript
 * // 표준 HTTP URL
 * parseUrlComponents("https://api.example.com/users/123?id=1&name=test")
 * // → { protocol: "https", host: "api.example.com", path: "/users/123", query: "id=1&name=test" }
 * 
 * // 커스텀 프로토콜  
 * parseUrlComponents("myapp://action/process?data=value")
 * // → { protocol: "myapp", host: "action", path: "/process", query: "data=value" }
 * 
 * // 로컬 경로
 * parseUrlComponents("/local/path?param=1")
 * // → { protocol: "", host: "", path: "/local/path", query: "param=1" }
 * 
 * // 쿼리만
 * parseUrlComponents("?name=value&type=test")
 * // → { protocol: "", host: "", path: "", query: "name=value&type=test" }
 * ```
 * 
 * 주의사항:
 * - 이 함수는 단순 분리만 수행, 검증이나 정규화는 하지 않음
 * - 쿼리 파라미터 파싱은 별도 함수(parseQueryString)에서 처리
 * - URL 인코딩된 값들은 원본 그대로 유지
 * 
 * @param urlString 파싱할 URL 문자열
 * @returns 분리된 URL 구성요소 객체
 */
export const parseUrlComponents = (urlString: string): {
  protocol: string;
  host: string;
  path: string;
  query: string;
} => {
  // 1단계: 프로토콜 감지
  // 정규식: 영문자로 시작하는 프로토콜명 + ://
  // 커스텀 프로토콜(myapp://, custom://)도 지원
  const protocolMatch = urlString.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  
  // 프로토콜이 없는 경우: 로컬 경로로 처리
  if (!protocolMatch) {
    const queryIndex = urlString.indexOf('?');
    return {
      protocol: '',
      host: '',
      // 쿼리가 있으면 ? 앞까지가 경로, 없으면 전체가 경로
      path: queryIndex === -1 ? urlString : urlString.substring(0, queryIndex),
      // 쿼리가 있으면 ? 뒤 전체, 없으면 빈 문자열
      query: queryIndex === -1 ? '' : urlString.substring(queryIndex + 1)
    };
  }
  
  // 2단계: 프로토콜 추출 및 나머지 부분 분리
  const protocol = protocolMatch[1]; // 프로토콜명만 (:/는 제외)
  const afterProtocol = urlString.substring(protocolMatch[0].length); // 프로토콜:// 이후
  
  // 3단계: 호스트 이후에서 경로와 쿼리 시작점 찾기
  const pathStart = afterProtocol.indexOf('/'); // 첫 번째 / 위치
  const queryStart = afterProtocol.indexOf('?'); // 첫 번째 ? 위치
  
  let host = '';
  let path = '';
  let query = '';
  
  // 케이스 1: 호스트만 있는 경우 (경로도 쿼리도 없음)
  // 예: https://example.com
  if (pathStart === -1 && queryStart === -1) {
    host = afterProtocol;
  } 
  // 케이스 2: 호스트 + 쿼리 (경로 없음) 또는 쿼리가 경로보다 먼저 나오는 경우
  // 예: https://api.com?key=value
  else if (pathStart === -1 || (queryStart !== -1 && queryStart < pathStart)) {
    host = afterProtocol.substring(0, queryStart);
    query = afterProtocol.substring(queryStart + 1);
  } 
  // 케이스 3: 일반적인 경우 (호스트 + 경로 ± 쿼리)
  // 예: https://api.com/users/123?id=1
  else {
    host = afterProtocol.substring(0, pathStart);
    const afterHost = afterProtocol.substring(pathStart); // 경로부터 끝까지
    const queryInPath = afterHost.indexOf('?'); // 경로 부분에서 쿼리 시작점
    
    if (queryInPath === -1) {
      // 쿼리가 없는 경우: 경로만
      path = afterHost;
    } else {
      // 쿼리가 있는 경우: 경로와 쿼리 분리
      path = afterHost.substring(0, queryInPath);
      query = afterHost.substring(queryInPath + 1);
    }
  }
  
  return { protocol, host, path, query };
};

/**
 * 치환 모드에서 복잡한 문자열 내부의 중괄호 패턴들을 처리하는 핵심 함수
 * 
 * 이 함수가 필요한 이유:
 * - 정규식으로는 중첩된 중괄호 매칭이 불가능
 * - "PROC=!@r{NAME}AND{VALUE}" 같은 복잡한 구조 처리 필요
 * - 안쪽부터 바깥쪽으로 순차 처리해야 올바른 결과
 * 
 * 알고리즘 선택 이유:
 * - 스택 기반 파싱: 중괄호 매칭의 표준 알고리즘
 * - 여러 번 반복: 안쪽 중괄호 처리 후 바깥쪽 처리
 * - 플래그 역추적: {앞의 e,r,v 문자들을 찾아서 플래그로 인식
 * 
 * 처리 과정:
 * 1. "PROC=!@r{NAME}" 입력
 * 2. r{NAME} 감지 (r은 플래그, NAME은 값)
 * 3. NAME을 API로 변환 → NAME_VALUE
 * 4. r{NAME}을 NAME_VALUE로 치환
 * 5. "PROC=!@NAME_VALUE" 결과
 * 
 * @param content 치환할 문자열
 * @param typeConverter 타입 변환 함수 (옵션)
 * @param encryptor 암호화 함수 (옵션)
 * @param onInnerTrace 내부 변환 추적 콜백 (옵션)
 * @returns 치환 완료된 문자열
 */
export const processSubstitution = async (
  content: string,
  typeConverter?: (value: string, type: ParameterType) => Promise<string>,
  encryptor?: (value: string) => Promise<string>,
  onInnerTrace?: (trace: {
    type: ParameterType;
    target: string;
    convertedValue: string | null;
    encryptedValue: string | null;
    result: string;
    flags: ParameterFlags;
    transformationSuccess: boolean;
    failureReason?: string;
  }) => void
): Promise<string> => {
  const result = content;
  
  /**
   * 중첩된 중괄호를 스택으로 처리하는 내부 함수
   * 
   * 스택 기반 알고리즘을 사용하는 이유:
   * - 정규식은 중첩 구조를 처리할 수 없음
   * - 괄호 매칭은 스택의 전형적인 응용 사례
   * - 가장 안쪽 괄호부터 처리해야 올바른 결과
   */
  const processNestedBrackets = async (text: string): Promise<string> => {
    let processed = text;
    let hasChanges = true;
    
    // 변화가 있을 때까지 반복 (안쪽부터 바깥쪽으로)
    while (hasChanges) {
      hasChanges = false;
      const stack: Array<{index: number, flagStart: number}> = [];
      let flagStart = -1;
      
      // 문자열을 순회하면서 중괄호 매칭
      for (let i = 0; i < processed.length; i++) {
        const char = processed[i];
        
        if (char === '{') {
          // 여는 중괄호 발견: 플래그 시작점 찾기
          if (stack.length === 0) {
            // 최상위 중괄호인 경우, 앞쪽에서 플래그 문자들 찾기
            flagStart = i;
            // 역순으로 e,r,v 문자들을 찾아서 플래그 시작점 결정
            // 예: "PROC=!@r{NAME}" → r{ 부분에서 r이 플래그
            for (let j = i - 1; j >= 0; j--) {
              if (!['e', 'r', 'v'].includes(processed[j])) {
                flagStart = j + 1; // 플래그가 아닌 문자 다음부터가 플래그 시작
                break;
              }
              if (j === 0) {
                flagStart = 0; // 문자열 시작까지 모두 플래그
                break;
              }
            }
          }
          stack.push({index: i, flagStart});
        } else if (char === '}' && stack.length > 0) {
          // 닫는 중괄호 발견: 매칭되는 여는 중괄호와 짝 맞추기
          const openBrace = stack.pop()!;
          
          // 스택이 비었다면 가장 안쪽 완성된 중괄호 쌍을 찾은 것
          // 이 부분을 먼저 처리해야 함 (안쪽부터 바깥쪽으로)
          if (stack.length === 0) {
            // 치환 대상 문자열 추출
            const fullStart = openBrace.flagStart;  // 플래그 포함 시작점
            const fullEnd = i + 1;                  // 닫는 중괄호 포함 끝점
            const fullMatch = processed.substring(fullStart, fullEnd);  // 전체 매칭 부분
            const flagString = processed.substring(fullStart, openBrace.index);  // 플래그 부분
            const extractedValue = processed.substring(openBrace.index + 1, i);  // 중괄호 안 값
            
            const flags = parseFlags(flagString);
            const type = determineParameterType(extractedValue, flags);
            
            console.log(`[DEBUG] Found bracket: "${fullMatch}"`);
            console.log(`[DEBUG] - flagString: "${flagString}"`);
            console.log(`[DEBUG] - extractedValue: "${extractedValue}"`);
            console.log(`[DEBUG] - flags:`, flags);
            console.log(`[DEBUG] - type:`, type);
            
            let convertedValue: string | null = null;
            let encryptedValue: string | null = null;
            
            // 1단계: 타입 변환 (A/B 타입인 경우만)
            // 리터럴 플래그(v)가 없고, 변환 함수가 있고, A 또는 B 타입인 경우
            if (!flags.literal && typeConverter && (type === ParameterType.A || type === ParameterType.B)) {
              try {
                convertedValue = await typeConverter(extractedValue, type);
                console.log(`[DEBUG] - converted: "${convertedValue}"`);
              } catch (error) {
                console.error('Type conversion failed in substitution:', error);
              }
            }
            
            // 2단계: 암호화 (e 플래그가 있는 경우)
            if (flags.encrypted && encryptor) {
              // 암호화할 값 결정: 변환된 값 > 리터럴 값 > null 순서
              const valueToEncrypt = convertedValue || (flags.literal ? extractedValue : null);
              if (valueToEncrypt) {
                try {
                  encryptedValue = await encryptor(valueToEncrypt);
                } catch (error) {
                  console.error('Encryption failed in substitution:', error);
                }
              }
            }
            
            // 3단계: 최종 값 결정 (우선순위 적용)
            // 치환 모드에서의 값 우선순위:
            // 1. 암호화된 값 (최우선) - e 플래그가 있으면
            // 2. 변환된 값 - A/B 타입 변환 결과
            // 3. 리터럴 값 - v 플래그가 있으면 원본 값 그대로
            // 4. 빈 값 - 아무것도 없으면 빈 문자열로 치환
            let finalValue: string;
            if (encryptedValue) {
              finalValue = encryptedValue; // 1. 암호화된 값 (최우선)
            } else if (convertedValue) {
              finalValue = convertedValue; // 2. 변환된 값
            } else if (flags.literal) {
              finalValue = extractedValue; // 3. 리터럴 값
            } else {
              finalValue = ''; // 4. 빈 값
            }
            
            // 4단계: 내부 변환 추적 (onInnerTrace 콜백 호출)
            if (onInnerTrace) {
              // 변환 성공 여부 판단
              const hasConversion = convertedValue !== null && convertedValue !== extractedValue;
              const hasEncryption = encryptedValue !== null;
              const isChanged = extractedValue !== finalValue;
              
              // 실패 이유 결정
              let failureReason: string | undefined;
              if (!hasConversion && type !== ParameterType.LITERAL && !flags.literal) {
                if (type === ParameterType.UNKNOWN) {
                  failureReason = `알 수 없는 타입: "${extractedValue}"가 A/B 타입 목록에 없음`;
                } else if (!typeConverter) {
                  failureReason = 'TypeConverter 함수가 제공되지 않음';
                }
              }
              if (flags.encrypted && !encryptedValue && !encryptor) {
                failureReason = 'Encryptor 함수가 제공되지 않음';
              }
              
              onInnerTrace({
                type,
                target: extractedValue,
                convertedValue,
                encryptedValue,
                result: finalValue,
                flags,
                transformationSuccess: isChanged || hasConversion || hasEncryption || flags.literal,
                failureReason
              });
            }
            
            // 5단계: 문자열에서 실제 치환 수행
            console.log(`[DEBUG] Before replacement: "${processed}"`);
            console.log(`[DEBUG] Replacing "${fullMatch}" with "${finalValue}"`);
            processed = processed.substring(0, fullStart) + finalValue + processed.substring(fullEnd);
            console.log(`[DEBUG] After replacement: "${processed}"`);
            
            // 변화가 있었으므로 다시 처리 (바깥쪽 중괄호가 있을 수 있음)
            hasChanges = true;
            break; // 하나씩 처리하고 다시 시작
          }
        }
      }
    }
    
    return processed;
  };
  
  return await processNestedBrackets(result);
};

/**
 * 파라미터 모드 vs 치환 모드를 감지하는 핵심 함수
 * 
 * 이 함수가 가장 중요한 이유:
 * - 전체 파싱 로직의 분기점 역할
 * - 잘못 판단하면 완전히 다른 결과가 나옴
 * 
 * 파라미터 모드 (값 사용):
 * - 형태: key=evr{VALUE} 또는 key={VALUE}
 * - 특징: 중괄호가 바로 시작하고, 안에 다른 중괄호가 없음
 * - 처리: 중괄호 안의 값을 추출해서 API 변환 후 사용
 * - 예시: name={A_TYPE_1}, where=e{B_TYPE_2}
 * 
 * 치환 모드 (문자열 치환):
 * - 형태: key=복잡한구조{VALUE}더복잡한구조 
 * - 특징: 중괄호와 다른 문자들이 섞여 있음
 * - 처리: 문자열 내부의 중괄호 패턴들을 찾아서 개별 치환
 * - 예시: where=PROC=!@r{NAME}, url=/v{TEXT}.com
 * 
 * 로직 설명:
 * 1. 정규식으로 파라미터 형태인지 먼저 확인
 * 2. 파라미터 형태라면 내부에 중첩 중괄호가 있는지 추가 확인
 * 3. 중첩이 없으면 파라미터 모드, 있거나 패턴이 안 맞으면 치환 모드
 * 
 * @param value 검사할 값
 * @returns ProcessingMode.PARAMETER 또는 ProcessingMode.SUBSTITUTION
 */
export const detectProcessingMode = (value: string): ProcessingMode => {
  // 1단계: 파라미터 형태 체크 - [플래그]{내용} 패턴인가?
  // 정규식: ^[erv]*\{[^{}]+\}$ 
  // - ^[erv]*: 시작부터 e,r,v 문자들 (옵션)
  // - \{[^{}]+\}: 중괄호 안에 중괄호가 아닌 문자들
  // - $: 문자열 끝
  if (/^[erv]*\{[^{}]+\}$/.test(value)) {
    const match = value.match(/^[erv]*\{(.+)\}$/);
    if (match) {
      const content = match[1];
      // 내용 안에 중괄호 패턴이 없으면 진짜 파라미터 모드
      if (!/\{.*\}/.test(content)) {
        console.log(`[DEBUG] Parameter mode detected: ${value} (direct brack
    // 2단계: 혹시 중괄호 안에 또 다른 중괄호가 숨어있나 재확인et form)`);
        return ProcessingMode.PARAMETER;
      }
    }
  }
  
  // 파라미터 패턴이 아니라면 치환 모드
  // 예: "PROC=!@r{NAME}", "v{TEXT}.com", "복잡한구조{값}더복잡"
  console.log(`[DEBUG] Substitution mode detected: ${value} (mixed structure)`);
  return ProcessingMode.SUBSTITUTION;
};