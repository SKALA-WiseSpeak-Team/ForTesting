# WiseSpeak (텍스트 음성 변환 테스트)

WiseSpeak은 지혜(Wise)가 말(Speak)로 전해지는 교육 플랫폼입니다. 이 레포지토리는 텍스트 음성 변환(TTS) 기능을 테스트하기 위한 코드를 포함하고 있습니다.

## 프로젝트 구조

```
tts_test/
├── backend/        # 백엔드 서버 코드
├── frontend/       # 프론트엔드 코드
│   ├── css/        # 스타일시트
│   ├── js/         # 자바스크립트 파일
│   └── index.html  # 메인 HTML 파일
├── tts_outputs/    # TTS 출력 파일 저장 디렉토리
└── ttsvenv/        # 파이썬 가상 환경 (무시됨)
```

## 설치 및 실행 방법

1. 레포지토리 클론하기
   ```
   git clone https://github.com/SKALA-WiseSpeak-Team/ForTesting.git
   cd ForTesting
   ```

2. 필요한 패키지 설치하기
   ```
   npm install
   ```

3. 환경 설정하기
   - 아래 내용으로 `.env` 파일을 루트 디렉토리에 생성하세요.
   ```
   PORT=3000
   OPENAI_API_KEY="your_openai_api_key_here"
   ```

4. 서버 실행하기
   ```
   node backend/server.js
   ```

5. 브라우저에서 `http://localhost:3000`으로 접속하기

## 환경 변수 설정 (.env)

이 프로젝트는 `.env` 파일을 사용하여 민감한 정보를 관리합니다. 보안상의 이유로 `.env` 파일은 깃허브에 업로드되지 않습니다. 로컬에서 프로젝트를 실행하려면 다음과 같은 형식의 `.env` 파일을 프로젝트 루트에 생성해야 합니다:

```
PORT=3000
OPENAI_API_KEY="your_openai_api_key_here"
```

* PORT: 서버가 실행될 포트 번호
* OPENAI_API_KEY: OpenAI API 키 (TTS 기능에 필요)

## 기여 방법

1. 이 레포지토리를 포크하세요.
2. 새 브랜치를 생성하세요: `git checkout -b feature/기능명`
3. 변경사항을 커밋하세요: `git commit -m '새 기능 추가'`
4. 브랜치를 푸시하세요: `git push origin feature/기능명`
5. Pull Request를 제출하세요.

## 라이센스

이 프로젝트는 SKALA-WiseSpeak-Team에서 개발 및 관리하고 있습니다.