/* global hexo */
'use strict';

// Keep AI posts available to their own page, categories, tags and sitemap.
// Filter generator input so homepage pagination and feeds exclude AI posts.
hexo.extend.filter.register('after_init', function() {
  for (const name of ['index', 'atom', 'rss2']) {
    const generator = hexo.extend.generator.get(name);
    if (!generator) continue;
    hexo.extend.generator.register(name, function(locals) {
      return generator.call(this, Object.assign({}, locals, {
        posts: locals.posts.filter(post => post.collection !== 'ai')
      }));
    });
  }
});
