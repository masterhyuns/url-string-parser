# URL & QueryString Parser - 완성 버전 문서

## 📋 프로젝트 개요

QueryString 파싱을 통해 새로운 Query String을 생성하는 React 모듈 개발
- ✅ **완전 구현 완료** (2024년 12월 기준)
- ✅ **상세 주석 및 문서화 완료**
- ✅ **변환 추적 시스템 포함**
- ✅ **SUBSTITUTION 모드 내부 추적 완료**

### 🎯 핵심 요구사항 (완성됨)

1. **타입 변환 목록** ✅
    - `A타입 = ['A_TYPE_1','A_TYPE_2','A_TYPE_3','A_TYPE_4','PROC','NAME']` : type A 변환목록
    - `B타입 = ['B_TYPE_1','B_TYPE_2','B_TYPE_3','B_TYPE_4']` : type B 변환목록

2. **플래그 처리 규칙** ✅
    - `name=e{HONG}` : HONG이 어떤 타입인지 찾고, 암호화 대상 플래그 설정
    - `name=r{HONG}` : 타입 찾고 암호화 대상 false, 필수 대상 true
    - `name=v{HONG}` : 타입은 LITERAL, 암호화 false, 필수 false, 리터럴 대상 true
    - `{}` 앞에 e,r,v는 순서 상관없이 다양하게 조합 가능 (예: `er{VALUE}`, `ve{VALUE}`)

3. **전역 플래그 처리** ✅
    - `?er{name={HONG}}` : 전체 암호화 flag를 true, 전체 필수 true로 관리
    - 전역 플래그 적용 시 내부 `{}` 내용들도 암호화, 필수값으로 변경

4. **🆕 변환 추적 시스템** ✅
    - 모든 변환 과정 상세 기록 (`transformationTraces`)
    - 암호화 전/후 값 추적 (`convertedValue`, `encryptedValue`)
    - 실패 케이스 원인 분석 (`transformationSuccess`, `failureReason`)
    - SUBSTITUTION 모드 내부 개별 변환 추적 (내부 콜백 시스템)

## 🔧 기술적 요구사항 (완성됨)

### 개발 환경 ✅
- **언어**: TypeScript
- **프레임워크**: React (Hook 기반)
- **아키텍처**: Clean Architecture + 관심사 분리
- **컴포넌트 선언**: `export const`로 개발 
- **타입 관리**: 별도 types 파일로 분리

### 핵심 구현 완료 사항 ✅

1. **파라미터 vs 치환 모드 구분**
    - **파라미터 모드**: `key=evr{VALUE}` 형태 - 직접 값 사용
    - **치환 모드**: `key=복잡한구조r{VALUE}` 형태 - 문자열 내부 치환
    - **핵심 함수**: `detectProcessingMode()` - 정규식 기반 모드 감지

2. **URL 처리** ✅
    - 커스텀 로컬 프로토콜 지원 (`custom://app`, `myapp://service`)
    - `URL()` 생성자 대신 정규식 기반 파싱 (커스텀 프로토콜 지원)
    - URL 세그먼트 치환 모드 지원 (`/v{TEXT}.com` → `/TEXT.com`)

3. **중첩 구조 지원** ✅
    - `?name=e{REQUEST}&where=e{PROC=!@r{NAME}}` 형태 완벽 처리
    - **스택 기반 파싱** 구현 (정규식으로 불가능한 중첩 중괄호 매칭)
    - 안쪽부터 바깥쪽으로 순차 처리

4. **API 연동** ✅
    - **A, B 타입**: 해당 `extractedValue`로 변환 API 호출
    - **암호화**: `e` 플래그 시 암호화 API 호출
    - **단계별 값 관리**: 원본 → 변환 → 암호화 → 최종

5. **상태 관리** ✅
    - 파싱 결과를 `url: [parse객체], query: [parse객체]` 배열 형태로 저장
    - `baseUrl`, `reconstructedPath` 정보 포함
    - **🆕 transformationTraces**: 모든 변환 과정 추적

## 📂 파일 구조 (완성됨)

```
src/
├── index.ts                     # 메인 진입점
├── types/
│   └── parser.types.ts          # 타입 정의 (TransformationTrace 포함)
├── utils/
│   └── parser.utils.ts          # 유틸리티 함수들 (상세 주석 완료)
├── parsers/
│   ├── urlParser.ts             # URL 파싱 로직 (치환 모드 지원)
│   └── queryParser.ts           # QueryString 파싱 로직 (전역/개별 구분)
├── services/
│   └── transformService.ts      # API 변환 서비스 (내부 추적 포함)
├── hooks/
│   └── useParseState.ts         # 상태 관리 Hook (추적 시스템 포함)
├── test-specific-url.ts         # 테스트 파일 (상세 출력)
└── docs/                        # PlantUML 다이어그램
    ├── architecture-overview.puml
    ├── processing-flow.puml
    ├── mode-detection.puml
    ├── substitution-algorithm.puml
    ├── global-query-processing.puml
    ├── value-priority.puml
    ├── test-cases.puml
    └── transformation-tracking.puml
```

## 🎨 데이터 구조 (완성됨)

### ParsedParameter 인터페이스 ✅
```typescript
interface ParsedParameter {
  originalValue: string;           // 입력된 원본 값
  flags: ParameterFlags;           // 파싱된 플래그들
  type: ParameterType;             // 감지된 타입
  extractedValue: string | null;   // {} 안의 실제 값
  convertedValue: string | null;   // 타입 변환 API 결과
  encryptedValue: string | null;   // 암호화 API 결과
  finalValue: string;              // 최종 사용할 값 (우선순위 적용)
  processingMode?: ProcessingMode; // 처리 모드 (PARAMETER/SUBSTITUTION)
}
```

### 🆕 TransformationTrace 인터페이스 ✅
```typescript
interface TransformationTrace {
  type: ParameterType;             // 원본 타입
  target: string;                  // 변환 대상 원본 값
  convertedValue: string | null;   // 타입 변환된 값 (암호화 전)
  encryptedValue: string | null;   // 암호화된 값
  result: string;                  // 최종 변환된 결과 값
  location: 'url' | 'query';       // 위치
  identifier: string;              // 식별자 (where, segment-0, where.inner.B_TYPE_1 등)
  flags: ParameterFlags;           // 적용된 플래그들
  processingMode: ProcessingMode;  // 처리 모드
  transformationSuccess: boolean;  // 변환 성공 여부
  failureReason?: string;          // 변환 실패 이유
}
```

### 최종 값 우선순위 ✅
1. **암호화된 값** (최우선) - `e` 플래그 존재 시
2. **타입 변환된 값** - A/B 타입 변환 결과
3. **리터럴 값** - `v` 플래그 존재 시 원본 그대로
4. **원본 값** (최후순위) - 파라미터 모드의 경우
5. **빈 값** - 치환 모드에서 변환 실패 시

## 🔍 테스트 케이스 (완성됨)

### 기본 케이스 ✅
- `custom://app/r{}?name=r{}`
- `http://test.com/e{A_TYPE_1}?name=r{B_TYPE_2}`

### 중첩 구조 ✅
- `myapp://service/e{PROC=!@r{NAME}}?where=v{LITERAL}`
- `https://api.com/er{DATA=v{VALUE}@r{KEY}}?status=er{A_TYPE_1}`

### 복합 케이스 ✅
- `http://test.com/path?er{name=e{PROC=!@r{NAME}}&type=A_TYPE_1}`
- `/local/path/r{A_TYPE_1}?test=e{B_TYPE_2}`

### 🆕 SUBSTITUTION 케이스 ✅
- `http://localhost/v{TEXT}.com?name={A_TYPE_1}` → `http://localhost/TEXT.com?name=A_TYPE_1_VALUE`
- `?where=PROC=!@r{B_TYPE_1}AND!@r{B_TYPE_2}` → 내부 개별 추적 + 전체 치환

## 🚀 사용법 (완성됨)

### 기본 사용 ✅
```typescript
const { parseResult, updateParseResult } = useParseState();
await updateParseResult('custom://app/r{A_TYPE_1}?name=e{PROC=!@r{NAME}}');

console.log(parseResult.url);               // URL 세그먼트 배열
console.log(parseResult.query);             // Query 파라미터 배열
console.log(parseResult.transformationTraces); // 🆕 변환 추적 정보
```

### 🆕 변환 추적 활용 ✅
```typescript
const { parseResult } = useParseState(typeConverter, encryptor);
await updateParseResult('test.com?where=PROC=!@r{B_TYPE_1}AND{B_TYPE_2}', true);

// 모든 변환 확인
parseResult.transformationTraces.forEach(trace => {
  console.log(`${trace.target} → ${trace.result} (${trace.transformationSuccess ? '성공' : '실패'})`);
  if (trace.failureReason) {
    console.log(`실패 이유: ${trace.failureReason}`);
  }
});

// SUBSTITUTION 내부 변환만 확인
const innerTraces = parseResult.transformationTraces
  .filter(trace => trace.identifier.includes('.inner.'));
console.log('내부 치환들:', innerTraces);
```

### API 변환과 함께 사용 ✅
```typescript
const typeConverter = async (value: string, type: ParameterType) => {
  const response = await fetch('/api/convert', {
    method: 'POST',
    body: JSON.stringify({ value, type })
  });
  return response.text();
};

const encryptor = async (value: string) => {
  const response = await fetch('/api/encrypt', {
    method: 'POST',
    body: JSON.stringify({ value })
  });
  return response.text();
};

const { parseResult, updateParseResult } = useParseState(typeConverter, encryptor);
await updateParseResult('http://test.com/e{A_TYPE_1}?name=r{B_TYPE_2}', true);
```

## 🔧 핵심 구현 포인트 (완성됨)

1. **✅ 모드 감지 알고리즘**: `detectProcessingMode()` - 파라미터 vs 치환 구분
2. **✅ 스택 기반 파싱**: `processSubstitution()` - 중첩 중괄호 매칭
3. **✅ 커스텀 프로토콜**: `parseUrlComponents()` - 정규식 기반 URL 분리
4. **✅ 중첩 구조**: 재귀적 파싱으로 깊은 중첩 처리
5. **✅ API 변환 지원**: 타입 변환과 암호화를 위한 외부 함수 주입
6. **✅ 상태 관리**: React Hook으로 파싱 결과 상태 관리
7. **✅ 변환 추적**: 모든 변환 과정 투명 기록 시스템

## ⚙️ 구현 원칙 (완성됨)

### 코드 품질 ✅
- **단순성**: 복잡한 솔루션보다 가장 단순한 솔루션 우선
- **중복 방지**: DRY 원칙 준수
- **효율성**: 토큰 사용 최소화

### 아키텍처 ✅
- **SOLID 원칙** 사용
- **Clean Architecture** 준수
- **관심사 분리**: 각 파일이 단일 책임만 담당

### 주석 작성 ✅ (완료됨)
- **무엇이 아닌 왜**: '무엇을' 하는지가 아닌 '왜' 그렇게 하는지 설명
- **구현 이유**: 왜 그런 방식으로 구현했는지 명시
- **복잡한 로직**: 알고리즘이나 비즈니스 규칙은 단계별 주석

## 📝 개발 완료 사항 (전체 완성)

- ✅ TypeScript로 완전 구현
- ✅ 중첩 구조 지원 (스택 기반 파싱)
- ✅ 커스텀 프로토콜 지원
- ✅ API 변환 구조 구축
- ✅ Clean Architecture 적용
- ✅ 파일 분리 및 관심사 분리
- ✅ 상세한 주석 및 문서화 (모든 함수에 완료)
- ✅ 사용 예제 제공
- ✅ **변환 추적 시스템 완성**
- ✅ **SUBSTITUTION 내부 추적 완성**
- ✅ **PlantUML 다이어그램 완성** (8개 다이어그램)
- ✅ **실패 케이스 추적 완성**

## 🔍 변환 추적 시스템 상세 (신규 완성)

### 추적되는 모든 시나리오

#### ✅ 성공 케이스
- **완전 변환**: `e{A_TYPE_1}` → 타입 변환 → 암호화
- **부분 변환**: `{A_TYPE_1}` → 타입 변환만
- **리터럴**: `v{TEXT}` → 변환 없이 그대로
- **SUBSTITUTION**: `PROC=!@r{B_TYPE_1}` → 내부 치환

#### ✅ 실패 케이스
- **알 수 없는 타입**: `{UNKNOWN_VALUE}` → A/B 목록에 없음
- **변환기 없음**: `{A_TYPE_1}` → TypeConverter 미제공
- **암호화기 없음**: `e{A_TYPE_1}` → Encryptor 미제공

### 추적 정보 식별자 체계
- **URL**: `segment-0`, `segment-1` 등
- **쿼리**: `name`, `where` 등 키 이름
- **전역 내부**: `__GLOBAL__.name` 형태
- **🆕 SUBSTITUTION 내부**: `where.inner.B_TYPE_1` 형태

## 📊 테스트 데이터 (완성됨)

### mockData ✅
```typescript
// type A
const A_TYPES = {
  'A_TYPE_1': 'A_TYPE_1_VALUE',
  'A_TYPE_2': 'A_TYPE_2_VALUE', 
  'A_TYPE_3': 'A_TYPE_3_VALUE',
  'A_TYPE_4': 'A_TYPE_4_VALUE',
  'PROC': 'PROC_VALUE',
  'NAME': 'NAME_VALUE',
  'TEXT': 'TEXT'
}

// type B  
const B_TYPES = {
  'B_TYPE_1': 'B_TYPE_1_VALUE',
  'B_TYPE_2': 'B_TYPE_2_VALUE',
  'B_TYPE_3': 'B_TYPE_3_VALUE', 
  'B_TYPE_4': 'B_TYPE_4_VALUE'
}
```

### 완성된 예시들 ✅

#### 예시 1) 기본 케이스
- **요청**: `http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE_3}`
- **결과**: `http://localhost/ENC[A_TYPE_1_VALUE]?name=A_TYPE_2_VALUE&name2=ENC[B_TYPE_2_VALUE]&name3=A_TYPE_3`

#### 예시 2) 중첩 구조  
- **요청**: `http://localhost.com?name={A_TYPE_2}&where=PROC=!@r{A_TYPE_1}AND!@er{A_TYPE_2}`
- **결과**: `http://localhost.com?name=A_TYPE_2_VALUE&where=PROC=!@A_TYPE_1_VALUEAND!@ENC[A_TYPE_2_VALUE]`

#### 🆕 예시 3) SUBSTITUTION 내부 추적
- **요청**: `?where=PROC=!@r{B_TYPE_1}AND!@r{B_TYPE_2}`
- **내부 추적 1**: `B_TYPE_1` → `B_TYPE_1_VALUE` (위치: `where.inner.B_TYPE_1`)
- **내부 추적 2**: `B_TYPE_2` → `B_TYPE_2_VALUE` (위치: `where.inner.B_TYPE_2`) 
- **전체 결과**: `PROC=!@B_TYPE_1_VALUEAND!@B_TYPE_2_VALUE`

## 🎯 다음 개발 시 참고사항

### 기존 구조 유지 필수
1. **파라미터 vs 치환 모드 구분 로직** 건드리지 말 것
2. **스택 기반 파싱 알고리즘** 검증된 구조 유지
3. **변환 추적 시스템** 기존 인터페이스 유지

### 확장 가능한 부분
1. **새로운 플래그 추가** - parseFlags 함수에서 처리
2. **새로운 타입 추가** - ATYPE_VALUES, BTYPE_VALUES에 추가
3. **추가 추적 정보** - TransformationTrace 인터페이스 확장

### 주의사항
- 기능 변경 시 반드시 테스트 케이스로 검증
- 변환 추적 시스템 동작 확인 필수
- PlantUML 다이어그램도 함께 업데이트

---

**🎉 프로젝트 완성 상태: 100% 완료**
- 모든 요구사항 구현 완료
- 상세 주석 및 문서화 완료  
- 변환 추적 시스템 완성
- 아키텍처 다이어그램 완성