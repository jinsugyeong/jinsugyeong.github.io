---
title: 다음카페 댓글 크롤링 삽질기 - Selenium으로 로그인부터 페이지네이션까지
author: jinsugyeong
cover: 
categories:
  - Backend
tags:
  - Python
  - 크롤링
  - Selenium
date: 2026-02-20 14:01:55
---


남들은 쉽게 한다는 크롤링 나는 왜 안 되지...? 부트캠프때 인스타 크롤링하다가 계정 정지당한 기억이 있다. 그리고 ai한테 물어보면 다들 서비스 차단 및 저작권 등 법적 문제를 걱정한다. 맞는 말이야...  하지만 웹에서 내가 일일이 복붙하기 싫어서 자동화하고 싶었을뿐이라고 나는.. 그래서 해봤다. Selenium로 로그인해서 다음카페 **특정 키워드 있는 댓글 크롤링** 하기. 여기에도 많은 시행착오가 있었다... 어플에서는 🐹 <이런 이모지가 검색되는데 웹에서는 안되는것(카페 뿐만아니라 다음자체가 안됨) 결국 전체 댓글 페이지를 모두 순회하며 특정 키워드가 있으면 저장하는 방식을 택했다.

<!-- more -->

## 환경 세팅

```
Python 3.11
selenium==4.18.1
beautifulsoup4==4.12.3
```

Selenium 4.x부터는 ChromeDriver를 별도로 설치하지 않아도 자동으로 다운받아준다.

---

## 삽질 1 - 로그인 자동화 차단

처음에는 카카오 로그인 페이지(`accounts.kakao.com`)에서 자동으로 아이디/비밀번호를 입력하려고 했는데, 카카오가 Selenium 자동화를 감지하고 차단했다.

**해결책:** 자동 로그인을 포기하고 수동 로그인 방식으로 바꿨다. 다음 로그인 페이지(`logins.daum.net`)로 이동 후 사용자가 직접 로그인하면 엔터를 누르는 방식이다. 그리고 Selenium 자동화 감지를 우회하는 옵션도 추가했다.

```python
options.add_argument('--disable-blink-features=AutomationControlled')
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option('useAutomationExtension', False)

driver.get('https://logins.daum.net/accounts/loginform.do')
print("로그인 완료 후 엔터를 눌러주세요...")
input()
```

---

## 삽질 2 - 다음카페 댓글 페이지 구조 분석

다음카페 댓글 URL 구조를 파악하는 데 시간이 많이 걸렸다. 처음에는 단순하게 생각했는데 실제로는 꽤 독특한 구조였다.

### URL 구조

```
https://m.cafe.daum.net/{카페명}/{게시판명}/{게시글번호}/comments
```

**핵심 발견:** `/comments`로 접근하면 첫 페이지가 아니라 **마지막 페이지**가 열린다.

페이지네이션 URL은 이렇게 생겼다.

```
?prev_page={이전페이지번호}&mode=regular&cdepth={cdepth값}&page={페이지번호}
```

처음에는 `prev_page`와 `cdepth`를 정확히 맞춰야 하는 줄 알았는데, 테스트해보니 **`page` 파라미터만 바꿔도 잘 동작**했다.

### 페이지네이션 HTML 구조

```html
<div class="paging_board">
    <a href="...?prev_page=296&page=295" class="btn_page btn_prev">이전페이지</a>
    <span id="pagingNav" class="desc_paging">
        <span class="num_page"><em class="link_page">296</em></span>  <!-- 현재 페이지 -->
        <span class="num_page"><a href="..." class="link_page">2</a></span>
        ...
    </span>
    <a href="#none" class="btn_page btn_next" disabled="disabled">다음 목록이 없습니다.</a>
</div>
```

`/comments`가 마지막 페이지이므로 `em.link_page`의 텍스트가 곧 **총 페이지 수**다.

```python
def get_post_meta(driver, post_num):
    url = f"https://m.cafe.daum.net/{CAFE_NAME}/{BOARD_NAME}/{post_num}/comments"
    driver.get(url)
    time.sleep(SLEEP_SEC)

    soup = BeautifulSoup(driver.page_source, 'html.parser')

    # 현재 페이지 = 마지막 페이지 = 총 페이지 수
    current_page_tag = soup.select_one('#pagingNav em.link_page')
    total_pages = int(current_page_tag.get_text(strip=True)) if current_page_tag else 1

    # cdepth 추출 (page만 바꿔도 되지만 일단 확보)
    cdepth = ''
    any_link = soup.select_one('#pagingNav a.link_page')
    if any_link:
        params = parse_qs(urlparse(any_link['href']).query)
        cdepth = params.get('cdepth', [''])[0]

    return total_pages, cdepth
```

### 댓글 HTML 구조

```html
<ul id="commentList">
    <li id="comment_1234">           <!-- 원댓글 -->
        <span class="txt_detail">댓글 내용</span>
        <span class="created_at">25.12.06</span>
    </li>
    <li id="comment_1235" class="reply_on">  <!-- 답글: reply_on 클래스 -->
        <span class="txt_detail">답글 내용</span>
        <span class="created_at">25.12.06</span>
    </li>
</ul>
```

원댓글과 답글 구분은 `reply_on` 클래스 유무로 판단한다.

---

## 삽질 3 - 페이지 반복 버그

초기 버전에서는 같은 페이지가 계속 반복해서 저장되는 문제가 있었다. 원인은 `get_post_meta`에서 마지막 페이지를 찾기 위해 다음 버튼을 순차적으로 클릭하는 방식을 썼는데, 이 과정에서 드라이버 위치가 꼬이면서 항상 마지막 두 페이지만 왔다갔다하는 문제였다.

**해결책:** `/comments`가 이미 마지막 페이지라는 걸 파악하고, 순차 탐색 로직을 완전히 제거했다.

---

## 삽질 4 - 크롤링 중 로그인 세션 만료

페이지 수가 많은 게시글은 크롤링하는 데 수십 분이 걸리는데, 그 사이에 로그인 세션이 만료되는 경우가 있었다. 문제는 코드가 계속 크롤링 요청을 보내고 있어서 브라우저에서 로그인 버튼을 클릭할 수 없었다는 것이다.

**해결책:** `pause.txt` 파일 기반 일시정지 기능을 만들었다. 크롤러 폴더에 `pause.txt` 파일을 만들면 다음 페이지로 넘어가기 전에 자동으로 멈추고 엔터를 기다린다.

```python
if os.path.exists('pause.txt'):
    print(f"[일시정지] pause.txt 감지 ({page}페이지 직전)")
    print("브라우저에서 로그인 등 처리 후 엔터를 눌러주세요...")
    os.remove('pause.txt')
    input()
    print(f"[재개] {page}페이지부터 이어서 크롤링")
```

탐색기에서 `pause.txt` 파일을 만들면 다음 페이지 직전에 멈추고, 로그인 후 터미널에서 엔터를 누르면 이어서 진행된다.

(원래 pickle로 쿠키인가 세션을 파일로 저장하는 방식도 해봤는데 오히려 카페로 진입조차안되고 크롤링 완료했다고 종료되어 버렸음...)

---

## 최종 코드

```python
"""
다음카페 댓글 크롤러
- 특정 키워드 댓글만 수집
- JSON 저장 (이어쓰기)
- 로그 파일 저장 (실행마다 구분선 + 이어쓰기)
- start_page 설정 (중간부터 이어서 크롤링)
- pause.txt 일시정지 기능
"""

import time
import os
import sys
import json
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup


CAFE_NAME   = "카페이름"
BOARD_NAME  = "게시판이름"
OUTPUT_DIR  = "output"
JSON_PATH   = os.path.join(OUTPUT_DIR, "result.json")
LOG_PATH    = os.path.join(OUTPUT_DIR, "crawl.log")
SLEEP_SEC   = 1.0 # 초기에 1.5로 했다가 1.0으로 변경

# (글번호, 시작페이지) - 중간에 멈췄으면 시작페이지만 수정
POST_NUMS = [
    ("123456", 100),
    ("234567", 1),
]


class Logger:
    def __init__(self, log_path):
        self.terminal = sys.stdout
        self.log = open(log_path, 'a', encoding='utf-8')

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()


def load_json():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_json(data):
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_post_meta(driver, post_num):
    # /comments = 마지막 페이지이므로 em.link_page = 총 페이지 수
    url = f"https://m.cafe.daum.net/{CAFE_NAME}/{BOARD_NAME}/{post_num}/comments"
    driver.get(url)
    time.sleep(SLEEP_SEC)

    soup = BeautifulSoup(driver.page_source, 'html.parser')

    current_page_tag = soup.select_one('#pagingNav em.link_page')
    total_pages = int(current_page_tag.get_text(strip=True)) if current_page_tag else 1

    cdepth = ''
    any_link = soup.select_one('#pagingNav a.link_page')
    if any_link:
        params = parse_qs(urlparse(any_link['href']).query)
        cdepth = params.get('cdepth', [''])[0]

    print(f"  [메타] 총 {total_pages}페이지 / cdepth: {cdepth}")
    return total_pages, cdepth


def parse_page(soup, post_num, page):
    comment_list = soup.find('ul', id='commentList')
    if not comment_list:
        print(f"  [page {page}] commentList 없음, 스킵")
        return []

    results = []
    items = comment_list.find_all('li', recursive=False)

    for item in items:
        cmt_id = item.get('id', '').replace('comment_', '')
        if not cmt_id:
            continue

        txt_tag = item.find('span', class_='txt_detail')
        text = txt_tag.get_text(strip=True) if txt_tag else ''

        # [키워드] 없으면 스킵
        if '키워드' not in text:
            continue


        time_tag = item.find('span', class_='created_at')
        created_at = time_tag.get_text(strip=True) if time_tag else ''

        comment = {
            "cmt_id":     cmt_id,
            "post_num":   post_num,
            "text":       text,
            "page":       page,
            "created_at": created_at,
        }

        print(f"  [키워드 {cmt_id}] {text[:50]}")
        results.append(comment)

    return results


def crawl_post(driver, post_num, start_page, data):
    print(f"\n{'='*50}")
    print(f"[게시글 {post_num}] 시작페이지: {start_page}")

    total_pages, cdepth = get_post_meta(driver, post_num)

    if post_num not in data:
        data[post_num] = []

    for page in range(start_page, total_pages + 1):

        if os.path.exists('pause.txt'):
            print(f"\n  [일시정지] pause.txt 감지 ({page}페이지 직전)")
            print(f"  브라우저에서 로그인 등 처리 후 엔터를 눌러주세요...")
            os.remove('pause.txt')
            input()
            print(f"  [재개] {page}페이지부터 이어서 크롤링")

        url = (
            f"https://m.cafe.daum.net/{CAFE_NAME}/{BOARD_NAME}/{post_num}/comments"
            f"?prev_page=1&mode=regular&cdepth=&page={page}"
            # 처음에 cdepth={cdepth}로 넣어줬는데 오류나서 그냥 파라미터 제거해줬더니 해결됨
        )
        driver.get(url)
        time.sleep(SLEEP_SEC)

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        comments = parse_page(soup, post_num, page)
        data[post_num].extend(comments)

        save_json(data)
        print(f"  [{page}/{total_pages}] 완료 (누적 {len(data[post_num])}개)")

    print(f"[게시글 {post_num}] 완료! 총 {len(data[post_num])}개 수집")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    sys.stdout = Logger(LOG_PATH)

    print(f"\n{'='*50}")
    print(f"[실행 시작] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")

    data = load_json()
    print(f"[JSON] 기존 데이터: {sum(len(v) for v in data.values())}개 로드")

    options = Options()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    driver = webdriver.Chrome(options=options)

    try:
        driver.get('https://logins.daum.net/accounts/loginform.do')
        print("브라우저에서 로그인 완료 후 엔터를 눌러주세요...")
        input()

        for post_num, start_page in POST_NUMS:
            crawl_post(driver, post_num, start_page, data)

    finally:
        driver.quit()
        print(f"\n[완료] 최종 저장: {JSON_PATH}")
        print(f"[종료] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
```

---

## 수집 결과 JSON 구조

```json
{
  "123456": [
    {
      "cmt_id": "5978",
      "post_num": "123456",
      "text": "댓글 내용",
      "page": 120,
      "created_at": "25.12.09"
    }
  ]
}
```
