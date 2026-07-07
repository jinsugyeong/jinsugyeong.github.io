---
title: "Git 커밋 메시지 규칙 & 자주 쓰는 명령어"
date: 2026-06-05 09:33:00
author: jinsugyeong
categories:
  - Git/Github
tags:
  - Git
  - Github
---

매번 커밋할때 마다  "이게 `feat`이었나 `chore`였나..." 헷갈려서 찾아보고, 에러 날 때마다 과거의 내가 검색했던걸 또 검색하고있는 내 자신을 위해 아예 블로그에 박제해두기로 했다.

<!-- more -->

자주 참고하는 커밋 메시지 규칙과, Git 작업하면 항상 검색하게 되는 명령어를 정리해 보았다.
커밋 메세지 규칙은 [Git 커밋 메시지 규칙](https://velog.io/@chojs28/Git-%EC%BB%A4%EB%B0%8B-%EB%A9%94%EC%8B%9C%EC%A7%80-%EA%B7%9C%EC%B9%99)  이라는 북마크해두고 항상 던 블로그를 참고했고
명령어들은 지피티와 제미나이의 내역들을 참고했다 ^_^



# 1. Git 커밋 메시지 컨벤션 (규칙)

커밋 메세지는 보통 `[타입]:[제목]` 형태로 작성한다. 가장 대중적인 규칙(AngularJS 컨벤션)을 요약하자면 다음과 같다. 솔직히 처음보면 헷갈리고 지금도 이건 어디에 들어가야하지 하고 ai한테 물어볼때가 많아서 예시를 같이 써두겠다.

## 1-1. 커밋 타입 (Type)

| 타입 이름 | 내용 | 예시 | 
| :---:| --- | :-- |
| `feat` |  **새로운 기능 추가** | feat: google oauth 로그인 기능 추가 |
| `fix` |  **버그 수정** |  fix: 모바일에서 결제 버튼 안 눌리는 현상 수정 |
| `docs` | **문서 수정** | docs: README.md에 프로젝트 실행 방법 추가 |
| `style` | **코드 자체의 로직 변경 없이 포맷팅, 세미콜론 누락, 들여쓰기 수정 등** | style: Prettier tab width 2 > 4 변경 후 적용, <br> style: 불필요한 console.log 삭제 |
| `test` | **테스트 코드 추가 및 수정** | test: 로그인 예외 처리 테스트 코드 추가 |
| `ci` | **CI/CD (GitHub Actions 등) 관련 설정 수정** | ci: GitHub Actions 자동 배포 스크립트 수정 |
| `refactor` | **기능이나 성능의 변화는 없지만, 코드의 구조나 가독성 개선** | refactor: 로그인 로직을 별도의 함수로 분리 | 
| `perf` | **성능(속도, 메모리 등) 향상** | perf: 렌더링 반복문 최적화로 로딩 속도 개선 |
| `chore` | **프로덕션 코드나 빌드와 무관한 기타 작업** | chore: .gitignore 파일에 .env 추가, chore: 이미지 에셋 폴더명 변경 | 
| `build` | **프로젝트 빌드 시스템(Webpack, Vite)이나 패키지 매니저, 라이브러리 설치 등 빌드/의존성 관리** | build: package.json에 axios 라이브러리 추가, <br> build: Webpack 번들링 설정 변경|

<br>

## 1-2. 커밋 메시지 규칙

* 제목은 **명령문**으로 작성하고, 끝에 마침표(`.`)를 찍지 않는다.
* 제목과 본문 사이에는 **한 줄 띄워** 분리한다.
* 본문은 '어떻게' 변경했는지보다 **'무엇을', '왜'** 변경했는지 설명한다.

이건 딴말인데 영어로 작성하는걸 권고하는데 나는 영어를 못해서 그냥 한글로 작성한다... 어차피 ai 시대에 라고... 생각해보기..

<br>

## 1-3. 커밋 메시지 구조
```
타입: 제목

- 여기에
- 보통
- 자세하게 적으면
```

![1780625595208.png](https://jinsugyeong.github.io/2026/06/05/Git-%EC%BB%A4%EB%B0%8B-%EB%A9%94%EC%8B%9C%EC%A7%80-%EA%B7%9C%EC%B9%99--%EC%9E%90%EC%A3%BC-%EC%93%B0%EB%8A%94-%EB%AA%85%EB%A0%B9%EC%96%B4/1780625595208.png)
이렇게 나온다

<br>

# 2. 자주 쓰는 Git 명령어 모음


## (1) 로컬에서 작업하다가 깃허브에 레포 파서 아카이브 할 때 (초기화)

보통 로컬에서 한참 작업하다가 어느정도 완성되면 깃허브에 올리는 편이라 항상 검색하게 된다
깃허브 한번 연결되면 오류날때 빼곤 vscode gui로 거의 하는편인데 그걸 처음에 연결하는게 문제. 

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin <깃허브 레포지토리 주소.git>
git push -u origin main
```

<br>

## (2) 커밋하려는데 `user.name`, `user.email` 설정 안 돼서 오류 날 때

새로 포맷했거나 다른 컴퓨터에서 작업할 때 무조건 뜨는 에러. 내 정보부터 등록해 줘야 커밋이 된다.

```bash
# 전역 설정 (앞으로 이 컴퓨터의 모든 프로젝트에 적용)
git config --global user.name "내 이름(또는 닉네임)"
git config --global user.email "내 깃허브 이메일"

# 설정된 config 확인(전역/로컬 중 어디서 가져오는지까지 표시)
git config --list --show-origin

# 전역 설정 삭제
git config --global --unset user.name
git config --global --unset user.email

# 현재 프로젝트에만 적용하고 싶다면 --global을 빼면 됨
git config user.name "내 이름"

# 현재 프로젝트에만 적용하고 싶다면 --global을 빼면 됨
git config user.name "내 이름"

# 확인
git config --local --list
git config user.name
git config user.email
```

<br>

## (3) 깃허브(원격)에서 지운 브랜치, 로컬에 동기화하기

깃허브 사이트에서 PR 머지하고 브랜치를 싹 지웠는데, 로컬 터미널에서 `git branch -a`를 쳐보면 옛날 브랜치들이 지저분하게 남아있다. 

이때 원격 저장소의 상태를 로컬에 동기화해주는 명령어다.

```bash
git fetch --prune
# 또는
git remote prune origin
```

<br>

## (4) 커밋 리셋하기 (feat. 윈도우 PowerShell 주의점)

방금 한 커밋을 취소하고 싶을 때 보통 `git reset HEAD^`를 쓰라고 나온다. 

**하지만 윈도우 PowerShell에서는 `^` 기호를 특수문자로 인식해서 에러가 난다!** 

윈도우 유저라면 무조건 아래처럼 `~` 기호를 써야 한다.

```bash
# 가장 최근 커밋 1개 취소 (파일 변경사항은 남겨둠)
git reset HEAD~1

# 최근 커밋 2개 취소하고 싶다면?
git reset HEAD~2

# 커밋 취소하고 변경된 파일들까지 싹 날려버리고 싶다면 (--hard)
git reset --hard HEAD~1

# 적용
git push -f
```

<br>

## (5) 실수로 올린 환경변수 파일 커밋 내역까지 없애기

환경변수나 API 키가 담긴 `.env`를 실수로 깃허브에 올려버렸을 때. 그냥 파일을 지우고 푸시하면 **커밋 히스토리에 파일 내용이 그대로 남아서 누구나 털어갈 수 있다.** 히스토리 전체를 뒤져서 해당 파일을 완전히 도려내는 명령어다.

사실 가장 먼저 해야할건 새로운 값들을 발급받는것이 먼저임!

```bash
# .env 파일을 히스토리에서 완전히 삭제
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all

# 원격 저장소에 강제로 덮어쓰기 (강제 푸시)
git push origin --force --all
```

*(💡 위 명령어 실행 후 깃허브에서 내역이 사라진 것을 꼭 확인하자!)*

<br>

## (6) 커밋 내역 완전 초기화하기

프로젝트를 진행하다가 커밋 내역이 너무 지저분해서 그냥 처음부터 다시 시작하고 싶을 때가 있다. 
레포를 새로 파지 않고 현재 코드를 유지한 채 첫 커밋으로 리셋하는 제일 무식하고 편한 방법.

```bash
# 1. 로컬의 .git 폴더 삭제 (모든 Git 기록 날아감)
rm -rf .git  

# 2. 다시 Git 초기화 및 커밋
git init
git add .
git commit -m "Initial commit"

# 3. 원격 저장소 연결 후 강제 푸시 (원격 내역도 덮어씌워짐)
git remote add origin <깃허브 레포지토리 주소.git>
git push -u origin main --force
```

<br>

## (7) `.gitignore`에 뒤늦게 넣었는데 계속 파일이 추적(Tracking)될 때

깃허브에 한 번 올라간 파일은 나중에 `.gitignore` 파일에 추가해도 소용이 없다. 

이미 깃이 추적을 시작했기 때문이다. 이때는 **Git에 저장된 캐시를 싹 지워주고** 다시 올려야 한다.

```bash
# 1. 원격의 Git 캐시를 싹 지운다 (로컬 파일은 안 지워짐!)
git rm -r --cached .

# 2. 다시 전체 추가 (이때 gitignore가 제대로 적용됨)
git add .

# 3. 커밋 후 푸시
git commit -m "chore: gitignore 적용 (캐시 삭제)"
git push origin main
```





## (8) git changes에 파일 잔뜩있는데 개발 브랜치 최신 pull 땡겨와야할때
```bash
# 1. 수정사항 및 추적되지 않는 새 파일들 까지 모두 stash에 임시 저장
git stash -u

# 2. 원격 저장소의 최신 내용 가져오기
git fetch origin

# 3. 최신 dev 브랜치 내용을 바탕으로 현재 브랜치 rebase
git revase origin/dev

# 4. 아까 넣어두었던 수정사항 다시 꺼내서 적용하기
git stash pop
```

다들 충돌없는 개발생활 되시길...
보통  내 개발 dev 브랜치에 pr > 머지하고 그거 로컬에 가져오고 다시 pull하다가 충돌날때 많음...