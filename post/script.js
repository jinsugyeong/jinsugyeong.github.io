const REPO = 'jinsugyeong/jinsugyeong.github.io';
const BRANCH = 'source';
const OAUTH_BASE = 'https://my-decap-proxy.vercel.app';

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
            return `![${alt}](https://raw.githubusercontent.com/${REPO}/${branchForImages}/source/_posts/${slugForImages}/${src})`;
        })
        .replace(/\{%\s*asset_img\s+"?([^"\s%]+)"?\s*"?([^"%]*?)"?\s*%\}/g, function (match, filename, alt) {
            return `![${alt.trim()}](https://raw.githubusercontent.com/${REPO}/${branchForImages}/source/_posts/${slugForImages}/${filename})`;
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

    // ![파일명](data:...) → ![파일명](파일명) 교체 (alt 기반)
    result = result.replace(
        /!\[([^\]]+)\]\(data:image\/[^;]+;base64,[^)]+\)/g,
        function (match, alt) {
            if (pendingImages.has(alt)) return `![${alt}](${alt})`;
            return match;
        }
    );

    // raw URL → 파일명
    result = result.replace(
        /!\[([^\]]*)\]\(https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^?\s)]+\/source\/_?posts\/[^/]+\/([^)\s]+)\)/g,
        '![$1]($2)'
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
    fm += `author: jinsugyeong\n`;
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
                `https://api.github.com/repos/${REPO}/actions/runs?branch=${BRANCH}&per_page=5`,
                { headers }
            );
            const data = await res.json();
            const runs = data.workflow_runs || [];

            // 발행 시점 이후에 생성된 run만 체크
            const run = runs.find(r => new Date(r.created_at).getTime() > deployStartTime - 10000);

            if (run) {
                if (run.status === 'completed' && run.conclusion === 'success') {
                    document.getElementById('loading-msg').textContent = '배포 완료! 이동 중...';
                    document.getElementById('loading-sub').textContent = '';
                    const d = new Date(dateVal);
                    const p = n => String(n).padStart(2, '0');
                    const datePath = `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())}`;
                    const url = `https://jinsugyeong.github.io/${datePath}/${slug}/`;
                    location.href = url;
                    setTimeout(() => location.reload(), 500);
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