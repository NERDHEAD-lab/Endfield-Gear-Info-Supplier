# TODO

- [ ] **[Suggestion]** `src/build.ts`: 스크래핑 안정성 향상을 위해 고정 대기시간(`setTimeout`) 대신 `waitForSelector`, `waitForFunction` 등의 명시적 이벤트 대기로 로직 개선 (Reason: 네트워크 지연 등 상황 변동 시 스크립트가 더 유연하게 동작하기 위함)
