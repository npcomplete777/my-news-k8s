-- Adds o11y vendor blog sources for dedicated RSS pollers.
-- Each source gets a logoUrl in config_json used as fallback thumbnail.
INSERT INTO sources (name, slug, api_url, enabled, poll_interval, config_json) VALUES
    ('Datadog Blog',   'datadogblog',   'https://www.datadoghq.com/feed.xml',              true, 3600, '{"logoUrl":"https://imgix.datadoghq.com/img/dd_logo_n_70x75.png"}'),
    ('Dynatrace Blog', 'dynatraceblog', 'https://www.dynatrace.com/news/blog/feed/',        true, 3600, '{"logoUrl":"https://dt-cdn.net/images/dynatrace-logo-272-58d23a5d5c.png"}'),
    ('Grafana Blog',   'grafanablog',   'https://grafana.com/blog/index.xml',               true, 3600, '{"logoUrl":"https://grafana.com/static/img/logos/grafana_logo_swirl_dark.svg"}'),
    ('New Relic Blog', 'newrelicblog',  'https://newrelic.com/blog/feed',                   true, 3600, '{"logoUrl":"https://newrelic.com/themes/custom/erno/assets/mediakit/nr_logo_vertical_white.png"}');
