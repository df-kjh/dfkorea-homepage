# 한국전력공사 전자입찰 LINK API 기록 계약

## 상태

이 문서는 **승인 전 격리 계약**이다. 한국전력공사 전자입찰계약정보는
[공공데이터포털 데이터셋](https://www.data.go.kr/data/15148223/openapi.do)에서
전력데이터개방포털 회원가입·인증키 발급 후 OpenAPI 사용 매뉴얼을 확인하도록
안내하는 `LINK` API다. 현재 프로젝트에는 승인 계정, 링크된 서비스 URL, 사용
매뉴얼이 제공되지 않았으므로 실제 endpoint 또는 필드명을 추측해 코드에 넣지
않았다.

Task 3 fixture와 `KepcoTenderAdapter`는 아래 기록 계약만 사용한다. 이 계약은
실제 수집을 활성화하기 위한 근거가 아니며, Task 10에서 승인된 매뉴얼로
교체·검증해야 한다.

## 격리된 기록 계약

| 항목           | 현재 어댑터 계약                         | 승인 후 확인할 사항                 |
| -------------- | ---------------------------------------- | ----------------------------------- |
| 기본 URL       | `KEPCO_TENDER_API_BASE_URL`              | LINK API의 실제 HTTPS 기본 URL      |
| 인증           | `apiKey` = `KEPCO_TENDER_API_KEY`        | 실제 인증 파라미터 이름 및 키 형식  |
| 목록 operation | `bid-notices` (설정으로 대체 가능)       | 실제 목록 operation 경로            |
| 날짜 파라미터  | `startDate`, `endDate` (`YYYYMMDD`, KST) | 매뉴얼의 필수 날짜 범위 파라미터    |
| 페이지         | `pageNo`, `numOfRows`                    | 실제 페이지 파라미터와 최대 크기    |
| 성공 코드      | 최상위 `resultCode: "00"`                | 실제 성공/오류 코드                 |
| 배열           | 최상위 `items`                           | 실제 response envelope 및 배열 위치 |
| 공고 식별자    | `noticeNo`, `noticeSeq`                  | 공고 번호와 차수 필드               |

기록된 fixture의 나머지 필드는 `noticeTitle`, `orderingOrganization`,
`demandOrganization`, `registeredAt`, `bidStartedAt`, `bidEndedAt`, `openedAt`,
`region`, `procurementType`, `contractMethod`, `estimatedAmount`, `detailUrl`,
`itemName`, `description`이다. 실제 API에 없는 선택 필드는 `null` 또는 빈 문자열로
정규화하고, 제목·공고 번호·등록일이 없는 row는 제외한다.

## 활성화 안전장치

- `KEPCO_TENDER_ENABLED=true`일 때 URL과 API 키가 모두 없으면 어댑터 생성이
  `CONFIGURATION_ERROR`로 실패한다.
- 기본 상태에서는 비활성화되어 빈 목록을 반환한다.
- 오류에는 source, 안전한 error code, HTTP status만 보존한다. URL, API 키,
  원본 오류 응답은 오류 메시지와 로그 문맥에 넣지 않는다.

## Task 10 라이브 검증 TODO

1. 한전 데이터 포털에서 서비스 활용 신청 및 승인 계정을 준비한다.
2. 링크된 OpenAPI 매뉴얼에서 실제 base URL, operation, 인증 파라미터, 날짜·페이지
   파라미터, 성공 코드 및 목록 필드를 기록 계약과 비교한다.
3. fixture와 어댑터 매핑을 승인된 계약으로 교체하고, staging에서 API 키를 환경
   변수로만 주입해 성공·빈 결과·오류 응답을 확인한다.
4. 위 확인 전에는 `KEPCO_TENDER_ENABLED`를 `false`로 유지한다.
