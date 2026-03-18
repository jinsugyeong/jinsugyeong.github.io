---
title: GitHub Actions와 Docker로 EC2 자동 배포 파이프라인 구축하기
author: jinsugyeong
categories:
  - Infra
tags:
  - Github
  - Github Actions
  - Docker
  - CI/CD
  - AWS
  - EC2
date: 2026-03-17 20:03:54
---

현재 상황
- 개발: 로컬 docker-compose (backend + opensearch + postgres)
- 운영: EC2 (backend + opensearch), RDS (postgres)

**목표: 로컬에서 개발 → GitHub Actions → Docker 이미지 빌드 → EC2 자동 배포**

<!-- more -->

```
[Local Dev]
  ↓ push
GitHub

[GitHub Actions]
  → Docker build
  → Docker Hub push

[EC2]
  → docker pull
  → docker-compose up -d
```
서버에서는 build X, 무조건 pull만



# 1. Docker Hub 가입 및 설정

[Docker Hub](https://hub.docker.com/) 로그인 후 **우측 상단 프로필 > Account Settings > Personal access tokens** 메뉴 이동

{% asset_img image-2.png alt text %}

**Generate new Token** 을 클릭하여 토큰 발급받고 복사


{% asset_img image-5.png alt text %}

이때 Read Only 말고 `Read & Write`로 선택해야함 권한에 걸림!


---

# 2. GitHub Repository에 Secrets 등록

{% asset_img image.png alt text %}

GitHub 레포지토리 페이지에서  **Settings > Secrets and variables > Actions** 메뉴로 이동

**New repository secret** 에 다음 5가지 환경변수를 등록합니다.

- `DOCKERHUB_USERNAME`: 도커 허브 아이디
- `DOCKERHUB_TOKEN`: 1에서 복사한 액세스 토큰
- `EC2_HOST`: EC2의 탄력적 IP (ex: 43.201.xxx.xxx)
- `EC2_USERNAME`: ubuntu
- `EC2_SSH_KEY`: key.pem 파일의 텍스트 내용 전체 (-----BEGIN RSA PRIVATE KEY----- 부터 끝까지)

{% asset_img image-1.png alt text %}

---

# 3. 서버용 docker-compose.yml 수정

현재 서버 배포 방식은 EC2에서 직접 `docker compose --build`를 실행해 코드를 빌드하고 있다. 이제 깃허브 액션이 빌드를 대신해줄거기 때문에, EC2에서는 완성된 이미지를 다운로드(pull)만 하도록 파일을 수정해야 한다.


```yaml docker-compose.prod.yml
version: '3.8'
services:
  backend:
    # 기존 build: ... 부분은 삭제하고 아래처럼 image로 대체
    image: [본인의_도커허브_아이디]/bookchiki-backend:latest
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      opensearch:
        condition: service_healthy

  opensearch:
    build: ./opensearch
    # (나머지 OpenSearch 설정은 기존과 동일하게 유지)
```

- Dockerfile도 서버용 .prod 붙여서 커밋해두기


---

# 4. GitHub Actions 워크플로우 파일 생성

프로젝트 최상단 폴더에 `.github/workflows/deploy.yml` 파일을 만들고 아래 코드를 작성하여 커밋한다.

```yaml .github/workflows/deploy.yml
name: Deploy to EC2

# 1. 언제 이 액션을 실행할 것인가?
on:
  push:
    branches:
      - main
    # 백엔드나 인프라 관련 파일이 수정될 때만 배포 실행! (프론트/docs 수정 시 무시)
    paths:
      - 'backend/**'
      - 'docker-compose.prod.yml'
      - '.github/workflows/**'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # 2. 깃허브 레포지토리 코드 가져오기
      - name: Checkout Repository
        uses: actions/checkout@v4

      # 3. 도커 빌드 환경 세팅
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # 4. 도커 허브 로그인
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # 5. 백엔드 이미지 빌드 및 푸시
      - name: Build and Push Backend Image
        uses: docker/build-push-action@v5
        with:
          context: ./backend # backend 폴더 안의 내용만 컨텍스트로 사용
          file: ./backend/Dockerfile.prod  #배포용 도커파일 사용
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/bookchiki-backend:latest 

      # 6. EC2 서버에 접속해서 배포 스크립트 실행
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            # EC2 내 프로젝트 폴더로 이동
            cd ~/bookchiki
            
            # Sparse Checkout 설정 (frontend, docs 등 무거운 폴더 제외)
            git sparse-checkout disable
            git sparse-checkout init --no-cone
            git sparse-checkout set backend/ opensearch/ scripts/ docker-compose.prod.yml
            
            # 최신 코드 땡겨오기 (지정한 폴더와 파일들만 받아짐)
            git pull origin main
            
            # 백엔드 최신 도커 이미지 다운로드
            sudo docker compose -f docker-compose.prod.yml pull backend
            
            # 컨테이너 재시작 (변경된 이미지만 새로 띄워짐)
            sudo docker compose -f docker-compose.prod.yml up -d
            
            # 용량 확보를 위해 사용하지 않는 이전 도커 이미지 삭제
            sudo docker image prune -f
```

---

# 5. 실제 실행 해보기

{% asset_img image-3.png alt text %}

main에 push하니(PR) actinos 탭에 workflow 생김


{% asset_img image-4.png alt text %}

Docker Image 생성까지 잘 되다가 Ec2 서버에 밀어넣는 단계에서 막힘

사실 도커 이미지 생성도 막힘  1번에서 access tokens 권한 설정 Write도 허용해줘야함 ㅎㅎ


## AWS 방화벽(보안 그룹) 문제

{% asset_img image-6.png alt text %}

SSH(22번) 포트를 **My IP(내 IP)** 로 설정해둬서 미국 어딘가에 있는 GitHub Actions 서버의 IP는 AWS가 얄짤없이 차단해 버린 것(일 잘하네..) 

**위치 무관(Anywhere-IPv4)** (또는 0.0.0.0/0)으로 변경해줘야 한다.

- 보안은 괜찮은가?
  > 원칙적으로는 GitHub Actions의 특정 IP만 허용하는 것이 가장 안전하지만, GitHub의 IP 대역이 수시로 바뀌기 때문에 개인/포트폴리오 프로젝트에서는 보통 0.0.0.0/0으로 열어둔다. 어차피 key.pem 파일(비밀키)이 없으면 아무리 22번 포트가 열려있어도 접속할 수 없다.

<br>

{% asset_img image-7.png alt text %}

끝