---
title: "hexo 깃허브 블로그 접근성 높이기 - 어디서든 웹으로 포스팅하는 법"
date: 2026-03-23 20:53:00
author: jinsugyeong
categories:
  - Infra
tags:
  - Github
  - Github Aictions
  - Decap CMS
  - Github Oauth
  - Vercel
  - Hexo
---

현재 hexo icarus 테마를 사용해서 깃허브 블로그를 사용하고 있는데 항상 내 노트북에서만 vscode를 실행시켜서 글을 쓰다보니 접근성이 너무 떨어지고 소스 파일들은 백업이 따로 안돼서 '다른 블로그 플랫폼들처럼 바로 웹브라우저나 다른 기기에서도 쉽게 작성하고 배포할 수 없나?' 라는 생각에 배포 방식을 바꾸게 되었다.

<!-- more -->

<br>

우선 찾아본 방법은 여러가지가 있었다.

1. **Decap CMS(Netlify CMS)** : 검증된 오픈소스 CMS. UI가 깔끔하고 안정적.
2. **GitHub API 활용** : 별도 설치 없이 브라우저에서 바로 쓸 수 있는 **커스텀 웹앱**. 가장 유연하지만 초기 세팅이 조금 필요
3. **GitHub.dev** : 사실상 지금 VSCode 쓰는 것과 거의 같은데, 브라우저에서 열림. 가장 빠르게 쓸 수 있는 방법.
4. **Obsidian + Git** : 로컬 앱이지만 메모/글쓰기 경험 자체가 훨씬 좋고, 모바일도 지원.


<br>

그중에서 웹에서 바로바로 마크다운 미리보기 가능하고 임시저장 가능한 환경을 원했기에 Decap CMS를 사용해서  글쓰기 환경을 구축했다가, 실사용에서 불편함을 느끼고 커스텀 웹앱을 구축했다. 현 게시글은 **Hexo , Icarus 테마, Github page로 깃허브 블로그** 를 운영하는 내 블로그에 맞춰 최적화된 설정 방법을 정리한 글이다. 트러블 슈팅 및 여러 에러들은 따로 정리할 예정이다.

<br>

# 1. Hexo 소스 파일 깃허브에 올리기

지금은 로컬에 `source`, `themes`와 같은 **소스파일** 과 깃허브에 올라가있는 `public` 내부의 빌드된 **정적 파일** 이 있는 상태

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

<br>


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


<br>

## 2.2. GitHub Actions에 쓰기 권한 부여하기


직접 토큰을 발급받지 않고 기본 `GITHUB_TOKEN`을 사용할 때 가장 흔하게 발생하는 에러가 **권한 부족(Permission denied)** 이다. 기본 토큰이 레포지토리에 푸시(Push)할 수 있도록 권한을 열어주어야 한다.


1. 깃허브 레포지토리 페이지에서 **Settings** 탭으로 이동
2. 왼쪽 사이드바에서 **Actions > General** 을 클릭
3. 스크롤을 맨 아래로 내려서 **Workflow permissions** 섹션에서
{% asset_img 1774268240722.png "1774268240722.png" %}
4. **Read and write permissions** 를 선택하고 **Save** 버튼 클릭


---

<br>

# 3. GitHub 계정으로 로그인하기 위한 OAuth App 연동

{% asset_img 1774270670906.png "1774270670906.png" %}
1. GitHub 우측 상단 프로필 > Settings >  왼쪽 맨 아래 Developer settings > OAuth Apps > **New OAuth App** 클릭
{% asset_img 1774270645603.png "1774270645603.png" %}

2. 정보 입력
    * Application name: 블로그 이름
    * Homepage URL: 깃허브 블로그 주소
    * Authorization callback URL: 임시로 

3. **Register application** 클릭.
4. 화면에 나오는 **Client ID** 값 메모장에 복사
5. **Generate a new client secret** 버튼을 눌러 생성된 **Client Secret** 값도 메모장에 복사 (창을 닫으면 다시 안 보이니 꼭 복사해두기)
{% asset_img 1774271001616.png "1774271001616.png" %}
6. 현재 페이지 닫지 말고 유지해두기!


---


<br>

# 4. 로그인 중계 서버(Proxy) 만들기

## 4.1. 중계 서버용 깃허브 레포 생성

Vercel Github Import를 이용하여 프로젝트를 생성할거기 때문에 Public으로 만들어준다.
이름은 대충 지으면 됨 나같은 경우 `my-decap-proxy`로 생성

<br>

## 4.2. 소스 코드 작성

총 3가지의 파일 작성이 필요하다.

{% asset_img 1774272939034.png "1774272939034.png" %}

아래는 Decap CMS와 커스텀웹앱 모두 적용 되는 코드 

### (1) `package.json` 

```json 
{
  "name": "my-decap-proxy",
  "dependencies": {
    "simple-oauth2": "^4.3.0"
  }
}
```


### (2) `api/auth.js`

```javascript 
const { AuthorizationCode } = require('simple-oauth2');
const crypto = require('crypto');

module.exports = (req, res) => {
  const client = new AuthorizationCode({
    client: { id: process.env.OAUTH_CLIENT_ID, secret: process.env.OAUTH_CLIENT_SECRET },
    auth: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize'
    }
  });

  // state를 쿼리에서 받아서 그대로 넘겨줌
  const state = req.query.state || crypto.randomBytes(16).toString('hex');

  const authorizationUri = client.authorizeURL({
    redirect_uri: `https://${req.headers.host}/api/callback`,
    scope: 'repo,user',
    state: state  // ← Decap이 보낸 state 그대로 사용
  });

  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.redirect(authorizationUri);
};
```


### (3) `api/callback.js`

```javascript 
const { AuthorizationCode } = require('simple-oauth2');

module.exports = async (req, res) => {
  const client = new AuthorizationCode({
    client: { id: process.env.OAUTH_CLIENT_ID, secret: process.env.OAUTH_CLIENT_SECRET },
    auth: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize'
    }
  });

  try {
    const accessToken = await client.getToken({
      code: req.query.code,
      redirect_uri: `https://${req.headers.host}/api/callback`
    });

    const token = accessToken.token.access_token || accessToken.token.token?.access_token;
    const message = `authorization:github:success:{"token":"${token}","provider":"github"}`;

    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          (function() {
            var message = ${JSON.stringify(message)};
            if (window.opener) {
              var sent = false;
              function receiveMessage(e) {
                if (sent) return;
                sent = true;
                window.opener.postMessage(message, e.origin);
                window.removeEventListener('message', receiveMessage);
                setTimeout(function() { window.close(); }, 500);
              }
              window.addEventListener('message', receiveMessage);
              window.opener.postMessage('authorizing:github', '*');
              
              // 1.5초 후에도 응답 없으면 커스텀 웹앱용으로 전송
              setTimeout(function() {
                if (!sent) {
                  sent = true;
                  window.opener.postMessage(message, '*');
                  setTimeout(function() { window.close(); }, 500);
                }
              }, 1500);
            }
          })();
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    res.status(500).send("Authentication Error: " + error.message);
  }
};
```

<br>

<details>
<summary>전용 코드</summary>

Decap CMS 전용 코드
```javascript api/callback.js
const { AuthorizationCode } = require('simple-oauth2');

module.exports = async (req, res) => {
  const client = new AuthorizationCode({
    client: { id: process.env.OAUTH_CLIENT_ID, secret: process.env.OAUTH_CLIENT_SECRET },
    auth: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize'
    }
  });

  try {
    const accessToken = await client.getToken({
      code: req.query.code,
      redirect_uri: `https://${req.headers.host}/api/callback`
    });
    const token = accessToken.token.access_token || accessToken.token.token?.access_token;
    const message = `authorization:github:success:{"token":"${token}","provider":"github"}`;

    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          (function() {
            var message = ${JSON.stringify(message)};
            function receiveMessage(e) {
              window.opener.postMessage(message, e.origin);
              window.removeEventListener('message', receiveMessage);
              setTimeout(function() { window.close(); }, 500);
            }
            
            window.addEventListener('message', receiveMessage);
            window.opener.postMessage('authorizing:github', '*');
          })();
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    res.status(500).send("Authentication Error: " + error.message);
  }
};
```

<br>

커스텀 웹앱 전용 코드
```javascript api/callback.js
const { AuthorizationCode } = require('simple-oauth2');

module.exports = async (req, res) => {
  const client = new AuthorizationCode({
    client: { id: process.env.OAUTH_CLIENT_ID, secret: process.env.OAUTH_CLIENT_SECRET },
    auth: {
      tokenHost: 'https://github.com',
      tokenPath: '/login/oauth/access_token',
      authorizePath: '/login/oauth/authorize'
    }
  });

  try {
    const accessToken = await client.getToken({
      code: req.query.code,
      redirect_uri: `https://${req.headers.host}/api/callback`
    });

    const token = accessToken.token.access_token || accessToken.token.token?.access_token;
    const message = `authorization:github:success:{"token":"${token}","provider":"github"}`;

    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.send(`
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage(${JSON.stringify(message)}, '*');
          }
          setTimeout(function() { window.close(); }, 300);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send("Authentication Error: " + error.message);
  }
};
```
</details>

<br>

## 4.3. Vercel 프로젝트 생성 및 환경변수 설정

- 5.1 에서 생성했던 깃허브 레포 연결해주고 
- **Environment variables** 에 [3](#3-GitHub-계정으로-로그인하기-위한-OAuth-App-연동
)에서 복사해뒀던 Client ID랑 Client secret을 `OAUTH_CLIENT_ID`,`OAUTH_CLIENT_SECRET`로 각각 붙여넣어준다.

{% asset_img 1774272055645.png "1774272055645.png" %}


## 4.4. 깃허브 Oauth 설정 페이지 수정하기

[3](#3-GitHub-계정으로-로그인하기-위한-OAuth-App-연동
)에서 임시로 써뒀던 **Authorization callback URL** 에 `{프로젝트이름}.vercel.app/callback` or `{vercel 배포 주소}/callback`으로 수정해주기



---

<br>

# 5. 웹 기반 글쓰기 환경 구성

## 5.1.  Decap CMS(관리자 페이지) 연동하기


참고 : [Decap CMS 튜토리얼](https://decapcms.org/docs/basic-steps/)

{% asset_img 1774268384658.png "1774268384658.png" %}

* source 폴더 내에 admin 폴더를 생성하고
* admin 폴더 안에 index.html과 config.yml 파일을 만든다.



<br>

### (1) `index.html` 작성


```html source/admin/index.html
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


### (2) `config.yml` 작성

<details>
<summary>post 구조</summary>
```markdown scaffolds/post.md
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
    * `{% asset_img file_path "alt text" %}` 태그를 사용함 
    * 이때  file_path는 폴더명을 제외한 이미지 파일명만 사용함
    * 현재 로컬에서 글 작성시: *[이미지 캡쳐 > 클립보드 붙여넣기 > 자동 마크다운 문법으로 작성됨 > 글 작성 완료 후 게시글 제목 폴더로 이미지 이동 > 마크다운 문법 hexo 태그로 수정]*
</details>

```yaml source/admin/config.yml
backend:
  name: github
  repo: {유저이름}/{repo 이름}
  branch: source # 소스 코드가 있는 브랜치
  base_url: https://{프로젝트이름}.vercel.app #버셀 배포 주소
  auth_endpoint: /api/auth 
  

publish_mode: editorial_workflow


media_folder: "source/images" # 이미지 저장 경로
public_folder: "/images"


collections:
  - name: "post"
    label: "Post"
    folder: "source/_posts"
    create: true
    slug: "{{slug}}"
    media_folder: "{{slug}}"
    public_folder: ""
    fields:
      - {label: "Title", name: "title", widget: "string"}
      - {label: "Publish Date", name: "date", widget: "datetime", default: "{{now}}", format: "YYYY-MM-DD HH:mm:ss"}
      - {label: "Author", name: "author", widget: "string", default: "이름"}
      - {label: "Cover Image", name: "cover", widget: "image", required: false, media_folder: "/source/gallery/cover", public_folder: "/gallery/cover"}
      - {label: "Categories", name: "categories", widget: "list", required: false}
      - {label: "Tags", name: "tags", widget: "list", required: false}
      - {label: "Body", name: "body", widget: "markdown", default: "\n\n<!-- more -->\n\n"}
```

* Decap CMS가 알아서 글 제목과 똑같은 이름의 폴더를 생성 
* 컬렉션(Post) 안쪽에 작성된 설정을 최우선으로 적용됨
* 상단의 전역 설정은 Media 탭에서 단독으로 이미지를 관리할때 임시로 사용되는 기본(Fallback) 폴더(Decap CMS 시스템상 전역 media_folder는 필수 입력값이기 때문에 지우지 못하고 남겨둔 것)


### (3) 이미지 자동 변환 스크립트 추가


Hexo는 scripts/ 폴더 안에 자바스크립트 파일을 넣어두면 배포(Build)할 때 알아서 실행한다. 로컬에서 수작업으로 했던 작업을 스크립트로 작성하여 마크다운을 HTML로 변환하기 직전에 `![alt ]()`를 찾아서 `{% asset_img %}`로 바꿔주는 스크립트를 추가했다.


```js srcipts/auto-asset-img.js
'use strict';

hexo.extend.filter.register('before_post_render', function(data) {
  // 마크다운 이미지 정규식: {% asset_img 이미지경로 "alt 텍스트" %}
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  data.content = data.content.replace(regex, function(match, alt, path) {
    // 1. 인터넷 외부 링크(http://, https://)는 변환하지 않고 그대로 둠
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return match;
    }

    // 2. 경로에서 파일명만 추출 (예: folder/image.png -> image.png)
    const fileName = path.split('/').pop();

    // 3. Hexo의 asset_img 태그로 변환하여 리턴 (배포할 때만 적용됨)
    return `{% asset_img ${fileName} "${alt}" %}`;
  });

  return data;
});
```

* 글을 쓸때는 에디터 본문에 이미지 드래그 앤 드롭,클립보드 붙여넣기, 마크다운 문법으로 쓰고
* 글 저장해서 레포지토리에도 순수 마크다운 문법으로 들어감
* 깃허브 액션돌아가서 배포 시작하면 스크립트 돌아가서 hexo 코드로 변환

### (4) `_config.yml`에 skip_render 옵션 추가

Hexo는 `source` 폴더에 있는 .md 파일을 토대로 html 파일을 만들기 때문에 배포할때 admin폴더에 있는 config.yml 파일을 단순 설정 파일로 오해하고 최종 결과물에 복사하지 않고 뺄 수 있다.

직접 만든 Decap CMS 폴더와 커스텀 웹앱 폴더는 건드리지말고 그대로 배포해달라는 예외 처리(skip) 설정을 추가해줘야 한다

```yaml _config.yml
# Directory 부분에 추가
skip_render:
    - admin/**
```




### (5) 실제 사용해보기

{% asset_img 1774276738920.png "1774276738920.png" %} {% asset_img 1774276827560.png "1774276827560.png" %}

로그인 화면

<br>

{% asset_img 1774276847340.png "1774276847340.png" %}

글 목록

<br>

{% asset_img 1774277107076.png "1774277107076.png" %}

글 임시저장

{% asset_img 1774277146253.png "1774277146253.png" %}

글 임시 저장 시 브랜치 생성 모습

<br>

{% asset_img 1774277226774.png "1774277226774.png" %}

게시글 테스트 커밋 모습

{% asset_img 1774277277546.png "1774277277546.png" %}

게시글 테스트 actions 모습

<br>

후기:
1. sync 스크롤링 안됨
2. 이미지 업로드는 rich text 모드에서만 되는데 마크다운 모드에서 편집하다가 전환하면 가장 아래로 강제 스크롤당함
3. 이미지 드래그앤드랍, 클립보드 붙여넣기 안됨
4. 한번 제목을 짓고 save하면 slug가 확정되어 제목 수정하지 못함
5. 웹 성격상 글 쓰다가 날라갈까봐 임시저장을 많이하는데 그게 PR에 커밋기록으로 다 남고, Merge 커밋도 남아서 마음에 들지 않음

<br>

## 5.2. TOAST UI Editor 이용하여 커스텀 웹앱 구축하기

Decap CMS를 실제 사용해보니 불편한점이 많아서 우선 sync 스크롤이랑 클립보드 붙여넣기, 이미지 드래그앤드랍이되는  toast ui editor만  decap cms body에 붙이려다가 그냥 커스텀 웹앱으로 변경하기로 했다.

 {% asset_img 1774278785277.png "1774278785277.png" %}

여기라고 쓰여있는 card 섹션에 깃허브 로그인 버튼과 에디터를 넣고 싶어서  `hexo new page "post"` 명령어로 우선 로컬 public 폴더에 index.html을 생성한 뒤 클로드와 함께 작업함

참고: [TOAST UI Editor](https://ui.toast.com/tui-editor)

<br>

설계 방향

1. 임시저장 draft 브랜치로 관리하는대신, 이름을 타임스탬프로 관리하여 **글 제목 변경하여도 적용** 될 수 있게
2. 커버 이미지, 본문 이미지 등 하나하나 커밋하지 말고 **임시 저장시 한꺼번에 실제 본문에 사용된 이미지만 커밋** 될 수 있게 Tree API 사용
3. 로그인 토큰 있으면 글 상세 페이지에 수정, 삭제 버튼 보이게 하기
4. 발행, 수정 시 **배포 완료 된 후 배포 된 글로 이동** 하게 하기 (삭제는 홈화면으로)
5. 클립보드 붙여넣기 시 base64로 인코딩 되는데 편집당시에는 사용자가 이미지를 볼 수 있게하기위해 그대로 보여주고, 깃허브에 저장(임시저장, 발행, 수정)시에는 alt text에 넣어뒀던 파일명으로 저장되게하고, 발행시에는 hexo 코드로 `{% %}` 로 수정되게, 임시저장목록에서 불러오거나 수정할때는 사용자에게 이미지가 보여야하기 때문에 마크다운 문법 및  raw content 주소로 `{% asset_img {file_path} "file_path" %}` 
    -  요약하면 사용자는 그냥 편하게 이미지 붙여넣기, 드래그앤드랍 가능(이땐 이미지 주소가 base64인코딩)
    - source/_post 폴더에는 hexo 문법으로 저장되고, draft 브랜치에는 마크다운 문법으로 저장됨
    - 수정하기, 임시저장 불러오기(이땐 이미지 주소가 raw.githubusercontent.com)도 마크다운 문법으로 변경되어  이미지 모두 에디터에서 볼 수 있음
6. 임시저장 기록 남기지 않기 위해 pr->merge 대신 직접 **source 브랜치에 커밋 -> draft 브랜치 삭제**
7. 수정하기 -> 임시저장 -> 임시저장 목록에서 불러오기 해도 `_edit_slug` 옵션으로 수정하기 state 유지하기(Commit 메세지도 Update로)



### (1) `index.html` 작성

```html source/post/index.html
<!doctype html><html lang="ko"><head>
<!-- 생략 -->
<link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor.min.css" />
<link rel="stylesheet" href="/post/style.css" /></head>
<!-- 생략 -->

<section class="section">
  <div class="container">
    <div class="columns">
      <div class="column order-2 column-main is-12">
        <div class="card">
          <article class="card-content article" role="article">
            <div class="content" style="margin-top: 0;">

              <div id="login-section">
                <p>글을 쓰려면 GitHub 계정으로 로그인하세요</p>
                <button class="btn-github" onclick="loginWithGitHub()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub으로 로그인
                </button>
              </div>

              <div id="editor-section">
                <input type="text" id="title-input" placeholder="제목을 입력하세요" />
                <div class="meta-row">
                  <div class="meta-field">
                    <label>날짜</label>
                    <input type="datetime-local" id="date-input" class="meta-input" />
                  </div>
                  <div class="meta-field">
                    <label>카테고리</label>
                    <div class="tags-wrap" id="cat-wrap" onclick="document.getElementById('cat-input').focus()">
                      <input type="text" id="cat-input" class="tag-input-inline" placeholder="입력 후 Enter" />
                    </div>
                  </div>
                  <div class="meta-field">
                    <label>태그</label>
                    <div class="tags-wrap" id="tag-wrap" onclick="document.getElementById('tag-input').focus()">
                      <input type="text" id="tag-input" class="tag-input-inline" placeholder="입력 후 Enter" />
                    </div>
                  </div>
                </div>
                <div class="cover-row">
                  <label>커버 이미지</label>
                  <button class="cover-btn" onclick="document.getElementById('cover-file').click()">파일 선택</button>
                  <input type="file" id="cover-file" accept="image/*" style="display:none" onchange="handleCover(event)" />
                  <span id="cover-name">선택된 파일 없음</span>
                  <button class="cover-btn" id="cover-remove-btn" onclick="removeCover()" style="display:none; color:#ff3860; border-color:#ff3860">✕ 제거</button>
                </div>
                <div id="toast-editor"></div>
                <div class="action-row">
                  <span id="status-msg"></span>
                  <button class="btn-list" onclick="openDraftModal()">임시저장 목록</button>
                  <button id="btn-save-draft" class="btn-draft" onclick="saveDraft()" disabled>임시저장</button>
                  <button class="btn-publish" onclick="publishPost()">발행하기</button>
                </div>
              </div>

            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="modal-overlay" id="draft-modal" onclick="closeDraftModal(event)">
  <div class="modal-box">
    <div class="modal-header">
      <h3>임시저장 목록</h3>
      <button class="modal-close" onclick="closeDraftModal()">×</button>
    </div>
    <div class="modal-body" id="draft-list">
      <div class="modal-empty">불러오는 중...</div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="cover-modal" onclick="document.getElementById('cover-modal').classList.remove('show')">
  <div style="max-width:80vw; max-height:80vh;">
    <img id="cover-modal-img" style="max-width:100%; max-height:80vh; border-radius:6px;" />
  </div>
</div>

<!-- 생략 -->
<script src="https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js"></script>
<div id="toast-msg"></div>
<div id="loading"><div class="spinner"></div><div id="loading-msg">처리 중...</div><div id="loading-sub"></div></div>
<script src="/post/script.js"></script>

<!-- 생략 -->
</body></html>
```


### (2) `script.js` 작성

```javascript source/post/script.js
const REPO = '깃허브이름/깃허브레포이름';
const BRANCH = '소스파일 브랜치이름';
const OAUTH_BASE = 'https://{버셀 프로젝트 이름}.vercel.app';

let token = localStorage.getItem('gh_token') || null;
let editor = null;
let categories = [];
let tags = [];
let coverBase64 = null;
let coverFile = null;
let currentDraftBranch = null;
let originalPostSlug = null;
let isDirty = false;
const pendingImages = new Map();

// ── 초기화 ──────────────────────────────────────────────────

window.addEventListener('message', function (e) {
    if (typeof e.data === 'string' && e.data.startsWith('authorization:github:success:')) {
        const data = JSON.parse(e.data.replace('authorization:github:success:', ''));
        token = data.token;
        localStorage.setItem('gh_token', token);
        showEditor();
    }
});

window.onload = async function () {
    setupTagInput('cat-input', 'cat-wrap', categories);
    setupTagInput('tag-input', 'tag-wrap', tags);

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('date-input').value = now.toISOString().slice(0, 16);

    document.getElementById('title-input').addEventListener('input', function () {
        document.getElementById('btn-save-draft').disabled = false;
        isDirty = true;
    });

    window.addEventListener('beforeunload', function (e) {
        if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    });

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (document.getElementById('editor-section').style.display !== 'none') saveDraft();
        }
    });

    if (token) {
        showEditor();
        const editSlug = new URLSearchParams(window.location.search).get('edit');
        if (editSlug) await loadPost(editSlug);
    }
};

function loginWithGitHub() {
    window.open(OAUTH_BASE + '/api/auth?provider=github&scope=repo', 'github-oauth', 'width=600,height=700,left=200,top=100');
}

function showEditor() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('editor-section').style.display = 'block';
    if (!editor) initEditor();
}

function initEditor() {
    editor = new toastui.Editor({
        el: document.getElementById('toast-editor'),
        height: '600px',
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        initialValue: '\n\n<!-- more -->\n\n',
        placeholder: '내용을 입력하세요...',
        hooks: {
            addImageBlobHook: async function (blob, callback) {
                try {
                    const ext = blob.type.split('/')[1] || 'png';
                    const filename = `${Date.now()}.${ext}`;
                    const base64 = await blobToBase64(blob);
                    pendingImages.set(filename, { base64, mimeType: blob.type });
                    // alt에 파일명 저장 → replaceDataUrlsWithFilenames에서 교체할 때 사용
                    callback(`data:${blob.type};base64,${base64}`, filename);
                } catch (e) {
                    showToast('이미지 처리 실패: ' + e.message, 'error');
                }
            }
        }
    });
    editor.on('change', function () {
        document.getElementById('btn-save-draft').disabled = false;
        isDirty = true;
    });
}

// ── GitHub API ──────────────────────────────────────────────

async function createBranch(branchName, fromBranch = BRANCH) {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const refRes = await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/${fromBranch}`, { headers });
    if (!refRes.ok) throw new Error('브랜치 정보를 가져올 수 없어요');
    const refData = await refRes.json();
    const res = await fetch(`https://api.github.com/repos/${REPO}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: refData.object.sha })
    });
    if (!res.ok) throw new Error('브랜치 생성 실패');
    return res.json();
}

async function deleteBranch(branchName) {
    await fetch(`https://api.github.com/repos/${REPO}/git/refs/heads/${branchName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

async function githubCommitAll(files, message, targetBranch = BRANCH) {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const apiBase = `https://api.github.com/repos/${REPO}`;

    const refRes = await fetch(`${apiBase}/git/ref/heads/${targetBranch}`, { headers });
    if (!refRes.ok) throw new Error('브랜치 정보를 가져올 수 없어요');
    const latestCommitSha = (await refRes.json()).object.sha;

    const commitData = await (await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers })).json();
    const baseTreeSha = commitData.tree.sha;

    const treeItems = await Promise.all(files.map(async (file) => {
        if (file.sha !== undefined) {
            return { path: file.path, mode: '100644', type: 'blob', sha: file.sha };
        }
        const blobRes = await fetch(`${apiBase}/git/blobs`, {
            method: 'POST', headers,
            body: JSON.stringify({ content: file.base64, encoding: 'base64' })
        });
        if (!blobRes.ok) throw new Error(`blob 생성 실패: ${file.path}`);
        return { path: file.path, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha };
    }));

    const treeRes = await fetch(`${apiBase}/git/trees`, {
        method: 'POST', headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    if (!treeRes.ok) throw new Error('tree 생성 실패');

    const newCommitRes = await fetch(`${apiBase}/git/commits`, {
        method: 'POST', headers,
        body: JSON.stringify({ message, tree: (await treeRes.json()).sha, parents: [latestCommitSha] })
    });
    if (!newCommitRes.ok) throw new Error('commit 생성 실패');
    const newCommit = await newCommitRes.json();

    const updateRes = await fetch(`${apiBase}/git/refs/heads/${targetBranch}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ sha: newCommit.sha })
    });
    if (!updateRes.ok) throw new Error('브랜치 업데이트 실패');
    return newCommit;
}

function blobToBase64(blob) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(blob);
    });
}

// ── 유틸 ────────────────────────────────────────────────────

// 에디터 상태 초기화
function resetEditor() {
    document.getElementById('title-input').value = '';
    categories.length = 0;
    renderChips('cat-wrap', categories, 'cat-input');
    tags.length = 0;
    renderChips('tag-wrap', tags, 'tag-input');
    coverBase64 = null;
    coverFile = null;
    const nameEl = document.getElementById('cover-name');
    nameEl.textContent = '선택된 파일 없음';
    nameEl.classList.remove('has-cover');
    nameEl.onclick = null;
    document.getElementById('cover-remove-btn').style.display = 'none';
    document.getElementById('cover-file').value = '';
    pendingImages.clear();
    if (editor) editor.setMarkdown('\n\n<!-- more -->\n\n');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('date-input').value = now.toISOString().slice(0, 16);
    currentDraftBranch = null;
    originalPostSlug = null;
    isDirty = false;
    document.getElementById('btn-save-draft').disabled = true;
    const publishBtn = document.querySelector('.btn-publish');
    publishBtn.textContent = '발행하기';
    publishBtn.onclick = publishPost;
    setStatus('');
}

// front matter 파싱 후 에디터에 적용
async function applyFrontMatter(fm, body, branchForImages, slugForImages) {
    // 항상 초기화 먼저
    categories.length = 0;
    renderChips('cat-wrap', categories, 'cat-input');
    tags.length = 0;
    renderChips('tag-wrap', tags, 'tag-input');
    coverBase64 = null;
    coverFile = null;
    pendingImages.clear();
    const nameEl = document.getElementById('cover-name');
    nameEl.textContent = '선택된 파일 없음';
    nameEl.classList.remove('has-cover');
    nameEl.onclick = null;
    document.getElementById('cover-remove-btn').style.display = 'none';

    const titleMatch = fm.match(/^title:\s*"?(.+?)"?\s*$/m);
    if (titleMatch) document.getElementById('title-input').value = titleMatch[1].trim();

    const dateMatch = fm.match(/^date:\s*(.+)$/m);
    if (dateMatch) {
        const d = new Date(dateMatch[1].trim());
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('date-input').value = d.toISOString().slice(0, 16);
    }

    const catMatch = fm.match(/^categories:\n((?:  - .+\n?)*)/m);
    if (catMatch) {
        catMatch[1].match(/  - (.+)/g)?.forEach(c => categories.push(c.replace('  - ', '').trim()));
        renderChips('cat-wrap', categories, 'cat-input');
    }

    const tagMatch = fm.match(/^tags:\n((?:  - .+\n?)*)/m);
    if (tagMatch) {
        tagMatch[1].match(/  - (.+)/g)?.forEach(t => tags.push(t.replace('  - ', '').trim()));
        renderChips('tag-wrap', tags, 'tag-input');
    }

    const coverMatch = fm.match(/^cover:\s*(.+)$/m);
    if (coverMatch) {
        const coverPath = coverMatch[1].trim();
        nameEl.textContent = coverPath.split('/').pop();
        nameEl.classList.add('has-cover');
        nameEl.onclick = () => {
            document.getElementById('cover-modal-img').src = `data:image/jpeg;base64,${coverBase64}`;
            document.getElementById('cover-modal').classList.add('show');
        };
        document.getElementById('cover-remove-btn').style.display = 'inline-block';
        const rawUrl = `https://raw.githubusercontent.com/${REPO}/${branchForImages}/source${coverPath}`;
        const imgBlob = await (await fetch(rawUrl)).blob();
        coverBase64 = await blobToBase64(imgBlob);
        coverFile = { name: coverPath.split('/').pop() };
    }

    // 이미지 raw URL로 교체 (저장된 파일명은 파일명 그대로, asset_img는 raw URL로)
    const bodyWithUrls = body
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (match, alt, src) {
            if (src.startsWith('http')) return match;
            return `{% asset_img ${src} "${alt}" %}`;
        })
        .replace(/\{%\s*asset_img\s+"?([^"\s%]+)"?\s*"?([^"%]*?)"?\s*%\}/g, function (match, filename, alt) {
            return `{% asset_img ${filename} "${alt.trim()}" %}`;
        });
    editor.setMarkdown(bodyWithUrls);

    // setMarkdown이 change 이벤트 발생시키므로 dirty 플래그 초기화
    setTimeout(() => {
        isDirty = false;
        document.getElementById('btn-save-draft').disabled = true;
    }, 0);
}

// 커버+이미지 파일 목록 빌드
function buildFileList(slug) {
    const files = [];
    let coverPath = '';

    if (coverBase64 && coverFile) {
        const ext = coverFile.name.split('.').pop();
        files.push({ path: `source/gallery/cover/${slug}.${ext}`, base64: coverBase64 });
        coverPath = `/gallery/cover/${slug}.${ext}`;
    }

    const markdown = replaceDataUrlsWithFilenames(editor.getMarkdown());

    for (const [filename, { base64 }] of pendingImages) {
        if (markdown.includes(filename)) {
            files.push({ path: `source/_posts/${slug}/${filename}`, base64 });
        }
    }

    return { files, coverPath, markdown };
}

// data URL → 파일명 교체
// addImageBlobHook에서 alt에 파일명을 저장했으므로 alt 기반으로 교체
function replaceDataUrlsWithFilenames(markdown) {
    let result = markdown;

    // {% asset_img data:... "파일명" %} → {% asset_img 파일명 "파일명" %} 교체 (alt 기반)
    result = result.replace(
        /!\[([^\]]+)\]\(data:image\/[^;]+;base64,[^)]+\)/g,
        function (match, alt) {
            if (pendingImages.has(alt)) return `{% asset_img ${alt} "${alt}" %}`;
            return match;
        }
    );

    // raw URL → 파일명
    result = result.replace(
        /!\[([^\]]*)\]\(https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^?\s)]+\/source\/_?posts\/[^/]+\/([^)\s]+)\)/g,
        '{% asset_img $2 "$1" %}'
    );

    return result;
}

// 마크다운에서 이미지 태그를 asset_img로 변환
function convertToAssetImg(markdown) {
    return markdown.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        function (match, alt, path) {
            const filename = path.split('/').pop();
            if (path.startsWith('http://') || path.startsWith('https://')) {
                if (path.includes('raw.githubusercontent.com')) {
                    return `{% asset_img ${filename} "${alt}" %}`;
                }
                return match;
            }
            return `{% asset_img ${filename} "${alt}" %}`;
        }
    );
}

function setupTagInput(inputId, wrapId, arr) {
    const input = document.getElementById(inputId);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = input.value.trim();
            if (val && !arr.includes(val)) { arr.push(val); renderChips(wrapId, arr, inputId); }
            input.value = '';
        } else if (e.key === 'Backspace' && input.value === '' && arr.length > 0) {
            arr.pop(); renderChips(wrapId, arr, inputId);
        }
    });
}

function renderChips(wrapId, arr, inputId) {
    const wrap = document.getElementById(wrapId);
    const input = document.getElementById(inputId);
    wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
    arr.forEach((val, i) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${val}<button type="button" onclick="removeChip('${wrapId}','${inputId}',${i})">×</button>`;
        wrap.insertBefore(chip, input);
    });
}

function removeChip(wrapId, inputId, idx) {
    const arr = wrapId === 'cat-wrap' ? categories : tags;
    arr.splice(idx, 1);
    renderChips(wrapId, arr, inputId);
}

function handleCover(e) {
    const file = e.target.files[0];
    if (!file) return;
    coverFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
        coverBase64 = ev.target.result.split(',')[1];
        const nameEl = document.getElementById('cover-name');
        nameEl.textContent = file.name;
        nameEl.classList.add('has-cover');
        nameEl.onclick = () => {
            document.getElementById('cover-modal-img').src = `data:image/jpeg;base64,${coverBase64}`;
            document.getElementById('cover-modal').classList.add('show');
        };
        document.getElementById('cover-remove-btn').style.display = 'inline-block';
        isDirty = true;
    };
    reader.readAsDataURL(file);
}

function removeCover() {
    coverFile = null; coverBase64 = null;
    const nameEl = document.getElementById('cover-name');
    nameEl.textContent = '선택된 파일 없음';
    nameEl.classList.remove('has-cover');
    nameEl.onclick = null;
    document.getElementById('cover-remove-btn').style.display = 'none';
    document.getElementById('cover-file').value = '';
    isDirty = true;
}

function generateSlug(title) {
    return title.trim().replace(/\s+/g, '-').replace(/[^\w\uAC00-\uD7A3가-힣-]/g, '').substring(0, 100);
}

function formatDate(val) {
    const d = new Date(val);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function buildFrontMatter(title, date, cover, editSlug = null) {
    let fm = '---\n';
    fm += `title: "${title}"\n`;
    fm += `date: ${formatDate(date)}\n`;
    fm += `author: {작성자}\n`;
    if (cover) fm += `cover: ${cover}\n`;
    if (editSlug) fm += `_edit_slug: ${editSlug}\n`;
    if (categories.length) { fm += 'categories:\n'; categories.forEach(c => fm += `  - ${c}\n`); }
    if (tags.length) { fm += 'tags:\n'; tags.forEach(t => fm += `  - ${t}\n`); }
    fm += '---\n\n';
    return fm;
}

// ── 임시저장 ────────────────────────────────────────────────

async function saveDraft() {
    const title = document.getElementById('title-input').value.trim();
    if (!title) { showToast('제목을 입력하세요', 'error'); return; }
    showLoading('임시저장 중...');
    try {
        const slug = generateSlug(title);
        const date = document.getElementById('date-input').value;

        if (!currentDraftBranch) {
            currentDraftBranch = `draft/${Date.now()}`;
            await createBranch(currentDraftBranch);
        }

        const { files, coverPath, markdown } = buildFileList(slug);
        const mdContent = buildFrontMatter(title, date, coverPath, originalPostSlug) + convertToAssetImg(markdown);
        files.push({ path: `source/_posts/${slug}.md`, base64: btoa(unescape(encodeURIComponent(mdContent))) });

        await githubCommitAll(files, `Draft: ${title}`, currentDraftBranch);
        pendingImages.clear();
        isDirty = false;

        document.getElementById('btn-save-draft').disabled = true;
        const now = new Date();
        const p = n => String(n).padStart(2, '0');
        setStatus(`${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())} 임시저장됨`);
        setTimeout(() => setStatus(''), 4000);
        showToast('임시저장 완료', 'success');
    } catch (e) {
        showToast('저장 실패: ' + e.message, 'error');
    } finally { hideLoading(); }
}

// ── 발행 ────────────────────────────────────────────────────

async function publishPost() {
    const title = document.getElementById('title-input').value.trim();
    if (!title) { showToast('제목을 입력하세요', 'error'); return; }
    showLoading('발행 중...');
    try {
        const slug = generateSlug(title);
        const date = document.getElementById('date-input').value;

        const { files, coverPath, markdown } = buildFileList(slug);

        // 임시저장 후 발행 시 draft 브랜치에 있는 이미지를 source로 복사
        if (currentDraftBranch) {
            const folderRes = await fetch(
                `https://api.github.com/repos/${REPO}/contents/source/_posts/${slug}?ref=${currentDraftBranch}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (folderRes.ok) {
                (await folderRes.json()).forEach(f => {
                    if (!f.name.endsWith('.md') && !files.some(existing => existing.path === `source/_posts/${slug}/${f.name}`)) {
                        files.push({ path: `source/_posts/${slug}/${f.name}`, sha: f.sha });
                    }
                });
            }
        }

        const mdContent = buildFrontMatter(title, date, coverPath) + convertToAssetImg(markdown);
        files.push({ path: `source/_posts/${slug}.md`, base64: btoa(unescape(encodeURIComponent(mdContent))) });

        await githubCommitAll(files, `Create Post "${title}"`);

        if (currentDraftBranch) {
            await deleteBranch(currentDraftBranch);
            currentDraftBranch = null;
        }

        pendingImages.clear();
        isDirty = false;
        hideLoading();
        showToast('발행 완료! 배포 대기 중...', 'success');
        await waitForDeploy(slug, date);
    } catch (e) {
        showToast('발행 실패: ' + e.message, 'error');
    } finally { hideLoading(); }
}

// ── 임시저장 목록 ────────────────────────────────────────────

async function openDraftModal() {
    document.getElementById('draft-modal').classList.add('show');
    await refreshDraftList();
}

async function refreshDraftList() {
    const listEl = document.getElementById('draft-list');
    listEl.innerHTML = '<div class="modal-empty">불러오는 중...</div>';
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/branches?per_page=100&_=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('목록을 불러올 수 없어요');
        const draftBranches = (await res.json()).filter(b => b.name.startsWith('draft/'));

        if (draftBranches.length === 0) {
            listEl.innerHTML = '<div class="modal-empty">임시저장된 글이 없어요</div>';
            return;
        }

        const items = await Promise.all(draftBranches.map(async (b) => {
            try {
                const compareRes = await fetch(
                    `https://api.github.com/repos/${REPO}/compare/${BRANCH}...${b.name}?_=${Date.now()}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (!compareRes.ok) return null;
                const compareData = await compareRes.json();

                const md = compareData.files?.find(f =>
                    f.filename.endsWith('.md') &&
                    f.filename.startsWith('source/_posts/') &&
                    (f.status === 'added' || f.status === 'modified')
                );
                if (!md) return null;

                const contentData = await (await fetch(md.contents_url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })).json();
                const content = decodeURIComponent(escape(atob(contentData.content.replace(/\n/g, ''))));
                const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
                const title = titleMatch ? titleMatch[1].trim() : md.filename.split('/').pop().replace('.md', '');

                return { branch: b.name, mdPath: md.filename, title };
            } catch (e) { return null; }
        }));

        const validItems = items.filter(Boolean);
        if (validItems.length === 0) {
            listEl.innerHTML = '<div class="modal-empty">임시저장된 글이 없어요</div>';
            return;
        }

        listEl.innerHTML = validItems.map(item => `
            <div class="draft-item" onclick="loadDraft('${item.branch}', '${item.mdPath}')">
                <div>
                    <div class="draft-item-title">${item.title}</div>
                    <div class="draft-item-meta">${item.branch}</div>
                </div>
                <button class="draft-item-del" onclick="deleteDraft(event, '${item.branch}')" title="삭제">🗑️</button>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<div class="modal-empty">오류: ${e.message}</div>`;
    }
}

function closeDraftModal(e) {
    if (!e || e.target === document.getElementById('draft-modal')) {
        document.getElementById('draft-modal').classList.remove('show');
    }
}

async function loadDraft(branchName, mdPath) {
    try {
        showLoading('불러오는 중...');
        const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${mdPath}?ref=${branchName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('파일을 가져올 수 없어요');
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);

        if (fmMatch) {
            const slug = mdPath.replace('source/_posts/', '').replace('.md', '');
            await applyFrontMatter(fmMatch[1], fmMatch[2], branchName, slug);

            // _edit_slug 있으면 수정 모드 복원
            const editSlugMatch = fmMatch[1].match(/^_edit_slug:\s*(.+)$/m);
            if (editSlugMatch) {
                originalPostSlug = editSlugMatch[1].trim();
                const publishBtn = document.querySelector('.btn-publish');
                publishBtn.textContent = '수정하기';
                publishBtn.onclick = () => updatePost(originalPostSlug);
            } else {
                originalPostSlug = null;
                const publishBtn = document.querySelector('.btn-publish');
                publishBtn.textContent = '발행하기';
                publishBtn.onclick = publishPost;
            }
        } else {
            originalPostSlug = null;
            const publishBtn = document.querySelector('.btn-publish');
            publishBtn.textContent = '발행하기';
            publishBtn.onclick = publishPost;
        }

        currentDraftBranch = branchName;
        document.getElementById('draft-modal').classList.remove('show');
        setStatus('임시저장에서 불러옴');
        setTimeout(() => setStatus(''), 4000);
        showToast('불러오기 완료', 'success');
    } catch (e) {
        showToast('불러오기 실패: ' + e.message, 'error');
    } finally { hideLoading(); }
}

async function deleteDraft(e, branchName) {
    e.stopPropagation();
    if (!confirm('임시저장을 삭제할까요?')) return;
    try {
        await deleteBranch(branchName);
        if (currentDraftBranch === branchName) currentDraftBranch = null;
        showToast('삭제됐어요', '');
        document.getElementById('draft-modal').classList.add('show');
        await refreshDraftList();
    } catch (e) {
        showToast('삭제 실패: ' + e.message, 'error');
    }
}

// ── 글 수정 ─────────────────────────────────────────────────

async function loadPost(slug) {
    showLoading('글 불러오는 중...');
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/contents/source/_posts/${slug}.md?ref=${BRANCH}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('글을 찾을 수 없어요');
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));

        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
        if (fmMatch) {
            await applyFrontMatter(fmMatch[1], fmMatch[2], BRANCH, slug);
        }

        originalPostSlug = slug;
        currentDraftBranch = null;
        const publishBtn = document.querySelector('.btn-publish');
        publishBtn.textContent = '수정하기';
        publishBtn.onclick = () => updatePost(slug);

        setStatus('글 불러옴');
        setTimeout(() => setStatus(''), 4000);
    } catch (e) {
        showToast('불러오기 실패: ' + e.message, 'error');
    } finally { hideLoading(); }
}

async function updatePost(originalSlug) {
    const title = document.getElementById('title-input').value.trim();
    if (!title) { showToast('제목을 입력하세요', 'error'); return; }
    showLoading('수정 중...');
    try {
        const newSlug = generateSlug(title);
        const date = document.getElementById('date-input').value;

        const { files, coverPath, markdown } = buildFileList(newSlug);

        if (originalSlug !== newSlug) {
            const folderRes = await fetch(`https://api.github.com/repos/${REPO}/contents/source/_posts/${originalSlug}?ref=${BRANCH}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (folderRes.ok) {
                (await folderRes.json()).forEach(f => {
                    files.push({ path: `source/_posts/${newSlug}/${f.name}`, sha: f.sha });
                    files.push({ path: `source/_posts/${originalSlug}/${f.name}`, sha: null });
                });
            }
            files.push({ path: `source/_posts/${originalSlug}.md`, sha: null });
        }

        // 임시저장 후 수정 시 draft 브랜치 이미지 복사
        if (currentDraftBranch) {
            const folderRes = await fetch(
                `https://api.github.com/repos/${REPO}/contents/source/_posts/${newSlug}?ref=${currentDraftBranch}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (folderRes.ok) {
                (await folderRes.json()).forEach(f => {
                    if (!f.name.endsWith('.md') && !files.some(existing => existing.path === `source/_posts/${newSlug}/${f.name}`)) {
                        files.push({ path: `source/_posts/${newSlug}/${f.name}`, sha: f.sha });
                    }
                });
            }
        }

        const mdContent = buildFrontMatter(title, date, coverPath) + convertToAssetImg(markdown);
        files.push({ path: `source/_posts/${newSlug}.md`, base64: btoa(unescape(encodeURIComponent(mdContent))) });

        await githubCommitAll(files, `Update Post "${title}"`);
        pendingImages.clear();
        isDirty = false;

        if (currentDraftBranch) {
            await deleteBranch(currentDraftBranch);
            currentDraftBranch = null;
        }

        document.querySelector('.btn-publish').onclick = () => updatePost(newSlug);
        hideLoading();
        showToast('수정 완료! 배포 대기 중...', 'success');
        await waitForDeploy(newSlug, date);
    } catch (e) {
        showToast('수정 실패: ' + e.message, 'error');
    } finally { hideLoading(); }
}

// ── 배포 대기 ────────────────────────────────────────────────

async function waitForDeploy(slug, dateVal) {
    showLoading('배포 중...');
    document.getElementById('loading-sub').textContent = '배포가 완료되면 발행된 글로 이동합니다';

    // 발행 시점 기록 (이 이후에 생성된 run만 감지)
    const deployStartTime = Date.now();
    await new Promise(r => setTimeout(r, 3000));

    const headers = { 'Authorization': `Bearer ${token}` };
    const maxTries = 24; // 최대 2분

    for (let i = 0; i < maxTries; i++) {
        try {
            const res = await fetch(
                `https://api.github.com/repos/${REPO}/actions/runs?per_page=5`,
                { headers }
            );
            const data = await res.json();
            const runs = data.workflow_runs || [];

            // 발행 시점 이후에 생성된 run과 'pages build and deployment' 찾기
            const run = runs.find(r => 
                r.name === 'pages build and deployment' &&
                new Date(r.created_at).getTime() > deployStartTime - 10000
            );

            if (run) {
                if (run.status === 'completed' && run.conclusion === 'success') {
                    document.getElementById('loading-msg').textContent = '배포 완료! 이동 중...';
                    document.getElementById('loading-sub').textContent = '';
                    const d = new Date(dateVal);
                    const p = n => String(n).padStart(2, '0');
                    const datePath = `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`;
                    const url = `https://{블로그 주소}/${datePath}/${slug}/`;
                    location.href = url;
                    setTimeout(() => location.reload(true), 500);
                    return;
                } else if (run.status === 'completed' && run.conclusion !== 'success') {
                    hideLoading();
                    showToast('배포 실패 😢 Actions를 확인해주세요', 'error');
                    return;
                }
                // in_progress or queued → 계속 대기
            }
        } catch (e) { /* 네트워크 일시 오류 무시 */ }

        document.getElementById('loading-msg').textContent = `배포 중... (${(i+1)*5}초)`;
        await new Promise(r => setTimeout(r, 5000));
    }

    hideLoading();
    showToast('배포 시간이 너무 걸려요. 직접 확인해주세요!', 'error');
}

// ── UI 헬퍼 ─────────────────────────────────────────────────

function showLoading(msg) {
    document.getElementById('loading-msg').textContent = msg;
    document.getElementById('loading-sub').textContent = '';
    document.getElementById('loading').style.display = 'flex';
}
function hideLoading() {
    document.getElementById('loading-sub').textContent = '';
    document.getElementById('loading').style.display = 'none';
}
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }
function showToast(msg, type) {
    const el = document.getElementById('toast-msg');
    el.textContent = msg;
    el.className = 'show ' + (type || '');
    setTimeout(() => el.className = '', 3000);
}
```



### (3) `post-actions.js` 작성하기

글 상세 페이지에서 작동하는 삭제 버튼 구현을 위해 icarus 테마 폴더 내에 코드 작성해야함

```javascript themes/icarus/source/js/post-actions.js
(function() {
  const REPO = '깃허브이름/깃허브레포이름';
  const BRANCH = '소스파일 브랜치이름';

  // 토스트 알림
  function showToast(msg, type) {
    const existing = document.getElementById('pa-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'pa-toast';
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;top:24px;right:24px;
        background:${type === 'error' ? '#ca5e59' : type === 'success' ? '#74b574' : '#363636'};
        color:white;padding:12px 20px;border-radius:4px;font-size:14px;
        box-shadow:0 4px 16px rgba(0,0,0,0.2);
        transform:translateY(80px);opacity:0;
        transition:all 0.3s;z-index:9999;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
    });
    setTimeout(() => {
        el.style.transform = 'translateY(80px)';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // 배포 대기 스피너
  function showDeployLoading(subMsg) {
    const el = document.createElement('div');
    el.id = 'pa-deploy-loading';
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
    el.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid #eee;border-top-color:#6ac1f9;border-radius:50%;animation:pa-spin 0.8s linear infinite;"></div>
      <div id="pa-deploy-msg" style="margin-top:16px;font-size:15px;color:#333;">배포 중...</div>
      <div style="margin-top:8px;font-size:12px;color:#aaa;">${subMsg}</div>
      <style>@keyframes pa-spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  }

  function hideDeployLoading() {
    const el = document.getElementById('pa-deploy-loading');
    if (el) el.remove();
  }

  function setDeployMsg(msg) {
    const el = document.getElementById('pa-deploy-msg');
    if (el) el.textContent = msg;
  }

  async function waitForDeployThenRedirect(redirectUrl, subMsg) {
    showDeployLoading(subMsg);

    const deployStartTime = Date.now();
    await new Promise(r => setTimeout(r, 3000));

    const token = localStorage.getItem('gh_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const maxTries = 24;

    for (let i = 0; i < maxTries; i++) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/runs?per_page=5`,
          { headers }
        );
        const data = await res.json();
        const runs = data.workflow_runs || [];
        const run = runs.find(r => 
          r.name === 'pages build and deployment' &&
          new Date(r.created_at).getTime() > deployStartTime - 10000
        );

        if (run) {
          if (run.status === 'completed' && run.conclusion === 'success') {
            setDeployMsg('배포 완료! 이동 중...');
            // pjax 우회 강제 이동
            setTimeout(() => {
              const a = document.createElement('a');
              a.href = redirectUrl;
              a.rel = 'noopener';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => location.reload(true), 300);
            }, 500);
            return;
          } else if (run.status === 'completed' && run.conclusion !== 'success') {
            hideDeployLoading();
            showToast('배포 실패 😢 Actions를 확인해주세요', 'error');
            return;
          }
        }
      } catch(e) { /* 무시 */ }

      setDeployMsg(`배포 중... (${(i+1)*5}초)`);
      await new Promise(r => setTimeout(r, 5000));
    }

    hideDeployLoading();
    showToast('배포 시간이 너무 걸려요. 직접 확인해주세요!', 'error');
  }

  function init() {
    const token = localStorage.getItem('gh_token');
    const el = document.getElementById('article-actions');
    if (!el) return;

    if (token) el.style.display = 'block';

    const deleteBtn = document.getElementById('btn-delete-post');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async function() {
        if (!confirm('정말 삭제할까요?')) return;
        const rawPath = deleteBtn.dataset.path;
        const path = rawPath.startsWith('source/') ? rawPath : `source/${rawPath}`;
        const slug = deleteBtn.dataset.slug;
        try {
          const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('파일을 찾을 수 없어요');
          const data = await res.json();
          const delRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Delete Post "${slug}"`, sha: data.sha, branch: BRANCH })
          });
          if (!delRes.ok) throw new Error('삭제 실패');
          showToast('삭제됐어요! 배포 대기 중...', 'success');
          await waitForDeployThenRedirect('https://jinsugyeong.github.io/', '배포가 완료되면 메인화면으로 이동합니다');
        } catch(e) {
          showToast('삭제 실패: ' + e.message, 'error');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
})();
```


### (4) Icarus 테마 파일 수정


`/layout/common/scripts.jsx`파일 태그 부분 수정

{% asset_img 1774282976935.png "1774282976935.png" %}

```jsx themes/icarus/layout/common/scripts.jsx
{/* 태그 + 수정/삭제 버튼 */}
{!index && page.tags && page.tags.length ? <div class="article-tags is-size-7 mb-4" style="display:flex; align-items:flex-start; justify-content:space-between;">
    <div style="flex:1;">
        <span class="mr-2">#</span>
        {page.tags.map(tag => {
            return <a class="link-muted mr-2" rel="tag" href={url_for(tag.path)}>{tag.name}</a>;
        })}
    </div>
    <div id="article-actions" style="display:none;">
        <a class="button is-small is-light mr-2" href={`/new-post?edit=${page.slug}`}>
            <span class="icon is-small"><i class="fas fa-edit"></i></span>
            <span>수정</span>
        </a>
        <button class="button is-small is-light has-text-danger" id="btn-delete-post" data-slug={page.slug} data-path={page.source}>
            <span class="icon is-small"><i class="fas fa-trash"></i></span>
            <span>삭제</span>
        </button>
    </div>
</div> : null}
```

<br>

`/layout/common/article.jsx`파일 main.js 아래에 위에 작성한 post-actions.js 추가
```jsx themes/icarus/layout/common/article.jsx
<script data-pjax src={url_for('/js/main.js')} defer></script>
<script src={url_for('/js/post-actions.js')} defer></script> 
```



### (5) style.css 작성 및 `_config.yml` skip_render 옵션 추가

css는 개인 취향것.. 수정해주면 되고 
Decap CMS와 같이 skip 처리해주기 위해 post 폴더도 그대로 public 폴더에 올려주기 위해 옵션에 추가해준다.
끝




### (6) 실제 사용해보기

{% asset_img 1774283317711.png "1774283317711.png" %}

에디터 화면 현재 글 수정모습

<br>

{% asset_img 1774283349570.png "1774283349570.png" %}

임시저장 목록 모달

<br>

{% asset_img 1774283417221.png "1774283417221.png" %}

배포 중 화면

<br>

뭔가 공부할게 많아질 것 같아서 기록은 해야될 것같고, 내 노트북을 들고다니진 못할 것 같아서 가볍게 시작한게 일주일을 붙잡고 있을줄이야... 다들 티스토리나 .velog 쓰시길....