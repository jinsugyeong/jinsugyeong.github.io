(function() {
  const REPO = 'jinsugyeong/jinsugyeong.github.io';
  const BRANCH = 'source';

  async function waitForDeployThenRedirect(redirectUrl, subMsg) {
    const loadingEl = document.createElement('div');
    loadingEl.id = 'deploy-loading';
    loadingEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
    loadingEl.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid #eee;border-top-color:#6ac1f9;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div id="deploy-msg" style="margin-top:16px;font-size:15px;color:#333;">배포 중...</div>
      <div style="margin-top:8px;font-size:12px;color:#aaa;">${subMsg}</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(loadingEl);

    const deployStartTime = Date.now();
    await new Promise(r => setTimeout(r, 3000));

    const token = localStorage.getItem('gh_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const maxTries = 24;

    for (let i = 0; i < maxTries; i++) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/actions/runs?branch=${BRANCH}&per_page=5`,
          { headers }
        );
        const data = await res.json();
        const runs = data.workflow_runs || [];
        const run = runs.find(r => new Date(r.created_at).getTime() > deployStartTime - 10000);

        if (run) {
          if (run.status === 'completed' && run.conclusion === 'success') {
            document.getElementById('deploy-msg').textContent = '배포 완료! 이동 중...';
            setTimeout(() => { window.location.replace(redirectUrl); }, 500);
            return;
          } else if (run.status === 'completed' && run.conclusion !== 'success') {
            document.body.removeChild(loadingEl);
            alert('배포 실패 😢 Actions를 확인해주세요');
            return;
          }
        }
      } catch(e) { /* 무시 */ }

      document.getElementById('deploy-msg').textContent = `배포 중... (${(i+1)*5}초)`;
      await new Promise(r => setTimeout(r, 5000));
    }

    document.body.removeChild(loadingEl);
    alert('배포 시간이 너무 걸려요. 직접 확인해주세요!');
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
        // page.source는 '_posts/slug.md' 형태 → 'source/_posts/slug.md'로
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
          await waitForDeployThenRedirect('https://jinsugyeong.github.io/', '배포가 완료되면 메인화면으로 이동합니다');
        } catch(e) {
          alert('삭제 실패: ' + e.message);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
})();