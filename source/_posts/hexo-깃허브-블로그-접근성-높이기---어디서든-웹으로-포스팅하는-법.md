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
      - {label: "Author", name: "author", widget: "string", default: "jinsugyeong"}
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


    // 3. Hexo의 asset_img 태그로 변환하여 리턴 (배포할 때만 적용됨!)
    return `{% asset_img ${fileName} "${alt}" %}`;
  });


  return data;
});
```

* 글을 쓸때는 에디터 본문에 이미지 드래그 앤 드롭,클립보드 붙여넣기, 마크다운 문법으로 쓰고
* 글 저장해서 레포지토리에도 순수 마크다운 문법으로 들어감
* 깃허브 액션돌아가서 배포 시작하면 스크립트 돌아가서 hexo 코드로 변환


### (4) 실제 사용해보기

{% asset_img 1774276738920.png "1774276738920.png" %}
{% asset_img 1774276827560.png "1774276827560.png" %}

로그인 화면


{% asset_img 1774276847340.png "1774276847340.png" %}

글 목록

{% asset_img 1774277107076.png "1774277107076.png" %}

글 임시저장

{% asset_img 1774277146253.png "1774277146253.png" %}

글 임시 저장 시 브랜치 생성 모습

{% asset_img 1774277226774.png "1774277226774.png" %}

게시글 테스트 커밋 모습

{% asset_img 1774277277546.png "1774277277546.png" %}

게시글 테스트 actions 모습

<br>

후기:

1. sync 스크롤링 안됨
2. 이미지 업로드는 rich text 모드에서만 되는데 마크다운 모드에서 편집하다가 전환하면 가장 아래로 강제 스크롤당함
3. 이미지 드래그앤드랍, 클립보드 붙여넣기 안됨
5. 내 블로그에서 어떻게 보일지는 배포하거나, 소스파일 다 있는 로컬에서 hexo s 명령어로만 확인 가능
6. 한번 제목을 짓고 save하면 slug가 확정되어 제목 수정하지 못함

<br>

## 5.2. TOAST UI Editor 이용하여 커스텀 웹앱 구축하기


<br>

## 5.3. `_config.yml`에 skip_render 옵션 추가

Hexo는 `source` 폴더에 있는 .md 파일을 토대로 html 파일을 만들기 때문에 배포할때 admin폴더에 있는 config.yml 파일을 단순 설정 파일로 오해하고 최종 결과물에 복사하지 않고 뺄 수 있다.

직접 만든 Decap CMS 폴더와 커스텀 웹앱 폴더는 건드리지말고 그대로 배포해달라는 예외 처리(skip) 설정을 추가해줘야 한다

```yaml _config.yml
# Directory 부분에 추가
skip_render:
    - admin/**
    - post/**
```

