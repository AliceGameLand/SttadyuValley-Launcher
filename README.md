# s'따듀밸리

Windows x64용 **Society: Sunlit Valley 4.1.5A** 런처입니다. Helios 기반 런처에 Minecraft 1.20.1, Forge 47.4.0, Java 17을 사용합니다.

## 시작하기

1. Prism Launcher에서 [Society: Sunlit Valley 4.1.5A](https://www.curseforge.com/minecraft/modpacks/society-sunlit-valley/files/8980840)를 설치합니다.
2. 런처 홈의 **Prism 모드팩 가져오기**를 눌러 인스턴스를 선택합니다. 누락 파일이 표시되면 링크에서 해당 버전을 받아 Prism의 해당 폴더에 넣고 다시 가져옵니다.
3. Minecraft Java Edition을 소유한 Microsoft 계정으로 로그인하고 **플레이**를 누릅니다.

Prism 원본은 읽기 전용으로 사용합니다. 모드·리소스팩·셰이더팩은 정확한 해시를 확인해 복사하고 기본 설정은 CurseForge 원본 아카이브에서 가져옵니다. 월드·서버 목록·개인 옵션·계정은 가져오기에서 제외합니다.

설정에서 [공식 Village & Pillage 배경](https://www.minecraft.net/en-us/collectibles)을 이 PC에 적용할 수 있습니다. Minecraft의 공식 제품이 아니며 Mojang 또는 Microsoft의 승인·제휴와 관계없습니다.

## 개발

Node.js 22와 Windows x64에서 `npm ci`, `npm run runtime:prepare`, `npm start`를 사용합니다. 검증은 `npm run lint`와 `node --test test/*.test.js`로 실행합니다. `npm run dist:setup`은 `dist/custom-setup`에 설치파일을 만듭니다.

실제 로그인에는 [Microsoft Entra에 등록](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration)하고 Minecraft API 접근을 승인받은 데스크톱 앱 클라이언트 ID가 필요합니다. 로컬에서는 `STTADYU_MS_CLIENT_ID`로 지정하고 배포 빌드는 `app/assets/config/auth.json`에 공개 클라이언트 ID를 지정합니다. 개발 프로필을 분리하려면 `STTADYU_LOCAL_PROFILE`에 빈 폴더 경로를 지정합니다.
