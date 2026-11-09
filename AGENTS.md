# s'따듀밸리 런처

- Windows x64용 Electron 런처다. Minecraft 1.20.1, Forge 47.4.0, Java 17과 Sunlit Valley 4.1.5A 파일 잠금 목록을 사용한다.
- Prism 원본은 읽기 전용이다. 개인 설정, 계정, 월드, 서버 목록이나 모드 바이너리를 저장소에 추가하지 않는다.
- 공개 소스는 `AliceGameLand/SttadyuValley-Launcher`에 둔다. 릴리스 게시와 실제 게임 실행은 별도 요청을 따른다.
- 검증은 `npm run lint`, `node --test test/*.test.js`, `npm run dist:setup`으로 진행한다. 테스트용 Electron 실행에는 `STTADYU_LOCAL_PROFILE`을 사용한다.
- 커밋 Author와 Committer는 JooHwan Kim <gptnr2140@gmail.com>을 사용한다.
