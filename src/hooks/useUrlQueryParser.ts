import { useParseState } from './useParseState';
import { TypeConverter, Encryptor } from '../types/parser.types';

/**
 * URL과 QueryString을 파싱하고 변환하는 메인 Hook
 * 
 * 이것이 래퍼 Hook인 이유:
 * - useParseState는 내부 구현체로, 직접 노출하지 않고 이 Hook을 통해 접근
 * - 향후 API 변경 시 이 파일만 수정하면 되므로 하위 호환성 유지
 * - 사용자에게는 더 직관적인 이름(useUrlQueryParser)으로 제공
 * - 필요 시 이 레이어에서 추가적인 로직이나 검증을 넣을 수 있음
 * 
 * 이 Hook의 핵심 기능:
 * 1. **URL 분해**: protocol://host/path?query 형태를 각 구성요소로 분리
 * 2. **패턴 파싱**: {}, e{}, r{}, v{} 같은 중괄호 패턴들을 감지하고 분석
 * 3. **모드 감지**: 파라미터 모드 vs 치환 모드 자동 판별
 * 4. **타입 변환**: A/B 타입을 실제 값으로 변환 (외부 API 호출)
 * 5. **암호화**: e 플래그가 있는 값들을 암호화 (외부 암호화 함수 호출)
 * 6. **URL 재구성**: 변환된 값들로 새로운 URL 생성
 * 7. **변환 추적**: 모든 변환 과정을 상세히 기록하여 디버깅 지원
 * 
 * 지원하는 패턴들:
 * - **파라미터 모드**: name={A_TYPE_1}, where=e{B_TYPE_2}, value=v{LITERAL}
 * - **치환 모드**: where=PROC=!@r{NAME}, /v{TEXT}.com
 * - **전역 쿼리**: ?er{name={A_TYPE_1}&value=test}
 * - **중첩 구조**: where=e{PROC=!@r{NAME}}
 * 
 * 플래그 시스템:
 * - **e**: 암호화 대상 (encrypted)
 * - **r**: 필수값 (required)
 * - **v**: 리터럴 값 (literal, 타입 변환 없이 그대로 사용)
 * - **조합 가능**: er{}, ve{}, rev{} 등 순서 무관하게 조합
 * 
 * 사용 패턴:
 * ```typescript
 * // 기본 사용 (파싱만)
 * const { parseResult, updateParseResult } = useUrlQueryParser();
 * await updateParseResult('http://test.com/e{A_TYPE_1}?name=r{B_TYPE_2}');
 * 
 * // 변환 함수와 함께 사용 (실제 변환 수행)
 * const { parseResult, updateParseResult } = useUrlQueryParser(
 *   async (value, type) => {
 *     // A/B 타입을 실제 값으로 변환하는 API 호출
 *     const response = await fetch('/api/convert', {
 *       method: 'POST',
 *       body: JSON.stringify({ value, type })
 *     });
 *     return response.text();
 *   },
 *   async (value) => {
 *     // 값을 암호화하는 API 호출
 *     const response = await fetch('/api/encrypt', {
 *       method: 'POST', 
 *       body: JSON.stringify({ value })
 *     });
 *     return response.text();
 *   }
 * );
 * 
 * // 실제 변환 적용
 * await updateParseResult('http://test.com/e{A_TYPE_1}?name=r{B_TYPE_2}', true);
 * 
 * // 결과 확인
 * console.log(parseResult.url);    // URL 세그먼트 배열
 * console.log(parseResult.query);  // 쿼리 파라미터 배열
 * console.log(parseResult.transformationTraces); // 변환 추적 정보
 * 
 * // 재구성된 URL 얻기
 * const finalUrl = getReconstructedUrl();
 * ```
 * 
 * 아키텍처 설계 원칙:
 * - **단일 책임**: URL/Query 파싱이라는 하나의 책임만 담당
 * - **의존성 주입**: TypeConverter와 Encryptor를 외부에서 주입받아 테스트 용이성 확보
 * - **비동기 처리**: 외부 API 호출이 필요한 변환 작업을 비동기로 처리
 * - **상태 캡슐화**: 내부 파싱 상태는 Hook 내부에서만 관리
 * - **확장성**: 새로운 플래그나 패턴 추가 시 하위 호환성 유지
 * 
 * 성능 고려사항:
 * - **지연 실행**: applyTransform=false로 파싱만 먼저 수행 가능
 * - **메모이제이션**: useCallback으로 함수 참조 안정성 확보
 * - **병렬 처리**: URL 세그먼트와 쿼리 파라미터를 동시에 변환
 * - **효율적 파싱**: 정규식 대신 스택 기반 알고리즘으로 중첩 구조 처리
 * 
 * @param typeConverter A/B 타입을 실제 값으로 변환하는 함수 (선택적)
 *                      - A 타입: ATYPE_VALUES 배열의 값들을 실제 값으로 변환
 *                      - B 타입: BTYPE_VALUES 배열의 값들을 실제 값으로 변환
 *                      - Promise<string>을 반환해야 함 (비동기 API 호출)
 * 
 * @param encryptor 값을 암호화하는 함수 (선택적)
 *                  - e 플래그가 있는 값들을 암호화
 *                  - Promise<string>을 반환해야 함 (비동기 암호화)
 *                  - 타입 변환 후의 값을 암호화함
 * 
 * @returns {
 *   parseResult: ParseResult - 파싱 및 변환 결과
 *   updateParseResult: (urlString: string, applyTransform?: boolean) => Promise<void> - URL 파싱 함수
 *   getReconstructedUrl: () => string - 재구성된 URL 반환 함수
 * }
 * 
 * 에러 처리:
 * - 타입 변환 실패 시 원본 값 유지
 * - 암호화 실패 시 변환된 값 또는 원본 값 사용
 * - 잘못된 URL 형식도 최대한 파싱 시도
 * - 모든 에러는 콘솔에 로깅되며 처리 계속 진행
 * 
 * 디버깅 지원:
 * - 모든 변환 과정이 transformationTraces에 기록됨
 * - 성공/실패 여부와 실패 이유도 추적
 * - 콘솔 로그로 파싱 과정 실시간 확인 가능
 */
export const useUrlQueryParser = (
  typeConverter?: TypeConverter,
  encryptor?: Encryptor
) => {
  // useParseState Hook으로 위임
  // 실제 구현은 useParseState에 있으며, 이것은 공개 API를 제공하는 래퍼
  // 
  // 래퍼 패턴의 장점:
  // 1. 내부 구현 변경 시에도 공개 API는 안정적 유지
  // 2. 필요 시 이 레이어에서 추가 검증이나 로직 삽입 가능
  // 3. 사용자에게는 더 명확한 이름으로 기능 제공
  // 4. 향후 useParseState를 여러 용도로 사용할 가능성 대비
  return useParseState(typeConverter, encryptor);
};