(function() {
  const REPO = 'jinsugyeong/jinsugyeong.github.io';
  const BRANCH = 'source';
  const DEPLOY_WORKFLOW_NAME = 'Deploy Hexo Blog';

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

  async function waitForDeployThenRedirect(redirectUrl, subMsg, commitSha) {
    showDeployLoading(subMsg);

    const deployStartTime = Date.now() - 60000;
    await new Promise(r => setTimeout(r, 3000));

    const token = localStorage.getItem('gh_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const maxTries = 24;

    for (let i = 0; i < maxTries; i++) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/runs?branch=${encodeURIComponent(BRANCH)}&event=push&per_page=20`,
          { headers }
        );
        const data = await res.json();
        const runs = data.workflow_runs || [];
        const run = runs.find(r => {
          const workflowMatches = r.name === DEPLOY_WORKFLOW_NAME || (r.path || '').endsWith('/deploy.yml');
          const commitMatches = commitSha ? r.head_sha === commitSha : new Date(r.created_at).getTime() > deployStartTime;
          return workflowMatches && commitMatches;
        });

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
          const delData = await delRes.json();
          showToast('삭제됐어요! 배포 대기 중...', 'success');
          await waitForDeployThenRedirect('https://jinsugyeong.github.io/', '배포가 완료되면 메인화면으로 이동합니다', delData.commit && delData.commit.sha);
        } catch(e) {
          showToast('삭제 실패: ' + e.message, 'error');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
})();
