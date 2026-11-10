# s'따듀밸리

Windows x64용 **Society: Sunlit Valley 4.1.5A** 런처입니다. Helios 기반 런처에 Minecraft 1.20.1, Forge 47.4.0, Java 17을 사용합니다.

## 시작하기

1. 런처에서 Minecraft Java Edition을 소유한 Microsoft 계정으로 로그인합니다.
2. **플레이**를 누르면 첫 실행에 Sunlit Valley 4.1.5A 모드팩과 추가 리소스를 자동으로 다운로드합니다. 다운로드가 중단되면 플레이를 다시 눌러 이어서 준비할 수 있습니다.

모드팩 파일은 CurseForge에서 내려받아 체크섬을 검증합니다. 기존 월드와 개인 설정은 유지합니다. 후원 보상의 외형을 표시하는 클라이언트 리소스팩이 함께 설치됩니다.

첫 실행 때 [공식 Buzzy Bees 배경](https://www.minecraft.net/en-us/collectibles)을 내려받습니다. 설정에서 단색 배경으로 바꿀 수 있습니다. Minecraft의 공식 제품이 아니며 Mojang 또는 Microsoft의 승인·제휴와 관계없습니다.

## 개발

Node.js 22와 Windows x64에서 `npm ci`, `npm start`를 사용합니다. Java 17이 없으면 첫 플레이 때 자동으로 설치합니다. 검증은 `npm run lint`와 `node --test test/*.test.js`로 실행합니다. `npm run dist:setup`은 `dist/custom-setup`에 설치파일을 만듭니다.

기본 Microsoft 로그인은 같은 조직의 Alice 런처에서 사용하는 공개 클라이언트 ID를 사용합니다. 로그인 세션은 이 런처의 별도 프로필에 저장됩니다. 자체 등록으로 바꿀 때는 [Microsoft Entra에 등록](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration)하고 Minecraft API 접근을 승인받은 공개 클라이언트 ID를 사용합니다. 로컬에서는 `STTADYU_MS_CLIENT_ID`로 지정하고 배포 빌드는 `app/assets/config/auth.json`에 공개 클라이언트 ID를 지정합니다. 개발 프로필을 분리하려면 `STTADYU_LOCAL_PROFILE`에 빈 폴더 경로를 지정합니다.
