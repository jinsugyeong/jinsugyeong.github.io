---
title: AWS와 Vercel로 서비스 실제 배포해보기
author: jinsugyeong
categories:
  - Infra
tags:
  - AWS
  - EC2
  - RDS
  - PostgreSQL
  - OpenSearch
  - Vercel
  - Docker
date: 2026-03-10 23:59:33
---

# 목차

1. [AWS EC2로 백엔드 배포하기](#1-AWS-EC2로-백엔드-배포하기)
2. [AWS 서비스 생성 및 연결하기 (RDS & OpenSearch)](#2-AWS-서비스-생성-및-연결하기-RDS-OpenSearch)
3. [프론트엔드(Vercel) 배포 및 연결](#3-프론트엔드-Vercel-배포-및-연결)
4. [도메인 및 HTTPS 적용](#4-도메인-및-HTTPS-적용)

<!-- more -->


## 현재 서비스 배포 구조

- Docker Compose (개발)
- AWS EC2 + RDS + OpenSearch / Vercel (프론트)


```
Vercel (Frontend)
        ↓
EC2 (FastAPI + Docker)
        ↓
RDS (Postgres)
        ↓
OpenSearch
```





# 1. AWS EC2로 백엔드 배포하기

[AWS 프리티어](https://aws.amazon.com/ko/free/) 가입부터 해주기

로그인하면 콘솔 홈에 들어가게 되는데

{% asset_img image.png alt text %}

여기가 서울로 잡혀있어야함! 나는 처음에 시드니로 잡혀있어서 인스턴스 만들었다가 삭제하고 다시 만들었다...

## 1.1 AWS 서버 생성


### (1) AWS 콘솔 들어가기

1. Amazon Web Services 로그인
2. 상단 검색창에 **EC2** 검색
3. **EC2 Dashboard** 클릭



### (2) 서버 생성

왼쪽 메뉴에서

```
Instances → Launch instances
```

클릭

{% asset_img image-1.png alt text %}


### (3) 기본 설정

#### 이름

```
프로젝트 이름
```


#### OS 선택

**Ubuntu 선택**

```
Ubuntu Server 22.04 LTS
```

이게 제일 무난


#### 인스턴스 타입

무료티어면


```
t3.micro or t3.small
```


### (4) Key pair 생성 (SSH 접속용)

`Create new key pair`

설정

```
Name: 프로젝트명-key
Type: RSA
Format: .pem
```

다운로드됨.

⚠️ 이 파일 **절대 잃어버리면 안됨**



### (5) 네트워크 설정 (포트 열기)

Security Group에서 다음 추가

```
SSH   22   My IP
HTTP  80   Anywhere
HTTPS 443  Anywhere
Custom 8000 Anywhere
```
(8000은 FastAPI 같은 서버용)

{% asset_img image-2.png alt text %}
이렇게 설정하고

우측 상단에 편집 버튼 눌러서

{% asset_img image-3.png alt text %}

이런식으로 추가해주기



### (6) 스토리지

기본값 그대로

```
8GB
```



### (7) Launch Instance

버튼 누르면 서버 생성됨




### (8) 서버 IP 확인

생성된 인스턴스 클릭하면

```
Public IPv4 address
```

예

```
43.201.xxx.xxx
```

이게 **서버 주소**다.

---

## 1.2 AWS 서버 접속 및 세팅

### (1) 서버 접속 (로컬에서)

윈도우 기준

```bash
ssh -i bookchiki-key.pem ubuntu@43.201.xxx.xxx
```

key.pem 파일이 권한때문에 실패한다면

```powershell
icacls "key.pem" /inheritance:r
icacls "key.pem" /remove "Users"
icacls "key.pem" /grant:r "$($env:USERNAME):R"
```


접속 성공

```
ubuntu@ip-xxx:~$
```

여기부터 **리눅스 서버**

### (2) 리눅스 서버 세팅

패키지 업데이트.

```bash
sudo apt update
sudo apt upgrade -y
```

---

### (3) Docker 설치

```bash
sudo apt install -y docker.io
```

설치 확인

```bash
docker --version
```

---

### (4) Docker 실행

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

확인

```bash
sudo systemctl status docker
```

---

### (5) sudo 없이 docker 쓰기 (중요)

지금 상태는 docker 실행할 때마다 sudo 붙어야 한다. 귀찮다.

```bash
sudo usermod -aG docker $USER
```

그 다음 **SSH 다시 접속**

```bash
exit
```

그리고 로컬에서 다시

```bash
ssh -i key.pem ubuntu@ip-xxx
```

---

### (6) Docker 정상 작동 확인

```bash
docker run hello-world
```

이 메시지 나오면 성공

```
Hello from Docker!
```

---



## 1.3 서버에 코드 가져오기

백엔드 코드를 EC2로 가져와야 한다.

### 방법 A: GitHub에서 clone

서버에서 실행:

```bash
sudo apt install -y git
```

그 다음

```bash
git clone https://github.com/아이디/레포.git
```

예

```bash
git clone https://github.com/jinsugyeong/bookchiki.git
```

그리고 이동

```bash
cd bookchiki
```

---

### 방법 B: 로컬 코드 업로드

만약 GitHub 없으면 **scp로 업로드**한다.

로컬에서 실행:

```bash
scp -i bookchiki-key.pem -r C:/JSG/bookchiki ubuntu@ip-xxx:~
```

---

이제 파일을 수정해야하는데 터미널에서 vim이나 nano를 사용해도 되지만 빠른 설정과 편리함을 위해 vscode에서 remote-ssh extention을 사용했다.
설정 방법은 아래의 블로그 글 참고

[AWS - EC2 초 간단 생성 + vscode 원격연결](https://tyoon9781.tistory.com/entry/aws-ec2-vscode-setting-2023)


## 1.4 배포용으로 코드 수정하기

현재 개발용 Docker 파일들이 `backend + postgres + opensearch`가 묶여있기 때문에 `backend only`로 수정해줘야한다.

### (1) docker-compose.yaml 수정
```yaml docker-compose.yaml 
version:

services:
  backend: 
  postgres: 
  opensearch:

volumes:
```
였던 걸 아래의 코드로 수정


```yaml docker-compose.prod.yaml 
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env
```

#### 💡 단일 컨테이너라도 `docker-compose.yml`을 두는 이유

1. **설정의 문서화** (Configuration as Code):
- docker run 명령어의 옵션(-p, --env-file, --restart 등)을 매번 기억하거나 메모장에 적어둘 필요가 없다. `docker-compose.yml` 파일 자체가 실행 명세서가 된다.
2. **배포 명령어의 단순화** :
- 초기 배포든, 업데이트 배포든 명령어 하나면 끝난다.
- `docker-compose -f docker-compose.prod.yml up -d --build`
- 이 명령어가 알아서 '기존 컨테이너 정지 -> 삭제 -> 이미지 빌드 -> 새 컨테이너 실행'을 수행한다.
3. **확장성** :
- 나중에 SSL 적용을 위해 Nginx를 앞단에 붙이거나, 로그 수집기 등을 추가해야 할 때 `docker-compose.yml`에 몇 줄만 추가하면 된다.


### (2) DockerFile 수정
```DockerFile
# --- Stage 1: Builder ---
# 의존성을 설치하는 빌드 단계
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY ./requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt


# --- Stage 2: Final ---
# 실제 애플리케이션을 실행하는 최종 이미지
FROM python:3.11-slim

WORKDIR /app

# 보안을 위해 non-root 유저 생성 및 사용
RUN useradd --create-home appuser
USER appuser

# non-root 유저로 설치된 패키지의 실행 파일 경로를 PATH에 추가
ENV PATH="/home/appuser/.local/bin:${PATH}"

COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

COPY . .

EXPOSE 8000
CMD ["bash", "-c", "python -m alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

- start bash는 db 마이그레이션과 fastAPI 실행을 위해 설정해둠
- 개발과 다르게 배포환경에서는 fastAPI의 reload 옵션을 제거함


### (3) .env 파일 수정

현재 코드 상황
```
DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

여기서 `postgres`는 내부 hostname이여서
AWS를 사용하면 `RDS-ENDPOINT`로 바뀌게 된다

opensearch도 마찬가지 하지만 현재 RDS랑 opensearch를 안만들었기 때문에 `.env.example`만 수정해두고 서버 실행 테스트 진행




## 1.5 서버 실행 테스트

DockerFile
`CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`로 수정해서 진행

실행

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

종료

```bash
docker compose -f docker-compose.prod.yml down
```

<details>
<summary>docker compose 명령어 오류날때</summary>

1. 필수 패키지 설치 및 GPG 키 추가

```bash
# 패키지 인덱스 업데이트 및 필요한 보안 패키지 설치
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Docker 공식 GPG 키 다운로드 및 저장
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

2. Docker 저장소 추가

```bash
# 시스템 아키텍처에 맞는 Docker 저장소를 소스 리스트에 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

3. 다시 업데이트 및 플러그인 설치

이제 저장소가 추가되었으므로 패키지를 찾을 수 있습니다.

```bash
# 저장소 목록 갱신
sudo apt-get update

# Docker Compose 플러그인 설치
sudo apt-get install -y docker-compose-plugin
```

4. 설치 확인 및 배포

설치가 잘 되었는지 버전을 확인합니다.

```bash
docker compose version
```

</details>



{% asset_img image-4.png alt text %}

떳당


# 2. AWS 서비스 생성 및 연결하기 (RDS & OpenSearch)

## 2.1 PostgreSQL - AWS RDS
백엔드가 의존하는 데이터베이스 AWS에 생성하기

```
Engine: PostgreSQL
Version: 16 (개발했던 버전에 맞춰서)
Instance: db.t3.micro
Storage: 20GB
Public access: Yes  ⭐중요
DB name: dbname 
username: dbuser 
password: dbpassword
```

이정도로 설정해주고

endpoint 나오면 `.env`에 postgres로 되어있던 `RDS-ENDPOINT` 수정해주기


## 2.2 OpenSearch - EC2 Docker에 포함시키기

현재 opensearch 서비스 생성이 안돼서 그냥 ec2에 포함시켜서 배포하기로 ㅠ

### docker-compose.yml 수정

```yml docker-compose.prod.yml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      opensearch:
        condition: service_healthy

  opensearch:
    build: ./opensearch
    environment:
      - discovery.type=single-node
      - plugins.security.disabled=true
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=
    ports:
      - "9200:9200"
    volumes:
      - osdata:/usr/share/opensearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s

volumes:
  osdata:
```

### 스토리지 확장

처음 ec2 인스턴스 생성할때 기본인 8GB로 생성했었는데 opensearch까지 같이 올려야하니깐 바로 `no space left on device` 오류났다..ㅎㅎ

프리티어는 스토리지 30gb까지 무료라길래 20gb로 늘림 확인해보면

```
ubuntu@ip-172-31-1-123:~/bookchiki$ lsblk
NAME         MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
nvme0n1      259:0    0   20G  0 disk 
├─nvme0n1p1  259:1    0    7G  0 part /
├─nvme0n1p14 259:2    0    4M  0 part 
├─nvme0n1p15 259:3    0  106M  0 part /boot/efi
└─nvme0n1p16 259:4    0  913M  0 part /boot
```

<br>
이걸로 끝이 아니라 파티션에 할당해줘야한다

```bash
# 파티션 확장
sudo growpart /dev/nvme0n1 1

# 파일시스템 확장
sudo resize2fs /dev/nvme0n1p1
```

<br>

확인

```
ubuntu@ip-172-31-1-123:~/bookchiki$ df -h
Filesystem       Size  Used Avail Use% Mounted on
/dev/root         19G  3.9G   15G  22% /
tmpfs            956M     0  956M   0% /dev/shm
tmpfs            383M  928K  382M   1% /run
tmpfs            5.0M     0  5.0M   0% /run/lock
efivarfs         128K  3.6K  120K   3% /sys/firmware/efi/efivars
/dev/nvme0n1p16  881M  161M  659M  20% /boot
/dev/nvme0n1p15  105M  6.2M   99M   6% /boot/efi
tmpfs            192M   12K  192M   1% /run/user/1000
```

### 인스턴스 유형 변경

`t3.small`로 ram 2gb짜리 엿는데 이것도 뻑가길래 `m7i-flex.large`로 변경...^^ 다행히 이것도 프리티어 가능ㅎㅎ

## 2.3 AWS 보안 규칙 추가

{% asset_img image-5.png alt text %}

RDS도 EC2 보안 규칙 같이 쓰게 해놔서
postgres의 `5432`포트와 opensearch의 `9200`포트 추가해줬다





---

# 3. 프론트엔드(Vercel) 배포 및 연결

## 3.1 Vercel 프로젝트 생성
GitHub 리포지토리를 Vercel에 연결하여 프론트엔드 프로젝트를 생성.

## 3.2 Vercel 환경변수 설정 (Environment Variables)

{% asset_img image-6.png alt text %}
  - 원래 `NEXT_PUBLIC_API_URL`은 개발에서 localhost:8000이였고 배포환경에선 AWS EC2 IP:8000으로 해야하지만..! google oauth 이슈로 인해 아래 도메인을 발급받아서 설정해줬다...

## 3.3 백엔드 CORS 설정
EC2 서버의 .env 파일에 있는 FRONTEND_URL을 Vercel 배포 주소로 설정

이후 백엔드 재시작! 그래야 Vercel에서 보낸 API 요청을 백엔드가 허용함.

## 3.4 Google Oauth redirect_uri_mismatch 이슈 해결

설정을 제대로 했는데.. 계속 `redirect_uri_mismatch` 오류가 났다...

지피티도 제미나이도 계속 나한테 승인된 리디렉션 URI을 설정하라고 하는데 아무리 뒤져봐도 그런게 없는데 

{% asset_img image-7.png alt text %}

알고보니 개발환경에서 쓰던 OAuth 클라이언트가 데스크톱 유형이여서 그랬던것... 웹 애플리케이션으로 만들어야 승인된 JavaScript 원본과 승인된 리디렉션 URI을 설정할 수 있다.

{% asset_img image-8.png alt text %}



---


# 4. 도메인 및 HTTPS 적용 

서비스를 정식으로 운영하려면 IP 주소 대신 도메인을 사용하고, 보안을 위해 HTTPS를 적용하는 것이 좋다.


## 4.1 도메인 구매 및 EC2 연결

원하는 도메인을 구매하고, 해당 도메인이 EC2의 IP 주소를 가리키도록 DNS 설정.

## 4.2 Nginx 리버스 프록시 설정
EC2에 Nginx를 설치하여 https://your-domain.com 으로 들어오는 요청을 백엔드 컨테이너의 http://localhost:8000 으로 전달하도록 설정.

## 4.3 SSL 인증서 발급
Certbot을 사용하여 무료 SSL 인증서를 발급받고 Nginx에 적용하여 HTTPS를 활성화하기.

<br>

위 3단계를 아래의 블로그에서 잘 정리해줬다

[무료 도메인을 발급받고 Https 적용하기 (nginx, certbot)](https://securityinit.tistory.com/243)


---

<br>




{% asset_img image-9.png alt text %}
[배포 사이트](https://bookchiki.vercel.app/)

아직 오류가 많고 mvp 수준이지만 배포를 우선 해보고 실사용자 후기를 들으면서 디벨롭하는게 더 좋을것 같아서 부랴부랴 밤새가면서 한거라 미흡하지만 뿌듯하다.

배포하고 보니깐 수정할게 계속 눈에 보여서 더 힘들었던것같다.

git action으로 CI/CD 파이프라인 만들어서 도커 이미지 서버에 배포하는것도 공부해봐야겠다.