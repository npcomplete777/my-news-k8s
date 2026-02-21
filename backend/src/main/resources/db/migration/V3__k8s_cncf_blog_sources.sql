-- Adds Kubernetes blog and CNCF blog sources for their dedicated RSS pollers.
INSERT INTO sources (name, slug, api_url, enabled, poll_interval, config_json) VALUES
    ('Kubernetes Blog', 'k8sblog',  'https://kubernetes.io/feed.xml',   true, 3600, '{"logoUrl":"https://kubernetes.io/images/favicon.png"}'),
    ('CNCF Blog',       'cncfblog', 'https://www.cncf.io/blog/feed/',   true, 3600, '{"logoUrl":"https://www.cncf.io/wp-content/uploads/2022/07/icon-color.png"}');
