SANGHYEON AIM LAB V16

이번 버전은 V15를 부분 패치하지 않고 훈련 핵심부를 다시 정리한 기준 버전입니다.

핵심 변경
- Flick: 클릭 이벤트/타겟 생성 루프 정리, 난이도→모드 UI 유지, Robot Head 기준점 고정
- Reaction: 이전 7-trial 방식으로 복원. 대기/초록 신호/오발/평균/일관성 측정
- Tracking: RAF 기반 스트레이프, 가속→감속→짧은 정지→반전, HEADLINE Y 고정
- Robot: 헤드 중심을 anchor 원점으로 두고 몸체를 아래에 배치한 전술 훈련봇 스타일
- Sensitivity Lab: 현재 감도 기준 LOW/CURRENT/HIGH 3후보, 후보당 10타겟 컨트롤 테스트
- Growth: 모듈별 BEST/최근/시작 대비/정확도/반응/오버슈트/평균오차/모드/난이도 세분화
- Crosshair 기존 컴포넌트 유지

설치
1. 이 폴더( package.json 이 있는 폴더)를 VS Code로 엽니다.
2. npm install
3. npm run dev

주의
- 이전 V11~V15 프로젝트의 CSS 패치를 섞지 마세요.
- 이 버전을 새 기준 폴더로 사용하는 것을 권장합니다.
- 로컬 기록은 sanghyeon-aim-lab-history-v6 키에 저장됩니다. 이전 V15 기록은 새 세부 필드 체계와 분리됩니다.
