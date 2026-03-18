'use strict';

hexo.extend.filter.register('before_post_render', function(data) {
  // 마크다운 이미지 정규식: ![alt 텍스트](이미지경로)
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  data.content = data.content.replace(regex, function(match, alt, path) {
    // 1. 인터넷 외부 링크(http://, https://)는 변환하지 않고 그대로 둠
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return match;
    }

    // 2. 경로에서 파일명만 추출 (예: folder/image.png -> image.png)
    const fileName = path.split('/').pop();

    // 3. Hexo의 asset_img 태그로 변환하여 리턴 (배포할 때만 적용됨!)
    return `{% asset_img "${fileName}" "${alt}" %}`;
  });

  return data;
});