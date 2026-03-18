const { Component } = require('inferno');

module.exports = class extends Component {
    render() {
        const { site, helper } = this.props;
        const { url_for } = helper;

        // Build lookup map with parent-child info
        const categoryMap = {};
        site.categories.forEach(cat => {
            const posts = cat.posts.sort('-date');
            categoryMap[cat._id] = {
                id: cat._id,
                name: cat.name,
                path: cat.path,
                parent: cat.parent,
                posts: posts.data || posts,
                totalCount: posts.length,
            };
        });

        // Separate top-level and child categories
        const topLevel = [];
        const childrenByParent = {};

        Object.values(categoryMap).forEach(cat => {
            if (!cat.parent) {
                topLevel.push(cat);
            } else {
                if (!childrenByParent[cat.parent]) {
                    childrenByParent[cat.parent] = [];
                }
                childrenByParent[cat.parent].push(cat);
            }
        });

        topLevel.sort((a, b) => a.name.localeCompare(b.name));

        const renderPostList = (posts, totalCount, path) => [
            ...posts.slice(0, 5).map(post => (
                <div class="category-post-item">
                    <a href={url_for(post.path)} class="is-size-6">{post.title}</a>
                    <span class="has-text-grey is-size-7">{helper.date(post.date, 'YYYY-MM-DD')}</span>
                </div>
            )),
            /*totalCount > 5 && (
                <div style={{marginTop: '1rem'}}>
                    <a href={url_for(path)} class="button is-small is-light">More +</a>
                </div>
            ),*/
        ];

        return (
            <div class="card">
                <div class="card-content">
                    <h1 class="title is-3" style="margin-bottom: 2.5rem;">카테고리</h1>
                    <div class="categories-page">
                        {topLevel.map(cat => {
                            const children = (childrenByParent[cat.id] || [])
                                .sort((a, b) => a.name.localeCompare(b.name));

                            return (
                                <div class="category-section">
                                    <h2 class="title is-4">
                                        <i class="fas fa-folder-open" style="margin-right: 0.5rem;"></i>
                                        <a href={url_for(cat.path)}>{cat.name}</a>
                                        <span class="tag is-light" style="margin-left: 0.5rem;">{cat.totalCount}</span>
                                    </h2>
                                    {children.length > 0
                                        ? <div>
                                            {(() => {
                                                const childPostIds = new Set(
                                                    children.flatMap(child => child.posts.map(p => p._id))
                                                );
                                                const directPosts = cat.posts.filter(p => !childPostIds.has(p._id));
                                                return directPosts.length > 0
                                                    ? renderPostList(directPosts, directPosts.length, cat.path)
                                                    : null;
                                            })()}
                                            <div class="category-children">
                                                {children.map(child => (
                                                    <div class="category-section">
                                                        <h3 class="title is-5">
                                                            <i class="fas fa-folder" style="margin-right: 0.5rem;"></i>
                                                            <a href={url_for(child.path)}>{child.name}</a>
                                                            <span class="tag is-light" style="margin-left: 0.5rem;">{child.totalCount}</span>
                                                        </h3>
                                                        {renderPostList(child.posts, child.totalCount, child.path)}
                                                    </div>
                                                ))}
                                            </div>
                                          </div>
                                        : renderPostList(cat.posts, cat.totalCount, cat.path)
                                    }
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
};
