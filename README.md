# URL & QueryString Parser

React용 고성능 URL 파싱 및 변환 라이브러리입니다. 복잡한 중괄호 패턴을 지원하며, 타입 변환과 암호화를 통한 동적 URL 생성이 가능합니다.

## ✨ 주요 기능

### 🔍 패턴 지원
- **파라미터 모드**: `name={A_TYPE_1}`, `value=e{B_TYPE_2}`, `text=v{LITERAL}`
- **치환 모드**: `where=PROC=!@r{NAME}`, `/v{TEXT}.com`
- **전역 쿼리**: `?e{name={A_TYPE_1}&value=test}` (전체 암호화)
- **중첩 구조**: `where=e{PROC=!@r{NAME}}`

### 🏷️ 플래그 시스템
- **`e`**: 암호화 대상 (encrypted)
- **`r`**: 필수값 (required)  
- **`v`**: 리터럴 값 (literal, 타입 변환 없이 그대로 사용)
- **조합 가능**: `er{VALUE}`, `ve{VALUE}` 등

### 🎯 필터링 모드
- **DEFAULT**: 모든 변환 가능한 값 포함 (기본값)
- **STRICT**: 일반 문자열과 `v{}` 리터럴만 포함, 변환 필요한 값은 제외

### 🔐 보안 기능
- 커스텀 암호화 함수 지원
- 선택적 타입 변환 API 연동
- 변환 실패 시 안전한 처리

## 🚀 빠른 시작

### 설치

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 데모를 확인하세요.

### 기본 사용법

```typescript
import { useParseState } from './src/hooks/useParseState';
import { ParameterType, FilteringMode } from './src/types/parser.types';

// 타입 변환 함수 정의
const typeConverter = async (value: string, type: ParameterType): Promise<string> => {
  if (type === ParameterType.A) {
    return `${value}_CONVERTED`;
  }
  return value;
};

// 암호화 함수 정의
const encryptor = async (value: string): Promise<string> => {
  return `ENC[${value}]`;
};

// Hook 사용
function App() {
  const { parseResult, updateParseResult, getReconstructedUrl } = useParseState(
    typeConverter,
    encryptor,
    FilteringMode.DEFAULT
  );

  const handleParse = async () => {
    await updateParseResult(
      'http://localhost/{A_TYPE_1}?name=e{A_TYPE_2}&value=v{LITERAL}',
      true // 변환 적용
    );
  };

  return (
    <div>
      <button onClick={handleParse}>파싱하기</button>
      <p>결과: {getReconstructedUrl()}</p>
    </div>
  );
}
```

## 📋 사용 예제

### 1. 기본 파라미터 변환
```typescript
// 입력
'http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&value=v{LITERAL}'

// 결과 (DEFAULT 모드)
'http://localhost/ENC[A_TYPE_1_VALUE]?name=A_TYPE_2_VALUE&value=LITERAL'

// 결과 (STRICT 모드)
'http://localhost/A_TYPE_1_VALUE?value=LITERAL'
```

### 2. 치환 모드
```typescript
// 입력
'http://api.com?where=PROC=!@r{A_TYPE_1}AND!@v{LITERAL}'

// 결과
'http://api.com?where=PROC=!@A_TYPE_1_VALUEAND!@LITERAL'
```

### 3. 전역 쿼리 암호화
```typescript
// 입력
'http://localhost?e{name={A_TYPE_1}&value=v{TEST}}'

// 결과 (DEFAULT 모드)
'http://localhost?ENC[name=A_TYPE_1_VALUE&value=TEST]'

// 결과 (STRICT 모드)
'http://localhost?ENC[value=TEST]'  // name={A_TYPE_1} 제외됨
```

### 4. 커스텀 프로토콜 지원
```typescript
// 입력
'custom://app/r{A_TYPE_1}?data=e{B_TYPE_2}'

// 결과
'custom://app/A_TYPE_1_VALUE?data=ENC[B_TYPE_2_VALUE]'
```

## 🏗️ 아키텍처

### 핵심 컴포넌트

```
src/
├── hooks/
│   └── useParseState.ts          # 메인 React Hook
├── parsers/
│   ├── urlParser.ts              # URL 세그먼트 파싱
│   └── queryParser.ts            # 쿼리스트링 파싱
├── services/
│   └── transformService.ts       # 타입 변환 및 암호화
├── utils/
│   └── parser.utils.ts           # 유틸리티 함수들
├── types/
│   └── parser.types.ts           # TypeScript 타입 정의
├── constants/
│   ├── mockData.ts               # 테스트용 Mock 데이터
│   └── typeValues.ts             # A/B 타입 값 상수
└── components/
    └── UrlParserDemo.tsx         # 데모 컴포넌트
```

### 처리 흐름

1. **파싱 단계**: URL을 구성요소별로 분해하고 패턴 분석
2. **변환 단계**: 타입 변환 API 호출 및 암호화 적용
3. **필터링 단계**: 모드에 따른 결과 필터링
4. **재구성 단계**: 최종 URL 문자열 생성

## 🔧 고급 기능

### 변환 추적 시스템

모든 변환 과정이 `transformationTraces`에 기록됩니다:

```typescript
const { parseResult } = useParseState();

// 변환 추적 정보 확인
parseResult.transformationTraces.forEach(trace => {
  console.log(`${trace.target} → ${trace.result}`);
  console.log(`성공: ${trace.transformationSuccess}`);
  if (trace.failureReason) {
    console.log(`실패 이유: ${trace.failureReason}`);
  }
});
```

### 커스텀 프로토콜

일반적인 HTTP/HTTPS 외에도 커스텀 프로토콜을 지원합니다:

```typescript
// 지원되는 프로토콜 예시
'myapp://service/path'
'custom://internal/api'
'app://localhost/resource'
```

### STRICT 모드 세부 규칙

STRICT 모드에서는 다음 규칙이 적용됩니다:

- ✅ **허용**: 일반 문자열, `v{LITERAL}` 패턴
- ❌ **제외**: `{A_TYPE_1}`, `e{VALUE}`, `r{VALUE}` 등 변환 필요한 패턴
- ❌ **SUBSTITUTION 내부 제외**: `{@@{A_TYPE_1}}` → 전체 파라미터 제외
- ✅ **SUBSTITUTION 허용**: `{@@v{LITERAL}}` → 리터럴만 있으면 포함

## 🧪 테스트

### 데모 실행

```bash
npm run dev
```

웹 인터페이스에서 다양한 URL 패턴을 테스트할 수 있습니다.

### 예제 테스트 케이스

데모에서 제공하는 테스트 버튼들:

- **기본 예제**: 표준 파라미터 변환
- **커스텀 프로토콜**: 비표준 프로토콜 처리
- **중첩 구조**: 복잡한 중괄호 중첩
- **전역 플래그**: 전체 암호화 처리
- **필터링 테스트**: STRICT vs DEFAULT 모드 비교

## 📚 API 참조

### useParseState Hook

```typescript
const {
  parseResult,           // 파싱 결과 상태
  updateParseResult,     // URL 파싱 및 변환 실행
  getReconstructedUrl,   // 재구성된 URL 반환
  encryptGlobalQueries   // 전역 쿼리 암호화
} = useParseState(typeConverter?, encryptor?, filteringMode?);
```

### 주요 타입

```typescript
interface ParseResult {
  baseUrl: string;                    // 기본 URL (프로토콜 + 호스트)
  reconstructedPath: string;          // 재구성된 경로
  url: ParsedSegment[];              // URL 세그먼트 배열
  query: ParsedQuery[];              // 쿼리 파라미터 배열
  transformationTraces: TransformationTrace[]; // 변환 추적 정보
}

enum FilteringMode {
  DEFAULT = 'DEFAULT',    // 모든 값 포함
  STRICT = 'STRICT'       // 리터럴과 일반 문자열만
}

enum ParameterType {
  A = 'A',               // A 타입 (사용자 정의 변환)
  B = 'B',               // B 타입 (사용자 정의 변환)
  LITERAL = 'LITERAL',   // 리터럴 (변환 없음)
  UNKNOWN = 'UNKNOWN',   // 알 수 없는 타입
  GLOBAL = 'GLOBAL'      // 전역 쿼리
}
```

## 🤝 기여하기

1. Fork 프로젝트
2. Feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🔗 관련 링크

- [PlantUML 다이어그램](./docs/) - 아키텍처 시각화
- [CLAUDE.md](./CLAUDE.md) - 개발 가이드라인