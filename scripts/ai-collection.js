/* global hexo */
'use strict';

// Keep AI posts available to their own page, feeds, categories, tags and sitemap.
// Filter generator input so homepage pagination excludes AI posts.
hexo.extend.filter.register('after_init', function() {
  for (const name of ['index']) {
    const generator = hexo.extend.generator.get(name);
    if (!generator) continue;
    hexo.extend.generator.register(name, function(locals) {
      return generator.call(this, Object.assign({}, locals, {
        posts: locals.posts.filter(post => post.collection !== 'ai')
      }));
    });
  }
});
