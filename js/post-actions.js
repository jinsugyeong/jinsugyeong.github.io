(function() {
  function init() {
    const token = localStorage.getItem('gh_token');
    const el = document.getElementById('article-actions');
    if (!el) return;

    if (token) el.style.display = 'block';

    // 삭제 버튼
    const deleteBtn = document.getElementById('btn-delete-post');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async function() {
        if (!confirm('정말 삭제할까요?')) return;
        const path = deleteBtn.dataset.path;
        const slug = deleteBtn.dataset.slug;
        const REPO = 'jinsugyeong/jinsugyeong.github.io';
        const BRANCH = 'source';
        try {
          const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Delete Post "${slug}"`, sha: data.sha, branch: BRANCH })
          });
          alert('삭제됐어요! 배포 후 사라져요.');
          window.location.href = '/';
        } catch(e) {
          alert('삭제 실패: ' + e.message);
        }
      });
    }
  }
  
  // pjax 지원
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
})();