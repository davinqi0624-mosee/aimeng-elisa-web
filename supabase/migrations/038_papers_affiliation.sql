-- 文献公示增强：公开页展示发表单位/研究单位，而不是长作者名单。

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS affiliation TEXT;

UPDATE papers
SET affiliation = '上海交通大学'
WHERE doi ILIKE '10.1136/jitc-2024-010908'
  AND (affiliation IS NULL OR btrim(affiliation) = '');

NOTIFY pgrst, 'reload schema';
