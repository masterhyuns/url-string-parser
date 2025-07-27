# URL Parser Architecture Diagrams

이 폴더에는 URL Parser의 전체 아키텍처와 핵심 로직을 시각화한 PlantUML 다이어그램들이 있습니다.

## 다이어그램 목록

### 1. 🏗️ Architecture Overview (`architecture-overview.puml`)
전체 시스템의 구조와 컴포넌트 간 관계를 보여주는 패키지 다이어그램

**주요 내용:**
- Entry Points, Parsers, Core Utils, Transform Services 간의 관계
- 데이터 흐름과 의존성
- 핵심 분기점과 특별한 처리 로직 표시

### 2. 🔄 Processing Flow (`processing-flow.puml`)
URL 파싱부터 최종 변환까지의 전체 처리 흐름

**주요 내용:**
- URL 컴포넌트 분리 → 파싱 → 변환 → 재구성 과정
- 병렬 처리 (URL 세그먼트 vs 쿼리스트링)
- 모드별 분기 처리 흐름

### 3. 🎯 Mode Detection (`mode-detection.puml`)
파라미터 모드와 치환 모드를 구분하는 핵심 로직

**주요 내용:**
- `detectProcessingMode` 함수의 상세 판단 과정
- 정규식 기반 1차 검사 → 중첩 구조 2차 검사
- 각 모드의 특징과 예시

### 4. 🏗️ Substitution Algorithm (`substitution-algorithm.puml`)
스택 기반 중괄호 파싱 알고리즘의 상세 과정

**주요 내용:**
- 중첩된 중괄호 매칭 과정
- 플래그 역추적 로직
- 안쪽부터 바깥쪽으로 순차 치환

### 5. 🌐 Global Query Processing (`global-query-processing.puml`)
전역 쿼리의 2단계 변환 과정을 상세히 보여주는 시퀀스 다이어그램

**주요 내용:**
- 내부 쿼리 개별 변환 → 재구성 → 전체 암호화
- API 호출 순서와 데이터 변환 과정
- 최종 URL 재구성 과정

### 6. ⚖️ Value Priority (`value-priority.puml`)
최종값 결정 시 적용되는 우선순위 체계

**주요 내용:**
- 암호화 > 변환 > 리터럴 > 원본 우선순위
- 각 단계별 조건 검사
- 모드별 차이점

### 7. 🧪 Test Cases (`test-cases.puml`)
주요 테스트 케이스와 예시를 보여주는 클래스 다이어그램

**주요 내용:**
- 파라미터 모드 vs 치환 모드 비교
- 복합 플래그 처리 예시
- 실제 URL 변환 과정

## 다이어그램 보는 방법

### PlantUML 렌더링
1. **VS Code**: PlantUML 확장 설치 후 `Alt+D`로 미리보기
2. **온라인**: [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/)에 코드 복사
3. **CLI**: `plantuml *.puml` 명령으로 PNG/SVG 생성

### 권장 순서
1. `architecture-overview.puml` - 전체 구조 파악
2. `processing-flow.puml` - 처리 흐름 이해
3. `mode-detection.puml` - 핵심 분기 로직 이해
4. `substitution-algorithm.puml` - 복잡한 파싱 알고리즘 이해
5. `global-query-processing.puml` - 전역 처리 이해
6. `value-priority.puml` - 우선순위 체계 이해
7. `test-cases.puml` - 실제 예시로 전체 확인

## 핵심 설계 원칙

각 다이어그램에서 공통적으로 강조되는 설계 원칙:

1. **명확한 모드 구분**: 파라미터 vs 치환 모드의 명확한 분리
2. **스택 기반 파싱**: 정규식으로 불가능한 중첩 구조 처리
3. **우선순위 체계**: 암호화 > 변환 > 리터럴 > 원본
4. **2단계 전역 처리**: 보안과 무결성을 위한 이중 변환
5. **관심사 분리**: 파싱 → 변환 → 재구성의 명확한 단계 분리