---
title: 구글 Oauth 로그인 구현
author: jinsugyeong
categories:
  - Backend
tags:
  - Google OAuth
  - FastAPI
  - Python
date: 2026-02-28 23:01:00
---

최근 Next.js(프론트엔드), FastAPI(백엔드), 그리고 Docker 환경에서 서비스 개발을 진행하며 구글 OAuth 2.0(Google OAuth)을 이용해 소셜 로그인 기능을 구현했다.

새로운 서비스를 구축할 때 회원가입 및 로그인은 필수적인 기능이나, 사용자 입장에서는 매번 새로운 사이트에 가입하고 비밀번호를 기억해야 하는 번거로움이 존재한다. 따라서 프로젝트에 사용자의 진입 장벽을 낮추기 위해 구글 소셜 로그인을 도입하게 되었다.

<!-- more -->

본 글에서는 구글 OAuth를 선택한 이유, 도입 과정에서 확인한 장단점, 그리고 실제 서비스(Next.js + FastAPI)에 적용하는 방법을 정리한다.

# 1. 구글 OAuth 도입 이유
가장 큰 이유는 '사용자 경험(UX) 개선'과 '보안 및 리소스 절약'이다.

1. **사용자의 이탈률 감소 (빠른 온보딩)** : 복잡한 회원가입 폼을 채우고 이메일 인증을 하는 과정 없이, 최소한의 클릭만으로 서비스에 가입하고 로그인할 수 있다.
2. **비밀번호 관리 부담 해소** : 서비스 제공자(개발자) 입장에서 사용자의 비밀번호를 암호화하여 안전하게 보관하고, 분실 시 찾기 기능을 구현하는 것은 상당한 리소스를 요구한다. OAuth를 사용하면 인증 과정을 구글에 위임하므로 이러한 민감 정보 관리 부담을 크게 줄일 수 있다.
3. **압도적인 접근성** : 대부분의 사용자가 이미 구글 계정을 보유하고 있으며, 스마트폰이나 브라우저에 로그인이 유지되어 있는 경우가 많아 접근성이 매우 뛰어나다.


# 2. OAuth 소셜 로그인의 장단점

기술을 도입할 때는 항상 트레이드오프(Trade-off)를 고려해야 한다. 소셜 로그인을 도입하며 파악한 장단점은 다음과 같다.

| 장점 (Pros)| 단점 (Cons) |
| --- | --- |
| **높은 보안성** <br> 구글의 강력한 보안 시스템을 활용할 수 있다. | **외부 서비스 의존도** <br> 구글 인증 서버에 장애가 발생하면 자사 서비스의 로그인 기능도 중단된다. 이를 대비해 자체 로그인이나 타 소셜 로그인을 병행하는 경우가 많다.|
| **개발 리소스 절감** <br> 비밀번호 찾기, 비밀번호 변경, 이메일 인증 등의 기능을 별도로 구현할 필요가 없다. | **초기 구현의 복잡성** <br> OAuth 2.0의 개념(Authorization Code, Access Token, Refresh Token 등)과 리다이렉트 흐름을 명확히 이해하지 못하면 초기 설정에 어려움이 따를 수 있다. |
| **검증된 사용자 정보** <br> 구글에서 이미 인증된 이메일 주소 등을 제공받기 때문에, 유령 회원이나 가짜 이메일 가입을 방지할 수 있다. | **제한적인 정보 획득** <br> 기본적으로 이름, 이메일, 프로필 사진 등의 정보만 제공된다. 서비스 특성상 사용자의 나이나 성별 등 추가 정보가 필요하다면, 로그인 이후 별도의 정보 입력 폼을 제공해야 한다. |


# 3. 서비스에 적용하는 방법 (Next.js + FastAPI)

구글 OAuth 로그인을 서비스에 적용하는 전체적인 흐름은 다음과 같다.

> 클라이언트(Next.js) -> 구글 로그인 페이지 -> 인가 코드(Auth Code) 발급 -> 서버(FastAPI)에서 인가 코드로 구글 Access Token 교환 -> 유저 정보 획득 -> 자체 서비스 로그인 처리(JWT 발급 등)

## 3.1. 구글 클라우드 콘솔(GCP) 설정

가장 먼저 구글 서버에 서비스를 등록하는 과정이 필요하다.

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속하여 새 프로젝트를 생성한다.

{% asset_img image.png alt text %}
2. 좌측 메뉴에서 **[API 및 서비스] -> [OAuth 동의 화면]** 으로 이동하여 User Type을 '외부'로 선택하고 앱 이름, 이메일 등을 입력해 동의 화면을 구성한다. (수집할 정보 범위인 scope도 이곳에서 설정하며, 일반적으로 email, profile을 사용한다.)

3. **[사용자 인증 정보] -> [사용자 인증 정보 만들기] -> [OAuth 클라이언트 ID]** 를 클릭한다.

4. 애플리케이션 유형을 '웹 애플리케이션'으로 선택하고, 승인된 리디렉션 URI를 입력한다. (예: http://localhost:3000/auth/google/callback - 구글 로그인이 성공하면 이 주소로 사용자를 리다이렉트한다.)

{% asset_img image-1.png alt text %}
5. 생성이 완료되면 **Client ID**와 **Client Secret**이 발급된다.

> 💡 Docker 환경에서의 환경변수 관리발급받은 Client ID와 Client Secret은 보안을 위해 절대 코드 내에 하드코딩해서는 안 된다. 본 프로젝트에서는 Docker 컨테이너 환경을 사용했으므로, .env 파일을 구성하고 docker-compose.yml을 통해 Next.js와 FastAPI 컨테이너에 환경변수를 안전하게 주입하여 사용했다.

## 3.2. 프론트엔드 (Next.js) - 로그인 URL 연결

사용자가 '구글 로그인' 버튼을 눌렀을 때 구글 로그인 페이지로 이동하도록 컴포넌트를 구성한다. 

환경변수는 `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID` 형태로 관리한다.// 

```tsx  app/login/GoogleLoginButton.tsx등
'use client';

export default function GoogleLoginButton() {
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;
  
  const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email profile`;

  const handleGoogleLogin = () => {
    window.location.href = googleLoginUrl;
  };

  return (
    <button onClick={handleGoogleLogin}>
      구글로 로그인하기
    </button>
  );
}
```

## 3.3. 백엔드 (FastAPI) - 토큰 교환 및 유저 정보 가져오기

사용자가 로그인을 완료하면 구글은 프론트엔드에 지정된 REDIRECT_URI로 인가 코드(Authorization Code)를 전달한다. 프론트엔드가 이 코드를 백엔드로 넘겨주거나, 백엔드가 직접 콜백을 받아 구글 API를 호출하여 사용자 정보를 획득한다.

FastAPI에서는 비동기 HTTP 통신을 위해 httpx 라이브러리를 주로 활용한다.

```python app/main.py_또는_라우터파일
from fastapi import FastAPI, Depends, HTTPException
import httpx
import os

app = FastAPI()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

@app.get("/auth/google/callback")
async def google_callback(code: str):
    # 1. 전달받은 인가 코드(code)를 사용해 구글에 Access Token 요청
    token_url = "[https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token)"
    token_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data=token_data)
        token_json = token_res.json()
        
        if "error" in token_json:
            raise HTTPException(status_code=400, detail="Failed to fetch access token")
            
        access_token = token_json.get("access_token")

        # 2. Access Token을 이용해 구글에서 유저 정보(이메일, 이름 등) 조회
        user_info_url = "[https://www.googleapis.com/oauth2/v2/userinfo](https://www.googleapis.com/oauth2/v2/userinfo)"
        user_info_res = await client.get(
            user_info_url,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_info = user_info_res.json()

    email = user_info.get("email")
    name = user_info.get("name")

    # 3. 자체 서비스 DB에서 유저 조회, 없을 경우 신규 회원가입 처리 로직 (예시)
    # user = db.get_user_by_email(email)
    # if not user:
    #     user = db.create_user(email=email, name=name, provider="google")
    # user_id = str(user.id)
    
    user_id = email # DB 로직이 없다면 임시로 email을 고유 식별자로 사용

    # 4. 자체 서비스 전용 인증 토큰(JWT) 발급
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    service_access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    # 5. 프론트엔드로 JWT 토큰 전달
    return {
        "access_token": service_access_token, 
        "token_type": "bearer",
        "email": email, 
        "name": name
    }
```

# 4. 요약

처음 [OAuth 2.0 공식 문서](https://developers.google.com/identity/protocols/oauth2/web-server?hl=ko#python)를 접할 때는 복잡한 인증 흐름으로 인해 진입 장벽을 느낄 수 있다. 하지만 **"구글 로그인 창 이동 -> 인가 코드 획득 -> 코드로 엑세스 토큰 교환 -> 토큰으로 유저 정보 획득"** 이라는 전체적인 뼈대를 이해하면, 다른 소셜 로그인을 연동할 때도 동일한 구조를 적용할 수 있다. Next.js와 FastAPI, 그리고 Docker를 결합한 환경에서도 이 핵심 흐름은 변하지 않으며, 각 프레임워크의 특성(비동기 처리, 환경변수 분리 등)을 잘 활용하면 안전하고 효율적인 인증 시스템을 구축할 수 있다. 이번 구현 경험은 향후 다양한 서비스 개발을 위한 안정적인 기반이 될 것이다.