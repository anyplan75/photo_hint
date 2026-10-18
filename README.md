# 그때 그자리

지역을 정하면, 그 자리와 해의 시간, 준비 안내를 보여 주는 촬영 참고 앱입니다. 넓은 맥 창에서는 지도가 화면의 대부분을 차지하고, 장소 목록과 준비 안내는 옆 칸에 있습니다. 좁은 휴대폰 너비에서는 위아래로 이어집니다.

지도는 2D 평면과 3D 입체를 바꿀 수 있습니다. 입체는 기울인 지형이고, 스타일이 건물을 지원하면 건물도 세워 보여 줍니다. 추천 장소, 이번 주 선정, 저장한 촬영 지점은 두 보기 모두에 남습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다. 지도를 보려면 공개 토큰 이름 `VITE_MAPBOX_ACCESS_TOKEN` 을 환경에 넣습니다. 토큰 값은 코드에 적지 않습니다.

```bash
npm run check
npm run build
npm run preview
```

`npm run check`는 오늘·내일의 해·달 시각이 라이브러리 결과로 맞는지 확인합니다. `npm run preview`는 빌드 결과를 http://localhost:4173 에서 엽니다.

## 아이폰

같은 화면을 감싼 앱입니다. 표시 이름은 그때 그자리, 묶음 식별자는 `com.anyplan75.geuttae` 입니다. Xcode 프로젝트는 `ios/App/App.xcodeproj` 입니다.

```bash
npm run build:ios
```

## 맥

같은 화면을 큰 창으로 여는 맥 앱입니다. 프로젝트는 `macos/App/App.xcodeproj` 입니다. 표시 이름은 그때 그자리, 묶음 식별자는 `com.anyplan75.geuttae.mac` 입니다.

```bash
npm run build:mac
```

그다음 맥의 Xcode에서 위 프로젝트를 열어 실행합니다. 이 저장소를 고치는 리눅스 환경에서는 Xcode 빌드를 실행하지 못합니다.
