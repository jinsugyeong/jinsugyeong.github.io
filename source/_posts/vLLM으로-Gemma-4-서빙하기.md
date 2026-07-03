---
title: "vLLM으로 Gemma 4 서빙하기"
date: 2026-06-30 17:05:00
author: jinsugyeong
categories:
  - AI
tags:
  - vLLM
  - Gemma
  - LLM
  - CUDA
  - Transformers
  - 멀티모달
---

+260703  추가
이거 vllm 0.21.0 버전 써서 그럼 0.24.0 버전으로 업그레이드하니깐 됐어염ㅎ


최근 vLLM 환경에 Gemma-4-12B-it(Vision-Language Model)를 올리면서 진짜 별의별 에러를 다 만났다. 단순히 모델 하나 띄우는 거였는데 이기종 어텐션 구조부터 CUDA Graph 캡처, 멀티모달 배치 처리까지 곳곳에 지뢰가 깔려있었다.

나중에 찾아보니 이유가 있었다. 12B Unified 모델 지원은 `vllm-project/vllm#44429`로 막 들어간 거라 [vLLM 공식 recipe 페이지](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#multimodal-tool-calling)에도 "아직 stable release에는 포함되지 않았다"고 명시되어있고, nightly wheel이나 `vllm/vllm-openai:gemma4-unified` 핀 도커 이미지를 쓰라고 권장하는 상태였다.

<!-- more -->

근데 나는 MEC GPU 서버 + 쿠버네티스 환경이라 도커 이미지를 새로 올릴 수 없어서 그냥 pip로 받을 수 있는 최신 stable(`vllm==0.21.0`, `transformers==5.12.1`)을 깔고, 가상환경 site-packages 안에 들어가서 PR이 아직 안 들어간 부분을 직접 손으로 수정하는 쪽으로 우회했다. 


현재 상황
- 모델: Gemma-4-12B-it (Vision-Language Model)
- 서빙 프레임워크: vLLM 0.21.0 + Transformers 5.12.1 (둘 다 stable, 도커 X, 로컬 site-packages 직접 패치)
- 증상: 초기화 → 추론 → 배치 처리까지 단계마다 다른 에러가 순서대로 터짐

**목표: 4가지 에러 다 잡고, `max-num-seqs 32`로 이미지 던져도 안 죽는 서빙 파이프라인 완성**

---

# 1. 이기종 어텐션 구조로 인한 차원 불일치

모델 로드하자마자 첫 에러.

```
RuntimeError: mat1 and mat2 shapes cannot be multiplied
```

[원인]
Gemma-4는 레이어마다 구조가 다르다. 슬라이딩 윈도우(Sliding Window) 어텐션이랑 풀 어텐션(Full Attention) 레이어가 번갈아 등장하는 이기종 구조인데, 실제 config를 까보면 `head_dim: 256`(sliding_attention용)이랑 `global_head_dim: 512`(full_attention용)가 따로 박혀있다. vLLM의 `base.py`는 "모든 레이어가 같은 `head_size`를 가진다"고 가정하고 어텐션 인스턴스를 일괄 생성하는데, 여기서 256과 512가 충돌하면서 차원이 어긋났다.

[해결책]

`vllm/model_executor/models/transformers/base.py`의 `create_attention_instances` 함수 반복문을 수정해서, 레이어별로 구조를 확인하고 `head_size`를 동적으로 계산하도록 변경.

---

# 2. MQA 설정 누락으로 인한 KV 캐시 에러

1번 넘기니까 바로 또 Shape Mismatch. 이번엔 KV Cache 쪽.

[원인]

실제 `google/gemma-4-12B-it`의 `config.json` `text_config`를 직접 열어보면 이렇게 박혀있다.

```
"num_key_value_heads": 8,          # sliding_attention 레이어용
"num_global_key_value_heads": 1,   # full_attention 레이어용 (MQA)
"global_head_dim": 512,
"head_dim": 256,
```

`full_attention` 레이어는 KV 헤드를 1개만 쓰는 MQA(Multi-Query Attention) 구조라는 뜻인데, vLLM이 이 `num_global_key_value_heads`를 제대로 못 읽어와서, full_attention 레이어에도 일반(sliding) 레이어용 기본값인 8이 그대로 덮어씌워지고 있었음.

[해결책]

`base.py`의 `create_attention_instances` 안에서 현재 레이어가 `full_attention`인지 체크하고, 맞으면 `num_global_key_value_heads`(=1) 값을 가져와서 `num_kv_heads`로 동적 할당하도록 패치. 

이 값은 실제 체크포인트 config.json에서 직접 확인한 값이라 근거는 확실함.

---

# 3. CUDA Graph 캡처 중 CPU 텐서 복사 에러

모델 로드까지는 끝났는데, 추론 최적화용 CUDA Graph 캡처 단계에서 또 멈춤.

```
RuntimeError: Cannot copy between CPU and CUDA tensors
```

[원인]

vLLM은 속도 때문에 CUDA Graph를 캡처하는데, 이 단계는 CPU↔GPU 데이터 이동에 엄청 빡빡하다.

원인은 Transformers의 `modeling_gemma4_unified.py` 내부 마스크 생성 로직 - `torch.tensor()`로 CPU에서 텐서를 먼저 만들고 나중에 GPU로 옮기는 방식이라 캡처가 깨진다.

[해결책]

`modeling_gemma4_unified.py`에서 CPU를 거치지 않고 처음부터 GPU에 직접 할당하는 `torch.full(..., device=inputs_embeds.device)` 구문으로 교체. 이걸로 CUDA Graph 캡처 통과했다.

---

# 4. 멀티모달 배치 처리 붕괴 버그

3개 잡고 나니 서버는 잘 뜸. 단일 요청도 멀쩡함.

근데 클라이언트에서 `max-num-seqs 32`로 이미지 여러 장을 동시에 쏘니까 엔진이 그냥 즉사(Killed)했다.

```
ValueError: Attempted to assign 1 + 1 + 1 = 3 multimodal tokens to 793 placeholders
RuntimeError: shape mismatch: value tensor of shape [3, 3840] cannot be broadcast to indexing result of shape [793, 3840]
```

[원인 분석]

처음엔 그냥 "vLLM 멀티모달 분할 로직 버그"라고만 생각했는데, 실제 설치된 `vllm/model_executor/models/transformers/multimodal.py`를 직접 열어서 라인 단위로 확인해보니 원인이 두 단계로 겹쳐 있었다.

**4-1. vLLM Transformers 백엔드의 분할 로직 (421~459행)**

vLLM 공식 Contributing Guide(범용 멀티모달 인터페이스 문서)에는 "i번째 아이템의 placeholder 토큰 수는 그 아이템의 `patch_embeddings[i].shape[0]`을 그대로 쓴다"고만 적혀있어서 별도 분기 로직은 안 보이는데, 이건 일반 인터페이스 설계 철학을 설명한 문서고, 실제 Transformers 백엔드 전용 코드에는 모델이 보고한 patch 수와 실제 embedding 길이가 안 맞을 때를 대비한 3단계 fallback 분기가 따로 있었다.

```python
# vllm/model_executor/models/transformers/multimodal.py (421행~)
if isinstance(vision_embeddings, torch.Tensor):
    split_sizes = num_image_patches.flatten().tolist()
    total_patches = sum(split_sizes)
    total_tokens = vision_embeddings.shape[0]

    if total_tokens == total_patches:
        # 1) Direct match
        token_split_sizes = split_sizes
    elif total_patches > 0 and total_tokens % total_patches == 0:
        # 2) Uniform expansion
        tokens_per_patch = total_tokens // total_patches
        token_split_sizes = [s * tokens_per_patch for s in split_sizes]
    elif total_patches > 0:
        # 3) Mismatch → 강제 truncate
        vision_embeddings = vision_embeddings[:total_patches]
        token_split_sizes = split_sizes
```

**4-2. Gemma-4 프로세서가 patch 수를 잘못 보고하는 문제**

Gemma-4의 `vision_config`엔 `num_soft_tokens: 280`, `model_patch_size: 48`, `pooling_kernel_size: 3` 같은 값이 있고, 패치를 뽑아서 풀링한 다음 빈 자리는 패딩으로 채우는 구조라, 이미지 해상도에 따라 패딩을 벗겨낸 실제 유효 토큰 수는 이미지마다 다르게 나온다.(이미지 3장이면 합쳐서 793개처럼).

문제는 Gemma-4 쪼가 넘기는 `num_image_patches`가 이 실제 유효 토큰 합계(793)가 아니라 `[1, 1, 1]`(이미지 개수)로 잘못 보고된다는 것. 그 결과 위 분기를 그대로 따라가보면:

- `num_image_patches = [1, 1, 1]` → `total_patches = 3`
- `total_tokens = 793` (실제 vision embedding 길이)
- 1번 분기: `793 == 3`? → No
- 2번 분기: `793 % 3 == 0`? → No (793 = 264×3 + 1)
- 3번 분기(Mismatch)로 진입 → `vision_embeddings[:3]`으로 강제 truncate, `token_split_sizes = [1, 1, 1]`

이렇게 793개짜리 embedding이 3개로 잘려나간 채로, 텍스트 시퀀스에는 이미 793개의 placeholder 토큰이 박혀있으니 둘이 안 맞아서 shape mismatch로 터지는 것.

[해결책]

`max-num-seqs`를 낮춰서 우회하는 건 답이 아니라고 생각해서, `transformers/models/gemma4_unified/modeling_gemma4_unified.py`를 다시 열었음. `get_image_features` 함수가 전체 배치를 하나의 텐서로 뭉쳐서 반환하면서 이미지별 patch 수 정보까지 같이 뭉개버리는 게 근본 원인이었으니, 반환값 자체를 이미지별로 쪼개진 리스트(List of Tensors)로 넘기도록 고쳤다.

```python
# Strip padding patches before scattering into text sequence.
padding_mask = (image_position_ids == -1).all(dim=-1).to(vision_outputs.device)

vision_outputs_list = []
for i in range(vision_outputs.size(0)):
    valid_mask = ~padding_mask[i]
    vision_outputs_list.append(vision_outputs[i][valid_mask])

return Gemma4UnifiedVisionModelOutput(
    pooler_output=vision_outputs_list,
)
```

이렇게 list로 반환하면 vLLM 쪼의 `isinstance(vision_embeddings, torch.Tensor)` 체크가 `False`가 돼서, 위에서 본 3단계 분기 로직(Direct match / Uniform expansion / Mismatch truncate)을 통째로 건너뛰고 함수 끝의 `return vision_embeddings`로 바로 빠진다. 결국 이미지별 실제 유효 토큰 수(예: 280+256+257=793)가 그대로 보존된 채 vLLM에 전달되고, `merge_multimodal_embeddings`에서 안전하게 텐서 병합이 이뤄진다.

---


이 4개 다 고치고 나니 `max-num-seqs 32`로 이미지를 미친 듯이 던져도 안 죽는 파이프라인이 완성됐다.


끝