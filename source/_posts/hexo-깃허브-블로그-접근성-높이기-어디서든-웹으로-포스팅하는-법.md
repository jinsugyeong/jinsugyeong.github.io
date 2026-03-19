---
title: "Hexo 깃허브 블로그 접근성 높이기: 어디서든 웹으로 포스팅하는 법"
date: 2026-03-19 16:26:00
author: jinsugyeong
cover: /gallery/cover/decap-로그인.png
categories:
  - Infra
tags:
  - Github
  - Github Actions
  - Hexo
  - Decab CMS
body_toast: 테스트
---
현재 hexo로 깃허브 블로그를 쓰고있는데 항상 로컬에서 vscode 켜서 글을 쓰다보니 접근성이 너무 떨어지고 부트캠프 끝나고 맥북에서 윈도우 노트북으로 옮기면서 테마 관련 + 게시글 소스 코드들이 다 날라갔던 경험이 있어서 다른 블로그 플랫폼들처럼 바로 웹브라우저나 다른 기기에서도 쉽게 작성하고 배포할 수 없나?라는 생각이 들었다.

<!-- more -->

처음엔 깃허브에 소스 파일도 커밋하거나, 압축해서 외장하드나 클라우드 저장소에 보관하는 방식으로 쉽게 해결하려다가 주기적으로 추가되는 게시글과 자잘하게 수정되는 테마 파일 그리고 hexo 명령어를 사용해도 깃허브 액션으로 배포되는것 같은데 그럼 웹에서 글쓰기해서 저장버튼 누르는 로직만 추가 하는건데 간단하지 않을까? 라는 생각에 배포 방식을 바꾸게 되었다.

우선 찾아본 방법은 여러가지가 있었다.

* GitHub API 활용: 별도 설치 없이 브라우저에서 바로 쓸 수 있는 커스텀 웹앱. 가장 유연하지만 초기 세팅이 조금 필요
* Decap CMS(Netlify CMS): 검증된 오픈소스 CMS. UI가 깔끔하고 안정적인데 Netlify 계정 필요.
* GitHub.dev: 사실상 지금 VSCode 쓰는 것과 거의 같은데, 브라우저에서 열림. 가장 빠르게 쓸 수 있는 방법.
* Obsidian + Git — 로컬 앱이지만 메모/글쓰기 경험 자체가 훨씬 좋고, 모바일도 지원.

그중에서 웹에서 바로바로 마크다운 미리보기 가능하고 임시저장 가능한 환경을 원했기에 Decap CMS를 사용하기로 했다.

# 1. Hexo 소스 파일 깃허브에 올리기

지금은 로컬에 `source`, `themes`와 같은 **소스파일** 과 깃허브에 올라가있는 `.deploy_git`과 같은 빌드된 **정적 파일** 이 있는 상태

정적파일은 master 브랜치로 관리가 되고 었어서, 소스파일은 source라는 브랜치에 올리기로 했다.

## 1.1.  깃허브에 올려야 하는 파일들

* `_config.yml`: Hexo 블로그 전체 설정 파일
* `package.json` / `package-lock.json`: GitHub Actions가 어떤 플러그인과 모듈을 설치해야 하는지 알기 위해 필요함
* `source/` 폴더: 실제로 작성한 마크다운(*.md) 원본 글과 이미지 파일들이 들어있는 폴더
* `themes/` 폴더: 사용 중인 icarus 테마의 소스 코드와 설정 파일
* `scaffolds/` 폴더: 새 글을 생성할 때 사용되는 템플릿 파일

## 1.2. 깃허브에 올리지 않는 파일들

* `node_modules/`: 모듈 파일들. (GitHub Actions가 package.json을 보고 npm install 명령어로 알아서 다운로드함)
* `public/`: Hexo가 빌드해서 만들어낸 최종 HTML 결과물 폴더
* `.deploy_git/`: hexo deploy시 배포를 위해 생성되는 임시 폴더
* `db.json`: 로컬 빌드 캐시 파일

- - -

# 2. GitHub Actions로 자동 배포(CI/CD) 파이프라인 구축하기

## 2.1. `.github/workflows/deploy.yml` 작성

Hexo 소스 코드가 있는 최상위 경로에 코드 작성

```yaml
name: Deploy Hexo Blog

# 워크플로우 실행 조건
on:
  push:
    branches:
      - source # 'source' 브랜치에 푸시될 때 실행됩니다.

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest # 실행 환경
    permissions:
      contents: write # master 브랜치에 배포(push)하기 위해 쓰기 권한을 부여합니다.

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # 전체 커밋 기록을 가져오기

      # 2. Node.js 환경 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20' # Hexo 8.x는 Node.js 20 이상이 필요합니다.
          cache: 'npm' # npm 의존성 캐싱

      # 3. Hexo 및 플러그인 설치
      - name: Install Dependencies
        run: npm install

      # 4. Hexo 빌드
      - name: Build
        run: |
          npx hexo clean
          npx hexo generate

      # 5. GitHub Pages에 배포
      - name: Deploy to GitHub Pages
        env:
          # GitHub이 Actions 실행할 때마다 자동으로 발급해주는 임시 토큰
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config --global user.name "깃허브이름"
          git config --global user.email "깃허브메일"
          git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
          cd public
          git init
          git remote add origin {깃허브 레포 주소}.git
          git fetch origin master
          git reset --soft origin/master
          git add -A
          git commit -m "Site updated: $(TZ='Asia/Seoul' date +'%Y-%m-%d %H:%M:%S')" || echo "Nothing to commit"
          git push origin master
```





## 2.2. GitHub Actions에 쓰기 권한 부여하기

직접 토큰을 발급받지 않고 기본 `GITHUB_TOKEN`을 사용할 때 가장 흔하게 발생하는 에러가 **권한 부족(Permission denied)** 이다. 기본 토큰이 레포지토리에 푸시(Push)할 수 있도록 권한을 열어주어야 한다.

1. 깃허브 레포지토리 페이지에서 Settings 탭으로 이동
2. 왼쪽 사이드바에서 Actions > General을 클릭
3. 스크롤을 맨 아래로 내려서 Workflow permissions 섹션에서

![alt text](actions-권한.png)

4. Read and write permissions를 선택하고 \[Save] 버튼 클릭

- - -

# 3.웹 기반 CMS(관리자 페이지) 연동하기

[Decap CMS 튜토리얼](https://decapcms.org/docs/basic-steps/)

* source 폴더 내에 admin 폴더를 생성하고
* admin 폴더 안에 index.html과 config.yml 파일을 만든다.

## 3.1. `index.html` 작성

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Content Manager</title>
  </head>
  <body>
    <!-- Include the script that builds the page and powers Decap CMS -->
    <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  </body>
</html>
```

## 3.2. `config.yml` 작성

### (1) 기본 post 구조

```markdown
---
title: {{ title }}
date: {{ date }}
author: jinsugyeong
cover: /gallery/cover/
categories:
  - 
tags:
  - 
---
```

* 미리보기 카드의 커버 이미지 경로는 `/gallery/cover`로 잡힘
* `_config.yml`의 `post_asset_folder: true` 설정 때문에 글과 동일한 이름의 폴더가 생성되고, 그 글에 쓰이는 이미지들을 그 폴더 안에 따로 모아두는 방식으로 동작됨
  		- `{% asset_img image.png text %}` 태그를 사용함 
  		- 이때 path는 폴더명을 제외한 이미지 파일명만 사용함
  		- 현재 로컬에서 글작성시: *\[이미지 캡쳐 > 클립보드 붙여넣기 > 자동 마크다운 문법으로 작성됨 > 글 작성 완료 후 게시글 제목 폴더로 이미지 이동 > 마크다운 문법 hexo 태그로 수정]*

<br>

### (2) `config.yml` 작성

```yaml
backend:
  name: github
  repo: jinsugyeong/jinsugyeong.github.io
  branch: source # 소스 코드가 있는 브랜치

media_folder: "source/images" # 이미지 저장 경로
public_folder: "/images"

collections:
  - name: "post"
    label: "Post"
    folder: "source/_posts"
    create: true
    slug: "{{slug}}"
    media_folder: "{{dirname}}/{{slug}}"
    public_folder: ""
    fields:
      - {label: "Title", name: "title", widget: "string"}
      - {label: "Publish Date", name: "date", widget: "datetime"}
      - {label: "Author", name: "author", widget: "string", default: "jinsugyeong"}
      - {label: "Cover Image", name: "cover", widget: "image", required: false, media_folder: "source/gallery/cover", public_folder: "/gallery/cover"}
      - {label: "Categories", name: "categories", widget: "list", required: false}
      - {label: "Tags", name: "tags", widget: "list", required: false}
      - {label: "Body", name: "body", widget: "markdown"}
```

* Decap CMS가 알아서 글 제목과 똑같은 이름의 폴더를 생성
* cover image 경로 잡을 수 있게 
* 컬렉션(Post) 안쪽에 작성된 설정을 최우선으로 적용됨
* 상단의 전역 설정은 Media 탭에서 단독으로 이미지를 관리할때 임시로 사용되는 기본(Fallback) 폴더(Decap CMS 시스템상 전역 media_folder는 필수 입력값이기 때문에 지우지 못하고 남겨둔 것)

### (3) 이미지 자동 변환 스크립트 추가

Hexo는 scripts/ 폴더 안에 자바스크립트 파일을 넣어두면 배포(Build)할 때 알아서 실행한다.
로컬에서 수작업으로 했던 작업을 스크립트로 작성하여 마크다운을 HTML로 변환하기 직전에 !alt를 찾아서 {% asset_img %}로 바꿔주는 스크립트

```js
'use strict';

hexo.extend.filter.register('before_post_render', function(data) {
  // 마크다운 이미지 정규식: ![alt 텍스트](이미지경로)
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  data.content = data.content.replace(regex, function(match, alt, path) {
    // 1. 인터넷 외부 링크(http://, https://)는 변환하지 않고 그대로 둠
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return match;
    }

    // 2. 경로에서 파일명만 추출 (예: folder/image.png -> image.png)
    const fileName = path.split('/').pop();

    // 3. Hexo의 asset_img 태그로 변환하여 리턴 (배포할 때만 적용됨!)
    return `{% asset_img "${fileName}" "${alt}" %}`;
  });

  return data;
});
```

* 글을 쓸때는 에디터 본문에 이미지 드래그 앤 드롭, 마크다운 문법 으로 쓰고
* 글 저장해서 레포지토리에도 순수 마크다운 문법으로 들어감
* 깃허브 액션돌아가서 배포 시작하면 스크립트 돌아가서 hexo 코드로 변환

# 4. GitHub 계정으로 로그인하기 위한 OAuth App 연동

1. GitHub 우측 상단 프로필 > Settings >  왼쪽 맨 아래 Developer settings > OAuth Apps > **\[New OAuth App]** 클릭
2. 정보 입력

* Application name: 블로그 이름
* Homepage URL: 깃허브 블로그 주소
* Authorization callback URL: 임시로 

3. \**Register application* 클릭.
4. 화면에 나오는 Client ID 값 메모장에 복사
   Ov23licCFD8DqseW8zIP
5. **Generate a new client secret** 버튼을 눌러 생성된 **Client Secret** 값도 메모장에 복사 (창을 닫으면 다시 안 보이니 꼭 복사해두기)
   99b3e8f60b83ac68bfd2f249814726da0693ddb2
6. 현재 페이지 닫지 말고 유지해두기!

- - -

# 5. 로그인 중계 서버(Proxy) 만들기

공식 튜토리얼에 있는 netlify 사용해서 만들기

1. [Netlify](https://app.netlify.com/) 깃허브로 로그인
2. 깃허브 블로그 레포 끌고와서 연결하기
3. Project configuration > Access & security > OAuth 메뉴 클릭
4. 깃허브 OAuth에 4에서 복사해뒀던 Client ID랑 Secret 입력하고 등록하기
5. 깃허브 Oauth 설정 페이지로 돌아가서 임시로 써뒀던 **Authorization callback URL**에 `{프로젝트이름}.netlify.app/callback`으로 수정해주기

Vercel 전용 코드를 Netlify에 올렸을 때 발생하는 404 에러 발생해서..^_^

레포 직접 만들어서 버셀로 다시도전

1. 중계서버용 깃허브 레포 생성
2. 3가지 파일 작성
3. vercel 프로젝트 생성 및 레포 연결, 환경변수 설정
4. 깃허브 Oauth 설정 페이지로 돌아가서 임시로 써뒀던 **Authorization callback URL**에 `{프로젝트이름}.vercel.app/callback`으로 수정해주기
5. 깃허브 블로그 레포 `source` 브랜치에있는 `admin/config.yml` 수정하기

```yaml
backend:
  name: github
  repo: {유저이름}/{repo 이름}
  branch: source # 소스 코드가 있는 브랜치
  base_url: https://{프로젝트이름}.vercel.app #버셀 배포 주소
  auth_endpoint: /api/auth 
  publish_mode: editorial_workflow #임시저장까지 가능하게
```

# Troubleshooting

## (1) `GITHUB_TOKEN` 설정 관련

> 참고: _config.yml의 deploy 설정 중 repo URL을 https://${GITHUB_TOKEN}@github.com/jinsugyeong/jinsugyeong.github.io.git 형태로 변경해야 Actions에서 권한 오류 없이 푸시할 수 있습니다.

라고 해서 북치기박치기 자동배포때처럼 `GITHUB_TOKEN` 발급받아서 Actions에 secret key로 등록할려했는데 *Secret names must not start with GITHUB_* 에러가 났다. 깃허브에서 자체적으로 자동 생성해서 제공하는 "예약된 특수 토큰"이기 때문에 직접 Secrets 메뉴에 들어가서 만들 필요가 없고 알아서 Actions가 실행될 대마다 임시로 발급해주기때문에 꺼내 쓰기만 하면 된다고 한다. 

공식 플러그인(hexo-deployer-git)이 권장하는 방식으로 수정해주기만 하면 된다.

```yaml
deploy:
  type: git
  repo: https://github.com/jinsugyeong/jinsugyeong.github.io.git
  token: $GITHUB_TOKEN
  branch: master
```

이렇게 하면 `deploy.yml` 워크플로우에 있던 `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` 이 코드가 자동으로 연동된다.

## (2) Icarus 테마의 엄격한 버전 체크 기능

```bash
ERROR Package hexo's version (8.1.1) does not satisfy the required version (^7.1.1).
ERROR Package hexo-util's version (4.0.0) does not satisfy the required version (^3.2.0).
ERROR Package semver's version (6.3.1) does not satisfy the required version (^7.5.4).
ERROR Please install the missing dependencies your Hexo site root directory:
ERROR npm install --save hexo@^7.1.1 hexo-util@^3.2.0 semver@^7.5.4
ERROR or:
ERROR yarn add hexo@^7.1.1 hexo-util@^3.2.0 semver@^7.5.4
Error: Process completed with exit code 255.
```

* Icarus 테마가 요구하는 버전은 `Hexo 7.x` 버전대인데, 블로그에는 가장 최근에 나온 최신 버전인 Hexo 8.1.1 버전이 설치되어 있어서 호환성 에러를 뱉으며 빌드를 스스로 멈춰버린 상황
* 또한 hexo-util과 semver 패키지의 명시적 설치도 요구하고 있음
* 문제를 해결하기위해 프로젝트 설정 파일인 `package.json`에서 버전을 Icarus 테마가 요구하는 안전한 버전으로 낮춰주고, 누락된 패키지들을 추가해줌

## (3) Git author identity unknown 에러

```bash
*** Please tell me who you are.

Run

  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"

to set your account's default identity.
Omit --global to set the identity only in this repository.

fatal: empty ident name (for <runner@runnervm46oaq.ia0wr4vk0kiedl5ltb20algy2b.dx.internal.cloudapp.net>) not allowed
FATAL Something's wrong. Maybe you can find the solution here: https://hexo.io/docs/troubleshooting.html
Error: Spawn failed
    at ChildProcess.<anonymous> (/home/runner/work/jinsugyeong.github.io/jinsugyeong.github.io/node_modules/hexo-deployer-git/node_modules/hexo-util/lib/spawn.js:51:21)
    at ChildProcess.emit (node:events:524:28)
    at Process.ChildProcess._handle.onexit (node:internal/child_process:293:12)
Error: Process completed with exit code 2.
```

* "누가 커밋을 하는지(이름과 이메일)"가 설정되어 있지 않아서 깃이 커밋을 거부하고 에러를 뱉음
* GitHub Actions 스크립트(deploy.yml) 안에서 배포 명령어를 실행하기 직전에 이름과 이메일을 알려주도록 두 줄 추가

## (4) 배포 인증(Token) 오류

```bash
fatal: could not read Username for 'https://github.com': No such device or address FATAL Something's wrong. Maybe you can find the solution here: https://hexo.io/docs/troubleshooting.html 
Error: Spawn failed at ChildProcess.<anonymous> (/home/runner/work/jinsugyeong.github.io/jinsugyeong.github.io/node_modules/hexo-deployer-git/node_modules/hexo-util/lib/spawn.js:51:21) 
	at ChildProcess.emit (node:events:524:28) 
	at Process.ChildProcess._handle.onexit (node:internal/child_process:293:12) 
Error: Process completed with exit code 2.
```

* GitHub Actions 가상 환경에서 깃허브 서버로 완성된 블로그(HTML)를 푸시(Push)하려고 할 때, **"당신이 누구인지(인증 정보) 알 수 없어 푸시를 거부하겠다"**라는 뜻의 권한 에러
* `_config.yml`에 `token: $GITHUB_TOKEN`을 넣어주었지만, Hexo가 내부적으로 `.deploy_git`이라는 새로운 폴더를 만들고 깃을 초기화하면서 이 토큰 정보를 제대로 넘겨주지 못해 발생한 문제
  -**GitHub Actions 스크립트 단에서 깃허브로 가는 모든 요청에 자동으로 토큰을 끼워 넣도록 전역 설정(Global Config)**을 해주는 것

```yaml
run: |
          git config --global user.name "jinsugyeong"
          git config --global user.email "apr15th@naver.com"
          git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
```

## (5) 토큰 설정 오류

* 깃허브 서버가 토큰(\*\**로 가려진 부분)을 비밀번호가 아닌 '사용자 아이디'로 착각해서 "비밀번호를 입력하라"고 요구하고 있는 상황
* GitHub Actions 환경에서는 비밀번호를 입력할 수 없으므로 에러가 발생하며 멈추게 됨
* 이를 해결하려면 깃허브가 권장하는 공식 인증 방식인 x-access-token을 사용하도록 `deploy.yml`을 수정하고, 충돌을 일으킬 수 있는 `_config.yml`의 토큰 설정은 깔끔하게 지워주면 된다.

1. `deploy.yml` 파일 수정
   토큰 앞에 x-access-token: 이라는 아이디 명시

```yaml
run: |
          git config --global user.name "jinsugyeong"
          git config --global user.email "apr15th@naver.com"
          git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
```

2. `_config.yml` 파일 수정
   플러그인이 잘못된 주소를 생성하지 않도록 token 삭제

## (6) 브라우저가 admin/config.yml 파일을 찾지 못하는 문제

* Hexo가 블로그를 배포(생성)할 때 .yml 확장자 파일을 "단순 설정 파일"로 오해하고 최종 결과물(public/ 폴더)에 복사하지 않고 빼버렸기 때문
* Hexo에게 "admin 폴더 안에 있는 파일들은 네가 건드리지 말고 있는 그대로 배포해 줘!" 라고 예외 처리(skip) 설정 추가
* # Directory 부분에 `skip_render: "admin/**"` 추가

## (7) Token 객체 undefined

하하하하... OAUTH_CLIENT_SECRETS로 설정해뒀던거다...하하하하하!!! 하하하!!

## (8) opener 참조 끊김 문제

```
console.log(window.opener)
null
undefined
```

* Chrome 보안 정책: 팝업이 다른 도메인으로 리다이렉트되면 opener를 null로 만듦
* 해결책 1: callback 페이지에서 `postMessage`대신 `localStorage`를 이용해서 토큰을 전달하는 방식

```js
// localStorage에 저장
        localStorage.setItem('decap-cms-token', message);
        // 부모 창에 알림 (BroadcastChannel 사용)
        var bc = new BroadcastChannel('decap-cms-auth');
        bc.postMessage(message);
        bc.close();
        setTimeout(function() { window.close(); }, 500);
```

```
- 근데 이렇게하면 Decap CMS가 자체적으로 못받음(Decap이 `postMessage`방식만 기대해서)
```

* 해결책 2: `rel="opener"` 유지하도록 파업을 새탭이 아닌 방식으로 열기
  		- `auth.js`에서 리다이렉트할때 `res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');` 추가하기
  		- `callback.js`에도 send전에 추가

```js
//auth.js
res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
res.redirect(authorizationUri);


//callback.js
res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
res.send(`...`);
```

## (9) hexo deploy force push로 인한 commit 초기화 문제

원래 `hexo g -d`로 배포할땐 잘만 쌓이던 배포 커밋들이 계속 사라지고 force 옵션이 붙어서 2개의 커밋이 쌓이는 문제 발생
안그래도 하루에 fix:커밋 메세지로인한 진한 잔디밭으로 변하는 것에 스트레스 받아서(아무 의미없다...) 여러 해결을 해볼려고 노력..

* `_config.yml` deploy 옵션 추가하기

```yaml
deploy:
  type: git
  repo: https://github.com/jinsugyeong/jinsugyeong.github.io.git
  branch: master
  force: false #여기
```

안됨 하오..

* 알고 보니hexo-deployer-git 플러그인 v4.0.0 버전이

```bash
return git('push', '-u', repo.url, 'HEAD:' + repo.branch, '--force');
```

이렇게.. force 옵션을 강제로 붙이고 있던것.. gitactions 돌때마다 npm installs 하니... v3으로 내리든가 직접 actions에 플러그인 안쓰고 master branch에 push하든가

* 우선 플러그인 버전부터 내려보기

```bash
npm install hexo-deployer-git@3.0.0 --save

return git('push', '-u', repo.url, 'HEAD:' + repo.branch, '--force');
```

v3도... --force가 붙어서 실패

* actions에 직접 push하기
  커밋 메세지 시간대 UTC로 잡히던 것도 잡기

```yaml
name: Deploy Hexo Blog

# 워크플로우 실행 조건
on:
  push:
    branches:
      - source # 'source' 브랜치에 푸시될 때 실행됩니다.

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest # 실행 환경
    permissions:
      contents: write # master 브랜치에 배포(push)하기 위해 쓰기 권한을 부여합니다.

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout Repository
        uses: actions/checkout@v4

      # 2. Node.js 환경 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20' # Hexo 8.x는 Node.js 20 이상이 필요합니다.
          cache: 'npm' # npm 의존성 캐싱

      # 3. Hexo 및 플러그인 설치
      - name: Install Dependencies
        run: npm install

      # 4. Hexo 빌드 및 배포
      - name: Deploy to GitHub Pages
        env:
          # _config.yml에 설정된 GITHUB_TOKEN을 Actions의 기본 토큰으로 설정
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npx hexo clean
          npx hexo generate --deploy
```
